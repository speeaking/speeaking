import "server-only";
import { db } from "@/server/db";

export type CommentDTO = {
  id: string;
  body: string;
  createdAt: string;
  author: { username: string; displayName: string; avatarUrl: string | null };
  canDelete?: boolean;
};

export async function listComments(
  postId: string,
  viewerId: string | null = null,
): Promise<CommentDTO[]> {
  const rows = await db.comment.findMany({
    where: { postId, status: "PUBLISHED" },
    orderBy: { createdAt: "asc" },
    take: 100,
    select: {
      id: true,
      body: true,
      createdAt: true,
      authorId: true,
      author: {
        select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } },
      },
    },
  });
  return rows.flatMap((row) =>
    row.author.profile
      ? [
          {
            id: row.id,
            body: row.body,
            createdAt: row.createdAt.toISOString(),
            author: row.author.profile,
            canDelete: row.authorId === viewerId,
          },
        ]
      : [],
  );
}
