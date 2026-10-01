"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ReactionKind, Surface } from "@/generated/prisma/enums";
import { track } from "@/modules/analytics/track";
import { getViewer, requireOnboardedViewer } from "@/modules/identity/session";
import {
  notifyComment,
  notifyReaction,
  removeReactionNotification,
} from "@/modules/notifications/notify";
import { isProofMediaLinkError, proofMediaIdsAmong } from "@/modules/trust/proof-media";
import { db } from "@/server/db";
import { checkSocialLimit } from "./limits";
import { reactionTops } from "./reaction-summary";
import { createPostSchema } from "./schemas";

export type ToggleResult =
  { ok: true; active: boolean; count: number } | { ok: false; error: string; needsAuth?: boolean };

const AUTH_REQUIRED = {
  ok: false,
  error: "Inicia sesión para interactuar.",
  needsAuth: true,
} as const;
const id = z.uuid();
/** La superficie llega del cliente: un valor desconocido no rompe el registro del evento (SEC-38). */
const surfaceSchema = z.enum(Surface).catch("FEED");

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/** No existe o ya no cumple el filtro del `update` (p. ej. dejó de estar publicada). */
function isNotFound(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2025";
}

export type ReactResult =
  | { ok: true; kind: ReactionKind | null; count: number; top: ReactionKind[] }
  | { ok: false; error: string; needsAuth?: boolean };

const reactionSchema = z.enum(ReactionKind).nullable();

/**
 * Reaccionar a una publicación (ADR-054): una reacción por persona. Repetir la misma la quita (y
 * `null` también); otra distinta la cambia sin mover el total. El contador y el resumen se calculan
 * en la misma transacción. Quitar funciona aunque la publicación ya no esté visible.
 */
export async function reactAction(
  postId: string,
  kind: ReactionKind | null,
  surface: Surface = "FEED",
): Promise<ReactResult> {
  const viewer = await getViewer();
  if (!viewer) return AUTH_REQUIRED;
  if (!id.safeParse(postId).success) return { ok: false, error: "Publicación inválida." };
  const parsed = reactionSchema.safeParse(kind);
  if (!parsed.success) return { ok: false, error: "Reacción inválida." };
  const next = parsed.data;
  const limited = await checkSocialLimit("like", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };

  const key = { userId: viewer.userId, postId };
  const likeCount = { select: { likeCount: true, authorId: true } } as const;
  try {
    const result = await db.$transaction(async (tx) => {
      const existing = await tx.like.findUnique({
        where: { userId_postId: key },
        select: { kind: true },
      });
      const previous = existing?.kind ?? null;
      let count: number;
      let active: ReactionKind | null;
      let authorId: string;
      if (previous !== null && (next === null || next === previous)) {
        await tx.like.delete({ where: { userId_postId: key } });
        const post = await tx.post.update({
          where: { id: postId },
          data: { likeCount: { decrement: 1 } },
          ...likeCount,
        });
        count = post.likeCount;
        authorId = post.authorId;
        active = null;
      } else if (previous !== null && next !== null) {
        await tx.like.update({ where: { userId_postId: key }, data: { kind: next } });
        const post = await tx.post.findUniqueOrThrow({ where: { id: postId }, ...likeCount });
        count = post.likeCount;
        authorId = post.authorId;
        active = next;
      } else if (next !== null) {
        const post = await tx.post.update({
          where: { id: postId, status: "PUBLISHED" },
          data: { likeCount: { increment: 1 } },
          ...likeCount,
        });
        await tx.like.create({ data: { ...key, kind: next } });
        count = post.likeCount;
        authorId = post.authorId;
        active = next;
      } else {
        const post = await tx.post.findUniqueOrThrow({ where: { id: postId }, ...likeCount });
        count = post.likeCount;
        authorId = post.authorId;
        active = null;
      }
      const top = (await reactionTops(tx, [postId])).get(postId) ?? [];
      return { previous, kind: active, count, top, authorId };
    });
    if (result.kind !== result.previous) {
      const reaction = result.kind ?? result.previous;
      track({
        type: result.kind ? "LIKE" : "UNLIKE",
        userId: viewer.userId,
        entityType: "POST",
        entityId: postId,
        sourcePostId: postId,
        surface: surfaceSchema.parse(surface),
        metadata: {
          ...(reaction ? { reaction } : {}),
          ...(result.kind && result.previous && result.previous !== result.kind
            ? { replaced: result.previous }
            : {}),
        },
      });
    }
    // Aviso a quien publicó (ADR-059): uno por persona; quitar la reacción lo quita.
    if (result.kind) {
      await notifyReaction({
        recipientId: result.authorId,
        actorId: viewer.userId,
        postId,
        reaction: result.kind,
      });
    } else if (result.previous) {
      await removeReactionNotification({ actorId: viewer.userId, postId });
    }
    return { ok: true, kind: result.kind, count: result.count, top: result.top };
  } catch (error) {
    // Dos toques a la vez: el segundo pierde la carrera y la interfaz conserva lo que ya tenía.
    if (isUniqueViolation(error)) return { ok: true, kind: next, count: -1, top: [] };
    if (isNotFound(error)) return { ok: false, error: "Esta publicación ya no está disponible." };
    return { ok: false, error: "No pudimos registrar tu reacción. Intenta de nuevo." };
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
  const limited = await checkSocialLimit("save", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };
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
      surface: surfaceSchema.parse(surface),
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
  const limited = await checkSocialLimit("comment", viewer.userId);
  if (!limited.ok) return { error: limited.error };
  // El mismo texto dos veces seguidas en la misma publicación es un doble envío o spam.
  const last = await db.comment.findFirst({
    where: { postId: parsed.data.postId, authorId: viewer.userId },
    orderBy: { createdAt: "desc" },
    select: { body: true },
  });
  if (last?.body === parsed.data.body) return { error: "Ya publicaste ese comentario." };

  let created: { commentId: string; authorId: string };
  try {
    const [comment, post] = await db.$transaction([
      db.comment.create({
        data: { postId: parsed.data.postId, authorId: viewer.userId, body: parsed.data.body },
        select: { id: true },
      }),
      db.post.update({
        where: { id: parsed.data.postId, status: "PUBLISHED" },
        data: { commentCount: { increment: 1 } },
        select: { authorId: true },
      }),
    ]);
    created = { commentId: comment.id, authorId: post.authorId };
  } catch {
    return { error: "No pudimos publicar tu comentario." };
  }
  // Aviso a quien publicó (ADR-059).
  await notifyComment({
    recipientId: created.authorId,
    actorId: viewer.userId,
    postId: parsed.data.postId,
    commentId: created.commentId,
  });
  track({
    type: "COMMENT",
    userId: viewer.userId,
    entityType: "POST",
    entityId: parsed.data.postId,
    sourcePostId: parsed.data.postId,
    surface: "POST_PAGE",
  });
  revalidatePath(`/p/${parsed.data.postId}`);
  // El panel de comentarios (ADR-057) vive en su propia ruta: también se refresca.
  revalidatePath(`/p/${parsed.data.postId}/comentarios`);
  return { ok: true };
}

export type CreatePostState = { error?: string; fieldErrors?: Partial<Record<string, string[]>> };

const INVALID_IMAGE = "Alguna imagen no es válida.";
const HIDDEN_PRODUCT =
  "Ese producto está oculto por moderación y no se puede publicar. Revisa su estado en Studio → Productos.";

export async function createPostAction(
  _previous: CreatePostState,
  formData: FormData,
): Promise<CreatePostState> {
  const viewer = await requireOnboardedViewer("/crear/publicacion");
  const parsed = createPostSchema.safeParse({
    body: formData.get("body"),
    communitySlug: formData.get("communitySlug") || undefined,
    mediaIds: formData.getAll("mediaIds"),
    videoId: formData.get("videoId") || undefined,
    productId: formData.get("productId") || undefined,
  });
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  }
  const { body, communitySlug, mediaIds, videoId, productId } = parsed.data;
  const limited = await checkSocialLimit("post", viewer.userId);
  if (!limited.ok) return { error: limited.error };

  // Autorización: solo imágenes propias y productos propios (evita adjuntar contenido ajeno).
  const [media, video, community, product] = await Promise.all([
    db.media.findMany({
      where: { id: { in: mediaIds }, ownerId: viewer.userId, status: "READY", kind: "IMAGE" },
      select: { id: true },
    }),
    // Un video propio, ya revisado por el servidor (ADR-062).
    videoId
      ? db.media.findFirst({
          where: { id: videoId, ownerId: viewer.userId, status: "READY", kind: "VIDEO" },
          select: { id: true },
        })
      : null,
    communitySlug
      ? db.community.findUnique({ where: { slug: communitySlug }, select: { id: true } })
      : null,
    productId
      ? db.product.findFirst({
          where: { id: productId, seller: { userId: viewer.userId } },
          select: { id: true, moderationStatus: true },
        })
      : null,
  ]);
  if (media.length !== mediaIds.length) return { error: INVALID_IMAGE };
  if (videoId && !video) return { error: "El video no es válido. Vuelve a subirlo." };
  // Una foto de comprobante de autenticidad (vigente o reemplazada) nunca se publica (P14).
  if ((await proofMediaIdsAmong(db, mediaIds)).size > 0) return { error: INVALID_IMAGE };
  if (productId && !product) return { error: "Ese producto no es tuyo." };
  // Un producto oculto por moderación no se promociona (el selector ya no lo ofrece; esto cubre un
  // formulario viejo o manipulado). El equipo lo revisa: el vendedor lo ve en Studio → Productos.
  if (product?.moderationStatus === "HIDDEN") return { error: HIDDEN_PRODUCT };

  let post: { id: string };
  try {
    post = await db.post.create({
      data: {
        authorId: viewer.userId,
        body,
        communityId: community?.id ?? null,
        productId: product?.id ?? null,
        ...(video
          ? { type: "VIDEO" as const, media: { create: [{ mediaId: video.id, position: 0 }] } }
          : { media: { create: mediaIds.map((mediaId, position) => ({ mediaId, position })) } }),
      },
      select: { id: true },
    });
  } catch (error) {
    // Se guardó como comprobante mientras tanto: el trigger `reject_proof_media_link` lo rechaza.
    if (isProofMediaLinkError(error)) return { error: INVALID_IMAGE };
    throw error;
  }
  redirect(`/p/${post.id}` as Route);
}
