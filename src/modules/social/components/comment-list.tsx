"use client";

import { useState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { UserAvatar } from "@/components/brand/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { PROFILE_TRANSITION } from "@/lib/page-turn";
import { cn } from "@/lib/utils";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { ReportButton } from "@/modules/trust/components/report-button";
import type { CommentDTO } from "../comment-queries";
import { MentionText } from "./mention-text";

/**
 * Comentarios de una publicación, del más antiguo al más nuevo (como una conversación). Lo pintan la
 * página de la publicación y el panel de comentarios (ADR-057). Cada nombre abre el perfil pasando
 * la página (ADR-055). El propio se puede borrar; el de otra persona, reportar (anónimo, P14).
 */
export function CommentList({
  comments,
  isSignedIn = true,
  className,
}: {
  comments: readonly CommentDTO[];
  /**
   * Sin sesión, «Reportar» lleva a iniciar sesión y regresa aquí. Si quien lo pinta no lo dice, se
   * abre el formulario y el servidor pide la sesión al enviarlo.
   */
  isSignedIn?: boolean;
  className?: string;
}) {
  const [removed, setRemoved] = useState<string[]>([]);
  const pathname = usePathname();
  return (
    <ul className={cn("flex flex-col gap-4", className)}>
      {comments
        .filter((comment) => !removed.includes(comment.id))
        .map((comment) => (
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
            <div className="flex min-w-0 flex-1 flex-col gap-0.5">
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
              <p className="text-[15px] break-words whitespace-pre-line">
                <MentionText text={comment.body} />
              </p>
            </div>
            {comment.canDelete ? (
              <RemoveContentButton
                kind="comment"
                id={comment.id}
                label="Eliminar mi comentario"
                compact
                onRemoved={() => setRemoved((current) => [...current, comment.id])}
              />
            ) : (
              <ReportButton
                targetType="COMMENT"
                targetId={comment.id}
                isSignedIn={isSignedIn}
                returnTo={pathname ?? "/"}
                compact
                label={`Reportar comentario de ${comment.author.displayName}`}
              />
            )}
          </li>
        ))}
    </ul>
  );
}
