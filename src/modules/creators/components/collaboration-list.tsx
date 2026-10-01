import { Handshake } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { UserAvatar } from "@/components/brand/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import type { CreatorPostDTO, StoreCollaborationDTO } from "../service";
import { CollaborationActions } from "./collaboration-actions";
import { PostMetricsList } from "./post-metrics";

/** Lo que se lee de la publicación: su texto, o qué es si no trae texto. */
function PostQuote({
  post,
}: {
  post: { postId: string; excerpt: string | null; isVideo: boolean };
}) {
  return (
    <Link
      href={`/p/${post.postId}` as Route}
      className="line-clamp-2 text-sm text-muted-foreground hover:text-foreground hover:underline"
    >
      {post.excerpt
        ? `«${post.excerpt}»`
        : post.isVideo
          ? "Publicación con video"
          : "Publicación con fotos"}
      <span className="sr-only"> (ver publicación)</span>
    </Link>
  );
}

function Meta({ publishedAt, collaboration }: { publishedAt: string; collaboration: boolean }) {
  return (
    <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground">
      <time dateTime={publishedAt}>{formatRelativeTime(new Date(publishedAt))}</time>
      {collaboration ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-semibold text-ink-2">
          <Handshake aria-hidden="true" className="size-3" />
          Colaboración
        </span>
      ) : null}
    </p>
  );
}

const card = "flex flex-col gap-3 rounded-3xl border bg-card p-4";

/** Panel de la tienda (ADR-063): publicaciones de otras personas que etiquetan sus productos. */
export function StoreCollaborationList({ posts }: { posts: readonly StoreCollaborationDTO[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {posts.map((post) => (
        <li key={post.postId} className={card}>
          <div className="flex items-start gap-3">
            <UserAvatar
              name={post.author.displayName}
              seed={post.author.username}
              src={post.author.avatarUrl}
              className="size-10"
            />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="text-sm leading-snug">
                <Link
                  href={`/u/${post.author.username}` as Route}
                  className="font-semibold hover:underline"
                >
                  {post.author.displayName}
                </Link>{" "}
                etiquetó{" "}
                <Link
                  href={`/producto/${post.product.slug}` as Route}
                  className="font-semibold hover:underline"
                >
                  {post.product.title}
                </Link>
              </p>
              <PostQuote post={post} />
              <Meta publishedAt={post.publishedAt} collaboration={post.collaboration} />
            </div>
          </div>
          <PostMetricsList
            metrics={post.metrics}
            label={`Lo que logró la publicación de ${post.author.displayName}`}
          />
          <CollaborationActions postId={post.postId} collaboration={post.collaboration} canRemove />
        </li>
      ))}
    </ul>
  );
}

/** Sección de creadores (ADR-063): las publicaciones propias que etiquetan productos de tiendas. */
export function CreatorPostList({ posts }: { posts: readonly CreatorPostDTO[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {posts.map((post) => (
        <li key={post.postId} className={card}>
          <div className="flex min-w-0 flex-col gap-1">
            <p className="text-sm leading-snug">
              <Link
                href={`/producto/${post.product.slug}` as Route}
                className="font-semibold hover:underline"
              >
                {post.product.title}
              </Link>{" "}
              <span className="text-muted-foreground">de {post.product.storeName}</span>
            </p>
            <PostQuote post={post} />
            <Meta publishedAt={post.publishedAt} collaboration={post.collaboration} />
          </div>
          <PostMetricsList
            metrics={post.metrics}
            label={`Lo que logró tu publicación de ${post.product.title}`}
          />
          <CollaborationActions postId={post.postId} collaboration={post.collaboration} />
        </li>
      ))}
    </ul>
  );
}
