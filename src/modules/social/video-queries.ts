import "server-only";
import { db } from "@/server/db";
import { postVisibleTo } from "@/modules/relationships/privacy";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import type { FeedItemDTO } from "@/modules/feed/dto";
import { hydratePosts } from "./post-queries";
import { decodeVideoCursor, encodeVideoCursor } from "./video-cursor";

const PAGE_SIZE = 12;
export type VideoPage = { items: FeedItemDTO[]; nextCursor: string | null };

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
      status: "PUBLISHED",
      publishedAt: { lte: new Date(asOf) },
      media: { some: { media: { kind: "VIDEO", status: "READY" } } },
      AND: [
        POST_WITH_VISIBLE_PRODUCT,
        postVisibleTo(viewerId),
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
