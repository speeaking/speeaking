"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import type { Surface } from "@/generated/prisma/enums";
import { track } from "@/modules/analytics/track";
import { getViewer, requireOnboardedViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { createPostSchema } from "./schemas";

export type ToggleResult =
  { ok: true; active: boolean; count: number } | { ok: false; error: string; needsAuth?: boolean };

const AUTH_REQUIRED = {
  ok: false,
  error: "Inicia sesión para interactuar.",
  needsAuth: true,
} as const;
const id = z.uuid();

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** No existe o ya no cumple el filtro del `update` (p. ej. dejó de estar publicada). */
function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

/** Like / quitar like (idempotente; el contador se ajusta en la misma transacción). */
export async function toggleLikeAction(
  postId: string,
  surface: Surface = "FEED",
): Promise<ToggleResult> {
  const viewer = await getViewer();
  if (!viewer) return AUTH_REQUIRED;
  if (!id.safeParse(postId).success) return { ok: false, error: "Publicación inválida." };

  const key = { userId: viewer.userId, postId };
  try {
    const result = await db.$transaction(async (tx) => {
      const removed = await tx.like.deleteMany({ where: key });
      const post = await tx.post.update({
        where: { id: postId, status: "PUBLISHED" },
        data: { likeCount: removed.count > 0 ? { decrement: 1 } : { increment: 1 } },
        select: { likeCount: true },
      });
      if (removed.count === 0) await tx.like.create({ data: key });
      return { active: removed.count === 0, count: post.likeCount };
    });
    track({
      type: result.active ? "LIKE" : "UNLIKE",
      userId: viewer.userId,
      entityType: "POST",
      entityId: postId,
      sourcePostId: postId,
      surface,
    });
    return { ok: true, ...result };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: true, active: true, count: -1 };
    return { ok: false, error: "No pudimos registrar tu like. Intenta de nuevo." };
  }
}

const saveTargetSchema = z.union([z.object({ postId: id }), z.object({ productId: id })]);

/** Lo que se puede guardar: publicaciones visibles y productos con página pública. */
const SAVABLE_PRODUCT_STATUSES = ["ACTIVE", "PAUSED", "SOLD_OUT"] as const;

/**
 * Guardar / quitar de guardados una publicación o un producto. Solo se guarda lo visible (una
 * publicación PUBLISHED o un producto con página pública); quitar de guardados siempre se puede,
 * aunque la publicación ya no esté visible.
 */
export async function toggleSaveAction(
  target: { postId: string } | { productId: string },
  surface: Surface = "FEED",
): Promise<ToggleResult> {
  const viewer = await getViewer();
  if (!viewer) return AUTH_REQUIRED;
  // El objeto llega del cliente: se valida su forma antes de usarlo (un `null` no rompe la acción).
  const parsed = saveTargetSchema.safeParse(target);
  if (!parsed.success) return { ok: false, error: "Elemento inválido." };
  const isPost = "postId" in parsed.data;
  const targetId = "postId" in parsed.data ? parsed.data.postId : parsed.data.productId;

  const where = isPost
    ? { userId: viewer.userId, postId: targetId }
    : { userId: viewer.userId, productId: targetId };
  try {
    const result = await db.$transaction(async (tx) => {
      const removed = await tx.savedItem.deleteMany({ where });
      const saving = removed.count === 0;
      const delta = saving ? { increment: 1 } : { decrement: 1 };
      // Al guardar, `update` exige que siga visible; si no, lanza P2025 y no se guarda nada.
      const count = isPost
        ? (
            await tx.post.update({
              where: { id: targetId, ...(saving ? { status: "PUBLISHED" as const } : {}) },
              data: { saveCount: delta },
              select: { saveCount: true },
            })
          ).saveCount
        : (
            await tx.product.update({
              where: {
                id: targetId,
                ...(saving ? { status: { in: [...SAVABLE_PRODUCT_STATUSES] } } : {}),
              },
              data: { saveCount: delta },
              select: { saveCount: true },
            })
          ).saveCount;
      if (removed.count === 0) await tx.savedItem.create({ data: where });
      return { active: removed.count === 0, count };
    });
    track({
      type: result.active ? "SAVE" : "UNSAVE",
      userId: viewer.userId,
      entityType: isPost ? "POST" : "PRODUCT",
      entityId: targetId,
      sourcePostId: isPost ? targetId : null,
      surface,
    });
    return { ok: true, ...result };
  } catch (error) {
    if (isUniqueViolation(error)) return { ok: true, active: true, count: -1 };
    if (isNotFound(error)) {
      return {
        ok: false,
        error: isPost
          ? "Esta publicación ya no está disponible."
          : "Este producto ya no está disponible.",
      };
    }
    return { ok: false, error: "No pudimos guardar. Intenta de nuevo." };
  }
}

const commentSchema = z.object({
  postId: z.uuid(),
  body: z.string().trim().min(1, "Escribe un comentario.").max(500, "Máximo 500 caracteres."),
});

export type CommentFormState = { error?: string; ok?: boolean };

export async function createCommentAction(
  _previous: CommentFormState,
  formData: FormData,
): Promise<CommentFormState> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return { error: "Inicia sesión para comentar." };
  const parsed = commentSchema.safeParse({
    postId: formData.get("postId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Comentario inválido." };

  try {
    await db.$transaction([
      db.comment.create({
        data: { postId: parsed.data.postId, authorId: viewer.userId, body: parsed.data.body },
      }),
      db.post.update({
        where: { id: parsed.data.postId, status: "PUBLISHED" },
        data: { commentCount: { increment: 1 } },
      }),
    ]);
  } catch {
    return { error: "No pudimos publicar tu comentario." };
  }
  track({
    type: "COMMENT",
    userId: viewer.userId,
    entityType: "POST",
    entityId: parsed.data.postId,
    sourcePostId: parsed.data.postId,
    surface: "POST_PAGE",
  });
  revalidatePath(`/p/${parsed.data.postId}`);
  return { ok: true };
}

export type CreatePostState = { error?: string; fieldErrors?: Partial<Record<string, string[]>> };

export async function createPostAction(
  _previous: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const viewer = await requireOnboardedViewer("/crear/publicacion");
  const parsed = createPostSchema.safeParse({
    body: formData.get("body"),
    communitySlug: formData.get("communitySlug") || undefined,
    mediaIds: formData.getAll("mediaIds"),
    productId: formData.get("productId") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { body, communitySlug, mediaIds, productId } = parsed.data;

  // Autorización: solo imágenes propias y productos propios (evita adjuntar contenido ajeno).
  const [media, community, product] = await Promise.all([
    db.media.findMany({
      where: { id: { in: mediaIds }, ownerId: viewer.userId, status: "READY" },
      select: { id: true },
    }),
    communitySlug
      ? db.community.findUnique({ where: { slug: communitySlug }, select: { id: true } })
      : null,
    productId
      ? db.product.findFirst({
          where: { id: productId, seller: { userId: viewer.userId } },
          select: { id: true },
        })
      : null,
  ]);
  if (media.length !== mediaIds.length) return { error: "Alguna imagen no es válida." };
  if (productId && !product) return { error: "Ese producto no es tuyo." };

  const post = await db.post.create({
    data: {
      authorId: viewer.userId,
      body,
      communityId: community?.id ?? null,
      productId: product?.id ?? null,
      media: { create: mediaIds.map((mediaId, position) => ({ mediaId, position })) },
    },
    select: { id: true },
  });
  redirect(`/p/${post.id}` as Route);
}
