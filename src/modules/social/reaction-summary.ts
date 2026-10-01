import type { Prisma } from "@/generated/prisma/client";
import type { db } from "@/server/db";
import { type ReactionKind, topReactions } from "./reactions";

type LikeClient = Pick<typeof db, "like"> | Pick<Prisma.TransactionClient, "like">;

/**
 * Resumen de reacciones por publicación (ADR-054): los tipos más usados, de mayor a menor. Una sola
 * consulta agrupada por lote de publicaciones (una página del feed, un perfil, una publicación).
 */
export async function reactionTops(
  client: LikeClient,
  postIds: readonly string[],
): Promise<Map<string, ReactionKind[]>> {
  const tops = new Map<string, ReactionKind[]>();
  if (postIds.length === 0) return tops;
  const rows = await client.like.groupBy({
    by: ["postId", "kind"],
    where: { postId: { in: [...postIds] } },
    _count: { _all: true },
  });
  const counts = new Map<string, Partial<Record<ReactionKind, number>>>();
  for (const row of rows) {
    const byKind = counts.get(row.postId) ?? {};
    byKind[row.kind] = row._count._all;
    counts.set(row.postId, byKind);
  }
  for (const [postId, byKind] of counts) tops.set(postId, topReactions(byKind));
  return tops;
}
