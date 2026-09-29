import "server-only";
import { cache } from "react";
import { z } from "zod";
import { track } from "@/modules/analytics/track";
import { imagePriceMicrosUsd, IMAGE_PRICES_USD_PER_IMAGE } from "@/modules/ai/cost";
import { monthStart } from "@/modules/ai/budget-ledger";
import { getAiBudget } from "@/modules/platform/settings";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getImageProvider } from "@/server/providers/image";
import { simulatedPaymentsEnabled } from "@/server/providers/payments";
import { featuredDaysLeft, featuredUntilAfter } from "./featured";
import {
  featuredCostCents,
  MAX_SPONSOR_DAILY_CAP_CENTS,
  MIN_SPONSOR_DAILY_CAP_CENTS,
  topUpPack,
  type TryOnPrice,
  tryOnPrice,
} from "./pricing";
import { chargedTodayCents, creditWallet, debitWallet, walletSummary } from "./wallet";

export class BillingError extends Error {
  override name = "BillingError";
  constructor(
    readonly code:
      | "UNKNOWN_PACK"
      | "PAYMENTS_UNAVAILABLE"
      | "INVALID_CAP"
      | "NOT_SELLER"
      | "INVALID_DAYS"
      | "PRODUCT_NOT_FOUND"
      | "PRODUCT_NOT_SELLABLE"
      | "INSUFFICIENT_BALANCE",
    readonly detail: { balanceCents?: number; costCents?: number } = {},
  ) {
    super(code);
  }
}

/** Costo unitario de una imagen con el modelo vigente (micro-dólares); la cota más alta si no tiene precio. */
export function currentImageUnitCostMicros(): number {
  const model = getImageProvider().model;
  const known = imagePriceMicrosUsd(model);
  if (known !== null) return known;
  return Math.ceil(Math.max(...Object.values(IMAGE_PRICES_USD_PER_IMAGE)) * 1_000_000);
}

/** Pruebas generadas (con o sin pago) en el mes UTC anterior: el volumen que fija el nivel. */
export async function previousMonthTryOns(now = new Date()): Promise<number> {
  return db.tryOnResult.count({
    where: {
      status: "READY",
      createdAt: { gte: monthStart(now, -1), lt: monthStart(now) },
    },
  });
}

/** Precio comunitario vigente (una lectura por petición). */
export const getTryOnPricing = cache(async (): Promise<TryOnPrice> => {
  const [budget, monthlyTryOns] = await Promise.all([getAiBudget(), previousMonthTryOns()]);
  return tryOnPrice({
    monthlyTryOns,
    unitCostMicrosUsd: currentImageUnitCostMicros(),
    mxnPerUsd: budget.mxnPerUsd,
  });
});

/** Saldo y movimientos de la persona. */
export function getWallet(userId: string) {
  return walletSummary(db, userId);
}

/**
 * Recarga con el proveedor SIMULADO (ADR-032): no se cobra nada, el saldo queda marcado como
 * simulado y no cuenta como ingreso. Con un proveedor real se crea la recarga PENDING y se acredita
 * solo por webhook (`applyTopUpPayment`).
 */
export async function topUpSimulated(userId: string, packId: string, now = new Date()) {
  const pack = topUpPack(packId);
  if (!pack) throw new BillingError("UNKNOWN_PACK");
  if (!simulatedPaymentsEnabled()) throw new BillingError("PAYMENTS_UNAVAILABLE");
  const result = await db.$transaction(async (tx) => {
    const wallet = await tx.wallet.upsert({
      where: { userId },
      create: { userId },
      update: {},
      select: { id: true },
    });
    const topUp = await tx.walletTopUp.create({
      data: {
        walletId: wallet.id,
        packId: pack.id,
        amountCents: pack.amountCents,
        bonusCents: pack.bonusCents,
        status: "PAID",
        provider: "mock",
        providerRef: `mock-topup-${crypto.randomUUID()}`,
        simulated: true,
        paidAt: now,
      },
      select: { id: true },
    });
    const credited = await creditWallet(tx, {
      userId,
      amountCents: pack.amountCents,
      kind: "TOPUP",
      reference: topUp.id,
      simulated: true,
    });
    let balanceCents = credited.balanceCents;
    if (pack.bonusCents > 0) {
      balanceCents = (
        await creditWallet(tx, {
          userId,
          amountCents: pack.bonusCents,
          kind: "PROMO",
          reference: topUp.id,
          simulated: true,
        })
      ).balanceCents;
    }
    return { topUpId: topUp.id, balanceCents };
  });
  track({
    type: "WALLET_TOPUP",
    userId,
    surface: "WALLET",
    metadata: { packId: pack.id, simulated: true },
  });
  return result;
}

/**
 * Notificación de un proveedor real (webhook con firma verificada, como los pedidos): acredita una
 * recarga PENDING exactamente una vez. Un APPROVED con otro monto no se aplica (SEC-23). El ingreso
 * real queda en el libro de la plataforma (`AI_PREMIUM`): sube el presupuesto de IA (ADR-020).
 */
export async function applyTopUpPayment(input: {
  provider: string;
  providerRef: string;
  status: "APPROVED" | "DECLINED" | "EXPIRED";
  amountCents?: number;
  currency?: string;
  now?: Date;
}): Promise<"applied" | "ignored"> {
  const now = input.now ?? new Date();
  return db.$transaction(async (tx) => {
    const topUp = await tx.walletTopUp.findUnique({
      where: { providerRef: input.providerRef },
      select: {
        id: true,
        status: true,
        provider: true,
        amountCents: true,
        bonusCents: true,
        currency: true,
        wallet: { select: { userId: true } },
      },
    });
    if (!topUp || topUp.status !== "PENDING" || topUp.provider !== input.provider) return "ignored";
    if (input.status !== "APPROVED") {
      await tx.walletTopUp.update({
        where: { id: topUp.id },
        data: { status: input.status === "DECLINED" ? "FAILED" : "EXPIRED" },
      });
      return "applied";
    }
    if (
      input.amountCents !== topUp.amountCents ||
      (input.currency ?? topUp.currency) !== topUp.currency
    ) {
      return "ignored";
    }
    await tx.walletTopUp.update({
      where: { id: topUp.id },
      data: { status: "PAID", paidAt: now },
    });
    const userId = topUp.wallet.userId;
    await creditWallet(tx, {
      userId,
      amountCents: topUp.amountCents,
      kind: "TOPUP",
      reference: topUp.id,
    });
    if (topUp.bonusCents > 0) {
      await creditWallet(tx, {
        userId,
        amountCents: topUp.bonusCents,
        kind: "PROMO",
        reference: topUp.id,
      });
    }
    await tx.platformLedgerEntry.create({
      data: {
        kind: "AI_PREMIUM",
        amountCents: topUp.amountCents,
        currency: topUp.currency,
        reference: `topup:${topUp.id}`,
        occurredAt: now,
      },
    });
    return "applied";
  });
}

const sponsorSchema = z.object({
  enabled: z.boolean(),
  dailyCapCents: z.int().min(0).max(MAX_SPONSOR_DAILY_CAP_CENTS),
});

/** «Pruebas gratis en mis productos» (ADR-044): el vendedor lo activa con un tope diario. */
export async function setSponsorTryOn(
  sellerUserId: string,
  input: { enabled: boolean; dailyCapCents: number },
) {
  const parsed = sponsorSchema.safeParse(input);
  if (!parsed.success) throw new BillingError("INVALID_CAP");
  if (parsed.data.enabled && parsed.data.dailyCapCents < MIN_SPONSOR_DAILY_CAP_CENTS) {
    throw new BillingError("INVALID_CAP");
  }
  const updated = await db.sellerProfile.updateMany({
    where: { userId: sellerUserId },
    data: {
      sponsorsTryOn: parsed.data.enabled,
      tryOnDailyCapCents: parsed.data.enabled ? parsed.data.dailyCapCents : 0,
    },
  });
  if (updated.count === 0) throw new BillingError("NOT_SELLER");
}

/**
 * Destacar un producto propio `days` días (ADR-046): se cobra por adelantado del saldo de la tienda
 * y la vigencia se suma a la que aún corra. Solo productos activos, con existencias y visibles: un
 * producto que no se puede comprar no se anuncia. Sin devolución si después se pausa u oculta.
 */
export async function featureProduct(
  sellerUserId: string,
  productId: string,
  days: number,
  now = new Date(),
) {
  const costCents = featuredCostCents(days);
  if (costCents === null) throw new BillingError("INVALID_DAYS");
  const seller = await db.sellerProfile.findUnique({
    where: { userId: sellerUserId },
    select: { id: true },
  });
  if (!seller) throw new BillingError("NOT_SELLER");
  const product = await db.product.findFirst({
    where: { id: productId, sellerId: seller.id },
    select: { id: true, status: true, stock: true, moderationStatus: true, featuredUntil: true },
  });
  if (!product) throw new BillingError("PRODUCT_NOT_FOUND");
  if (product.status !== "ACTIVE" || product.stock <= 0 || product.moderationStatus !== "VISIBLE") {
    throw new BillingError("PRODUCT_NOT_SELLABLE");
  }
  const until = featuredUntilAfter(product.featuredUntil, now, days);
  const result = await db.$transaction(async (tx) => {
    const debit = await debitWallet(tx, {
      userId: sellerUserId,
      amountCents: costCents,
      kind: "FEATURED",
      reference: `featured:${productId}:${days}d`,
    });
    if (!debit.ok) {
      throw new BillingError("INSUFFICIENT_BALANCE", {
        balanceCents: debit.balanceCents,
        costCents,
      });
    }
    await tx.product.update({ where: { id: productId }, data: { featuredUntil: until } });
    return { balanceCents: debit.balanceCents, until };
  });
  track({
    type: "WALLET_CHARGE",
    userId: sellerUserId,
    surface: "STUDIO",
    entityType: "PRODUCT",
    entityId: productId,
    metadata: { kind: "FEATURED", days, costCents },
  });
  return result;
}

export type SellerFeaturedProduct = {
  id: string;
  title: string;
  slug: string;
  sellable: boolean;
  featuredUntil: string | null;
  daysLeft: number;
  /** Visitas a la ficha que llegaron desde un lugar patrocinado (30 días). */
  visitsFromFeatured: number;
};

/** Los productos de la tienda con su estado de destacado, para `/studio/campanas`. */
export async function listSellerFeatured(
  sellerUserId: string,
  now = new Date(),
): Promise<SellerFeaturedProduct[]> {
  const seller = await db.sellerProfile.findUnique({
    where: { userId: sellerUserId },
    select: { id: true },
  });
  if (!seller) return [];
  const products = await db.product.findMany({
    where: { sellerId: seller.id, status: { in: ["ACTIVE", "PAUSED", "SOLD_OUT"] } },
    orderBy: [{ featuredUntil: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      stock: true,
      moderationStatus: true,
      featuredUntil: true,
    },
  });
  if (products.length === 0) return [];
  const visits = await db.analyticsEvent.groupBy({
    by: ["entityId"],
    where: {
      type: "PRODUCT_VIEW",
      entityType: "PRODUCT",
      entityId: { in: products.map((product) => product.id) },
      createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
      metadata: { path: ["placement"], equals: "destacado" },
    },
    _count: { _all: true },
  });
  const visitsById = new Map(visits.map((row) => [row.entityId, row._count._all]));
  return products.map((product) => ({
    id: product.id,
    title: product.title,
    slug: product.slug,
    sellable:
      product.status === "ACTIVE" && product.stock > 0 && product.moderationStatus === "VISIBLE",
    featuredUntil: product.featuredUntil?.toISOString() ?? null,
    daysLeft: featuredDaysLeft(product.featuredUntil, now),
    visitsFromFeatured: visitsById.get(product.id) ?? 0,
  }));
}

/** Cuántos destacados vigentes hay en toda la plataforma (para el resumen del equipo y pruebas). */
export function countActiveFeatured(now = new Date()) {
  return db.product.count({
    where: { featuredUntil: { gt: now }, status: "ACTIVE", stock: { gt: 0 }, ...VISIBLE_PRODUCT },
  });
}

export type SponsorStatus = {
  enabled: boolean;
  dailyCapCents: number;
  spentTodayCents: number;
  balanceCents: number;
  /** Pruebas patrocinadas en los últimos 30 días y cuántas siguieron con un carrito. */
  sponsoredLast30Days: number;
};

/** Estado del patrocinio para el Studio del vendedor. */
export async function getSponsorStatus(
  sellerUserId: string,
  now = new Date(),
): Promise<SponsorStatus> {
  const [seller, spentTodayCents, wallet, sponsoredLast30Days] = await Promise.all([
    db.sellerProfile.findUnique({
      where: { userId: sellerUserId },
      select: { id: true, sponsorsTryOn: true, tryOnDailyCapCents: true },
    }),
    chargedTodayCents(db, sellerUserId, "SPONSORED_TRY_ON", now),
    db.wallet.findUnique({ where: { userId: sellerUserId }, select: { balanceCents: true } }),
    db.sellerProfile
      .findUnique({ where: { userId: sellerUserId }, select: { id: true } })
      .then((row) =>
        row
          ? db.tryOnResult.count({
              where: {
                sponsorSellerId: row.id,
                status: "READY",
                createdAt: { gte: new Date(now.getTime() - 30 * 86_400_000) },
              },
            })
          : 0,
      ),
  ]);
  return {
    enabled: seller?.sponsorsTryOn ?? false,
    dailyCapCents: seller?.tryOnDailyCapCents ?? 0,
    spentTodayCents,
    balanceCents: wallet?.balanceCents ?? 0,
    sponsoredLast30Days,
  };
}
