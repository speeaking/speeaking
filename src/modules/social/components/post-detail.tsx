import type { Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { z } from "zod";
import { cn } from "@/lib/utils";
import { track } from "@/modules/analytics/track";
import { JoinPrompt } from "@/modules/feed/components/join-prompt";
import { getMoreFromCommunity } from "@/modules/feed/home";
import { getViewer } from "@/modules/identity/session";
import { listComments } from "../comment-queries";
import { CommentComposer } from "./comment-composer";
import { CommentList } from "./comment-list";
import { JoinButton } from "./join-button";
import { PostCard } from "./post-card";
import { hydratePosts } from "../post-queries";
import { ReportButton } from "@/modules/trust/components/report-button";

/** La publicación con su autor y su comunidad, o `null` si el id no es válido o no existe. */
export async function loadPost(id: string, viewerId: string | null) {
  if (!z.uuid().safeParse(id).success) return null;
  const [post] = await hydratePosts([id], viewerId);
  return post ?? null;
}

/**
 * Página de una publicación: también es la puerta de entrada de los enlaces compartidos (P1). La
 * visitante ve la publicación completa, una invitación a unirse a su comunidad y «Más de…».
 */
/**
 * Una publicación completa: tarjeta, reportar, invitación a unirse, comentarios y «Más de…». La
 * pinta la página /p/[id] (también la puerta de entrada de los enlaces compartidos, P1) y la capa que
 * se abre sobre el feed (ADR-052).
 */
export async function PostDetail({
  id,
  photo: foto,
  layer = false,
}: {
  id: string;
  /** `?foto=3`: la foto que se tocó en el collage del feed (el carrusel la acota a las que hay). */
  photo?: string | string[];
  /**
   * En la capa sobre el feed (ADR-064): sin «Más de…» (el feed ya está detrás) y, con fotos o video,
   * como visor en escritorio: la imagen a la izquierda y los comentarios a la derecha.
   */
  layer?: boolean;
}) {
  const photo = z.coerce.number().int().min(1).safeParse(foto);
  const viewer = await getViewer();
  const viewerId = viewer?.userId ?? null;
  const post = await loadPost(id, viewerId);
  if (!post) notFound();

  const postPath = `/p/${post.id}`;
  const community = post.community;
  const [comments, more] = await Promise.all([
    listComments(post.id),
    community && !layer ? getMoreFromCommunity(community.slug, post.id, viewerId) : null,
  ]);
  // En el visor, lo que sigue a la publicación va dentro de ella (su columna derecha).
  const theater = layer && (post.media.length > 0 || Boolean(post.video));
  const inset = theater ? undefined : "px-4 md:px-0";
  const extras = (
    <>
      {/* Reportar (P14): anónimo para quien publicó; lo propio no se reporta. */}
      {post.author.userId !== viewerId ? (
        <div className={cn("-mt-2 flex justify-end", inset)}>
          <ReportButton
            targetType="POST"
            targetId={post.id}
            isSignedIn={viewer !== null}
            returnTo={postPath}
          />
        </div>
      ) : null}
      {viewer ? null : (
        <JoinPrompt
          postPath={postPath}
          community={community}
          // En la columna angosta del visor va apilado y sin márgenes propios.
          className={theater ? "mx-0 md:flex-col md:items-stretch" : undefined}
        />
      )}
      <section aria-labelledby="comentarios" className={cn("flex flex-col gap-4", inset)}>
        <h2 id="comentarios" className="text-lg font-bold">
          {/* El mismo total que la tarjeta («Comentar, 2 comentarios»), no el de la lista, que se
              corta en 100. Sin comentarios no se muestra un cero (principio 5). */}
          Comentarios{post.stats.comments > 0 ? ` (${post.stats.comments})` : ""}
        </h2>
        <CommentComposer
          post={post}
          viewer={viewer ? { onboarded: Boolean(viewer.profile?.onboarded) } : null}
          anchorId="comentar"
        />
        {comments.length > 0 ? <CommentList comments={comments} /> : null}
      </section>
    </>
  );
  track({
    type: "VIEW",
    userId: viewerId,
    entityType: "POST",
    entityId: post.id,
    sourcePostId: post.id,
    surface: "POST_PAGE",
  });

  return (
    <div className={cn("flex flex-col gap-4 pb-4 md:pt-2", theater && "lg:gap-0 lg:p-0")}>
      <PostCard
        post={post}
        expanded
        initialMediaIndex={photo.success ? photo.data - 1 : 0}
        isSignedIn={viewer !== null}
        layout={theater ? "theater" : "card"}
      >
        {theater ? extras : null}
      </PostCard>
      {theater ? null : extras}

      {community && more && more.posts.length > 0 ? (
        <section
          aria-labelledby="mas-de-la-comunidad"
          className="mt-4 flex flex-col md:gap-4"
          style={{ "--hue": community.hue } as CSSProperties}
        >
          <div className="flex items-center justify-between gap-3 border-b px-4 pb-3 md:border-0 md:px-0 md:pb-0">
            <h2 id="mas-de-la-comunidad" className="text-xl font-extrabold">
              Más de{" "}
              <Link
                href={`/c/${community.slug}` as Route}
                className="community-text hover:underline"
              >
                {community.name}
              </Link>
            </h2>
            <JoinButton
              communityId={more.communityId}
              communityName={community.name}
              communitySlug={community.slug}
              initialJoined={more.joined}
              isSignedIn={viewer !== null}
              size="sm"
            />
          </div>
          {more.posts.map((item, index) => (
            <PostCard
              key={item.id}
              post={item}
              index={index}
              variant="standard"
              isSignedIn={viewer !== null}
            />
          ))}
          <Link
            href={`/c/${community.slug}` as Route}
            className="flex h-11 items-center justify-center px-4 text-sm font-bold community-text hover:underline"
          >
            Ver todo en {community.name}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
