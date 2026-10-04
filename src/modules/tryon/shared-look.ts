import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";

const sizesSchema = z.record(z.uuid(), z.string().trim().max(40));
const hash = (token: string) => createHash("sha256").update(token).digest("hex");
const select = {
  id: true,
  ownerId: true,
  recipientId: true,
  tokenHash: true,
  message: true,
  sizes: true,
  expiresAt: true,
  revokedAt: true,
  approvedAt: true,
  owner: { select: { profile: { select: { username: true, displayName: true } } } },
  approvedBy: { select: { profile: { select: { displayName: true } } } },
  result: {
    select: {
      status: true,
      expiresAt: true,
      productIds: true,
      photo: { select: { expiresAt: true } },
      resultMedia: {
        select: { storageKey: true, mimeType: true, status: true, width: true, height: true },
      },
    },
  },
} satisfies Prisma.SharedLookSelect;

export type SharedLookDTO = {
  id: string;
  message: string;
  owner: { name: string; username: string };
  image: { url: string; width: number; height: number };
  expiresAt: string;
  approvedBy: string | null;
  mine: boolean;
  canBuy: boolean;
  products: {
    id: string;
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    size: string | null;
    available: boolean;
  }[];
};

export class SharedLookError extends Error {
  constructor(readonly code: "UNAVAILABLE" | "CART_CONFLICT" | "ALREADY_APPROVED") {
    super(code);
  }
}

async function blocked(ownerId: string, viewerId: string) {
  return (
    (await db.messageBlock.count({
      where: {
        OR: [
          { blockerId: ownerId, blockedId: viewerId },
          { blockerId: viewerId, blockedId: ownerId },
        ],
      },
    })) > 0
  );
}

async function authorizedLook(id: string, viewerId: string | null, token?: string) {
  if (!z.uuid().safeParse(id).success) return null;
  const row = await db.sharedLook.findUnique({ where: { id }, select });
  const now = new Date();
  if (
    !row ||
    row.revokedAt ||
    row.expiresAt <= now ||
    row.result.expiresAt <= now ||
    row.result.photo.expiresAt <= now ||
    row.result.status !== "READY" ||
    row.result.resultMedia?.status !== "READY"
  )
    return null;
  if (viewerId === row.ownerId) return row;
  if (viewerId && (await blocked(row.ownerId, viewerId))) return null;
  if (row.recipientId) return viewerId === row.recipientId ? row : null;
  if (!token || !/^[A-Za-z0-9_-]{43}$/.test(token) || !row.tokenHash) return null;
  return timingSafeEqual(Buffer.from(hash(token), "hex"), Buffer.from(row.tokenHash, "hex"))
    ? row
    : null;
}

export async function getSharedLook(
  id: string,
  viewerId: string | null,
  token?: string,
): Promise<SharedLookDTO | null> {
  const row = await authorizedLook(id, viewerId, token);
  if (!row) return null;
  const products = await db.product.findMany({
    where: {
      id: { in: row.result.productIds },
      ...VISIBLE_PRODUCT,
      status: { in: ["ACTIVE", "PAUSED", "SOLD_OUT"] },
    },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      currency: true,
      stock: true,
      status: true,
      seller: { select: { status: true } },
    },
  });
  const sizes = sizesSchema.safeParse(row.sizes);
  const ordered = row.result.productIds.flatMap((id) => {
    const product = products.find((p) => p.id === id);
    return product
      ? [
          {
            id: product.id,
            slug: product.slug,
            title: product.title,
            priceCents: product.priceCents,
            currency: product.currency,
            size: sizes.success ? sizes.data[id] || null : null,
            available:
              product.status === "ACTIVE" &&
              product.stock > 0 &&
              product.seller.status === "ACTIVE",
          },
        ]
      : [];
  });
  const media = row.result.resultMedia!;
  const query = token && !row.recipientId ? `?clave=${encodeURIComponent(token)}` : "";
  return {
    id: row.id,
    message: row.message,
    owner: {
      name: row.owner.profile?.displayName ?? "Alguien",
      username: row.owner.profile?.username ?? "",
    },
    image: { url: `/api/looks/${row.id}/imagen${query}`, width: media.width, height: media.height },
    expiresAt: row.expiresAt.toISOString(),
    approvedBy: row.approvedAt ? (row.approvedBy?.profile?.displayName ?? "Alguien") : null,
    mine: viewerId === row.ownerId,
    products: ordered,
    canBuy:
      ordered.length === row.result.productIds.length &&
      ordered.length > 0 &&
      ordered.every((p) => p.available),
  };
}

export async function getSharedLookImage(id: string, viewerId: string | null, token?: string) {
  return (await authorizedLook(id, viewerId, token))?.result.resultMedia ?? null;
}

export async function createSharedLook(
  ownerId: string,
  input: {
    resultId: string;
    recipientId: string | null;
    message: string;
    sizes: Record<string, string>;
  },
) {
  const now = new Date();
  const result = await db.tryOnResult.findFirst({
    where: {
      id: input.resultId,
      userId: ownerId,
      status: "READY",
      expiresAt: { gt: now },
      photo: { expiresAt: { gt: now } },
      resultMedia: { status: "READY" },
    },
    select: { id: true, productIds: true, expiresAt: true, photo: { select: { expiresAt: true } } },
  });
  if (!result || Object.keys(input.sizes).some((id) => !result.productIds.includes(id)))
    throw new SharedLookError("UNAVAILABLE");
  const active = await db.sharedLook.count({
    where: { ownerId, resultId: result.id, revokedAt: null, expiresAt: { gt: now } },
  });
  if (active >= 30) throw new SharedLookError("UNAVAILABLE");
  const token = input.recipientId ? null : randomBytes(32).toString("base64url");
  const row = await db.sharedLook.create({
    data: {
      ownerId,
      resultId: result.id,
      recipientId: input.recipientId,
      tokenHash: token ? hash(token) : null,
      message: input.message,
      sizes: input.sizes,
      expiresAt: new Date(
        Math.min(
          now.getTime() + 7 * 86400000,
          result.expiresAt.getTime(),
          result.photo.expiresAt.getTime(),
        ),
      ),
    },
    select: { id: true },
  });
  return { id: row.id, path: `/look/${row.id}${token ? `?clave=${token}` : ""}` };
}

export async function listMySharedLooks(ownerId: string, resultId: string) {
  const rows = await db.sharedLook.findMany({
    where: { ownerId, resultId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      message: true,
      expiresAt: true,
      recipient: { select: { profile: { select: { displayName: true } } } },
    },
  });
  return rows.map((row) => ({
    id: row.id,
    message: row.message,
    recipient: row.recipient?.profile?.displayName ?? "Enlace para compartir",
    expiresAt: row.expiresAt.toISOString(),
  }));
}

export async function revokeSharedLook(ownerId: string, id: string) {
  await db.sharedLook.updateMany({
    where: { id, ownerId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function approveSharedLook(
  viewerId: string,
  id: string,
  conversationId: string,
  token?: string,
) {
  const row = await authorizedLook(id, viewerId, token);
  if (!row || row.ownerId === viewerId) throw new SharedLookError("UNAVAILABLE");
  await db.$transaction(async (tx) => {
    const conversation = await tx.conversation.findFirst({
      where: {
        id: conversationId,
        OR: [
          { userAId: viewerId, userBId: row.ownerId },
          { userAId: row.ownerId, userBId: viewerId },
        ],
      },
      select: { userAId: true },
    });
    if (!conversation) throw new SharedLookError("UNAVAILABLE");
    const now = new Date();
    const moved = await tx.sharedLook.updateMany({
      where: { id, revokedAt: null, expiresAt: { gt: now }, approvedAt: null },
      data: { approvedAt: now, approvedById: viewerId },
    });
    if (!moved.count) throw new SharedLookError("ALREADY_APPROVED");
    await tx.message.create({
      data: {
        conversationId,
        senderId: viewerId,
        body: "Sí, amor ❤️. Me encanta tu look; puedes continuar la compra desde tu cuenta.",
        createdAt: now,
      },
    });
    await tx.conversation.update({
      where: { id: conversationId },
      data: {
        lastMessageAt: now,
        ...(conversation.userAId === viewerId ? { aReadAt: now } : { bReadAt: now }),
      },
    });
  });
  return row.owner.profile?.username ?? "";
}

/** El regalo agrega una pieza por producto y conserva el carrito existente. Doble clic no suma. */
export async function addSharedLookToCart(viewerId: string, id: string, token?: string) {
  const look = await getSharedLook(id, viewerId, token);
  if (!look?.canBuy) throw new SharedLookError("UNAVAILABLE");
  const giftRecipientName = look.mine ? null : look.owner.name.slice(0, 80);
  await db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout:${viewerId}`}, 0))`;
    const cart = await tx.cart.upsert({
      where: { userId: viewerId },
      create: { userId: viewerId },
      update: {},
      select: { id: true },
    });
    for (const item of look.products) {
      const product = await tx.product.findFirst({
        where: {
          id: item.id,
          ...VISIBLE_PRODUCT,
          status: "ACTIVE",
          stock: { gt: 0 },
          seller: { status: "ACTIVE", userId: { not: viewerId } },
        },
        select: { id: true },
      });
      if (!product) throw new SharedLookError("UNAVAILABLE");
      const existing = await tx.cartItem.findUnique({
        where: { cartId_productId: { cartId: cart.id, productId: item.id } },
      });
      if (
        existing &&
        (existing.giftRecipientName !== giftRecipientName || existing.requestedSize !== item.size)
      )
        throw new SharedLookError("CART_CONFLICT");
      if (!existing)
        await tx.cartItem.create({
          data: {
            cartId: cart.id,
            productId: item.id,
            quantity: 1,
            requestedSize: item.size,
            giftRecipientName,
          },
        });
    }
  });
}
