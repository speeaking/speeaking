import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { PROFILE_TRANSITION } from "@/lib/page-turn";
import { cn } from "@/lib/utils";
import type { CommentDTO } from "../comment-queries";

/**
 * Comentarios de una publicación, del más antiguo al más nuevo (como una conversación). Lo pintan la
 * página de la publicación y el panel de comentarios (ADR-057). Cada nombre abre el perfil pasando
 * la página (ADR-055).
 */
export function CommentList({
  comments,
  className,
}: {
  comments: readonly CommentDTO[];
  className?: string;
}) {
  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {comments.map((comment) => (
        <li
          key={comment.id}
          className="flex gap-3 motion-safe:animate-in motion-safe:duration-300 motion-safe:fade-in"
        >
          <UserAvatar
            name={comment.author.displayName}
            seed={comment.author.username}
            src={comment.author.avatarUrl}
            className="size-8"
          />
          <div className="flex min-w-0 flex-col gap-0.5">
            <p className="text-sm">
              <Link
                href={`/u/${comment.author.username}` as Route}
                transitionTypes={PROFILE_TRANSITION}
                className="font-semibold"
              >
                {comment.author.displayName}
              </Link>{" "}
              <span className="text-xs text-muted-foreground">
                {formatRelativeTime(new Date(comment.createdAt))}
              </span>
            </p>
            <p className="text-[15px] break-words whitespace-pre-line">{comment.body}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}
