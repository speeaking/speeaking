import { MessageCircle } from "lucide-react";
import { RouteDrawer } from "@/components/layout/route-drawer";
import { formatCompactNumber } from "@/lib/format";
import { getViewer } from "@/modules/identity/session";
import { listComments } from "@/modules/social/comment-queries";
import { CommentComposer } from "@/modules/social/components/comment-composer";
import { CommentList } from "@/modules/social/components/comment-list";
import { loadPost } from "@/modules/social/components/post-detail";
import { reactionMeta } from "@/modules/social/reactions";

/**
 * «Comentar» desde el feed abre los comentarios en un panel que sube desde abajo (ADR-057), como en
 * Facebook: la publicación sigue ahí detrás, se escribe con el pulgar y se cierra deslizando hacia
 * abajo o con «atrás». Recargar /p/[id]/comentarios abre la publicación completa en sus comentarios.
 */
export default async function CommentsLayerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const viewer = await getViewer();
  const post = await loadPost(id, viewer?.userId ?? null);
  if (!post) return null;
  const comments = await listComments(post.id);
  const { likes, comments: total, reactions } = post.stats;

  return (
    <RouteDrawer
      path={`/p/${post.id}/comentarios`}
      title={total > 0 ? `Comentarios (${total})` : "Comentarios"}
      meta={
        likes > 0 ? (
          <>
            <span aria-hidden="true">
              {reactions.map((kind) => reactionMeta(kind).emoji).join("")}
            </span>
            <span>
              {formatCompactNumber(likes)} {likes === 1 ? "reacción" : "reacciones"}
            </span>
          </>
        ) : undefined
      }
      footer={
        <CommentComposer
          post={post}
          viewer={viewer ? { onboarded: Boolean(viewer.profile?.onboarded) } : null}
          variant="panel"
        />
      }
    >
      {comments.length > 0 ? (
        <CommentList comments={comments} />
      ) : (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-foreground">
          <MessageCircle aria-hidden="true" className="size-8" />
          <p className="font-semibold text-foreground">Todavía no hay comentarios</p>
          <p className="text-sm">Sé la primera persona en comentar.</p>
        </div>
      )}
    </RouteDrawer>
  );
}
