import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { PLATFORM_ADMIN_EMAIL } from "@/modules/identity/platform-account";
import { postVisibleTo } from "@/modules/relationships/privacy";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import type { FeedItemDTO } from "@/modules/feed/dto";
import { hydratePosts } from "./post-queries";
import { decodeVideoCursor, encodeVideoCursor } from "./video-cursor";

const PAGE_SIZE = 12;
export type VideoPage = { items: FeedItemDTO[]; nextCursor: string | null };

function visibleVideos(viewerId: string | null): Prisma.PostWhereInput {
  return {
    status: "PUBLISHED",
    media: { some: { media: { kind: "VIDEO", status: "READY" } } },
    AND: [POST_WITH_VISIBLE_PRODUCT, postVisibleTo(viewerId)],
  };
}

/** Reels reales y listos, con la misma privacidad que el feed y paginación por fecha e ID. */
export async function listVideoPosts(
  viewerId: string | null,
  rawCursor?: string,
): Promise<VideoPage> {
  const cursor = rawCursor ? decodeVideoCursor(rawCursor) : null;
  if (rawCursor && !cursor) throw new Error("INVALID_VIDEO_CURSOR");
  const asOf = cursor?.asOf ?? new Date().toISOString();
  const rows = await db.post.findMany({
    where: {
      publishedAt: { lte: new Date(asOf) },
      AND: [
        visibleVideos(viewerId),
        ...(cursor
          ? [
              {
                OR: [
                  { publishedAt: { lt: new Date(cursor.at) } },
                  { publishedAt: new Date(cursor.at), id: { lt: cursor.id } },
                ],
              },
            ]
          : []),
      ],
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: PAGE_SIZE + 1,
    select: { id: true, publishedAt: true },
  });
  const selected = rows.slice(0, PAGE_SIZE);
  const last = selected.at(-1);
  const items = (
    await hydratePosts(
      selected.map((row) => row.id),
      viewerId,
    )
  ).filter((item) => Boolean(item.video));
  return {
    items,
    nextCursor:
      rows.length > PAGE_SIZE && last
        ? encodeVideoCursor({ asOf, at: last.publishedAt.toISOString(), id: last.id })
        : null,
  };
}

/** La última actualización oficial abre la vitrina; el resto son videos recientes visibles. */
export async function listHomeReelVideos(viewerId: string | null): Promise<{
  items: FeedItemDTO[];
  platformUpdateId: string | null;
}> {
  const [page, official] = await Promise.all([
    listVideoPosts(viewerId),
    db.post.findFirst({
      where: {
        AND: [visibleVideos(viewerId)],
        publishedAt: { lte: new Date() },
        author: {
          email: { equals: PLATFORM_ADMIN_EMAIL, mode: "insensitive" },
          profile: { role: "ADMIN" },
        },
      },
      orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
      select: { id: true },
    }),
  ]);
  const update = official
    ? (page.items.find((item) => item.id === official.id) ??
      (await hydratePosts([official.id], viewerId))[0])
    : undefined;
  if (!update?.video) return { items: page.items, platformUpdateId: null };
  return {
    items: [update, ...page.items.filter((item) => item.id !== update.id)].slice(0, PAGE_SIZE),
    platformUpdateId: update.id,
  };
}
