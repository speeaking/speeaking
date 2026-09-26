import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CSSProperties } from "react";
import { z } from "zod";
import { UserAvatar } from "@/components/brand/user-avatar";
import { formatRelativeTime } from "@/lib/format";
import { track } from "@/modules/analytics/track";
import { JoinPrompt, joinHref } from "@/modules/feed/components/join-prompt";
import { getMoreFromCommunity } from "@/modules/feed/home";
import { getViewer } from "@/modules/identity/session";
import { listComments } from "@/modules/social/comment-queries";
import { CommentForm } from "@/modules/social/components/comment-form";
import { JoinButton } from "@/modules/social/components/join-button";
import { PostCard } from "@/modules/social/components/post-card";
import { hydratePosts } from "@/modules/social/post-queries";

async function loadPost(id: string, viewerId: string | null) {
  if (!z.uuid().safeParse(id).success) return null;
  const [post] = await hydratePosts([id], viewerId);
  return post ?? null;
}

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id, null);
  if (!post) return {};
  const title = `${post.author.displayName}: ${post.body.slice(0, 60) || "Publicación"}`;
  const image = post.media[0];
  return {
    title,
    description: post.body.slice(0, 160),
    openGraph: {
      title,
      description: post.body.slice(0, 160),
      images: image ? [{ url: image.url, width: image.width, height: image.height }] : undefined,
    },
  };
}

/** Enlace de texto con 44 px al tacto sin mover la línea. */
const inlineLink = "-my-3 inline-block py-3 font-semibold text-foreground underline";

/**
 * Página de una publicación: también es la puerta de entrada de los enlaces compartidos (P1). La
 * visitante ve la publicación completa, una invitación a unirse a su comunidad y «Más de…».
 */
export default async function PostPage({ params, searchParams }: PageProps<"/p/[id]">) {
  const { id } = await params;
  // `?foto=3`: la foto que se tocó en el collage del feed (el carrusel la acota a las que hay).
  const { foto } = await searchParams;
  const photo = z.coerce.number().int().min(1).safeParse(foto);
  const viewer = await getViewer();
  const viewerId = viewer?.userId ?? null;
  const post = await loadPost(id, viewerId);
  if (!post) notFound();

  const postPath = `/p/${post.id}`;
  const community = post.community;
  const [comments, more] = await Promise.all([
    listComments(post.id),
    community ? getMoreFromCommunity(community.slug, post.id, viewerId) : null,
  ]);
  track({
    type: "VIEW",
    userId: viewerId,
    entityType: "POST",
    entityId: post.id,
    sourcePostId: post.id,
    surface: "POST_PAGE",
  });

  // Terminar el perfil y volver aquí, con la comunidad de la publicación ya marcada.
  const finishProfileParams = new URLSearchParams({ next: postPath });
  if (community) finishProfileParams.set("unirse", community.slug);

  return (
    <div className="flex flex-col gap-4 pb-4 md:pt-2">
      <PostCard
        post={post}
        expanded
        initialMediaIndex={photo.success ? photo.data - 1 : 0}
        isSignedIn={viewer !== null}
      />
      {viewer ? null : <JoinPrompt postPath={postPath} community={community} />}
      <section aria-labelledby="comentarios" className="flex flex-col gap-4 px-4 md:px-0">
        <h2 id="comentarios" className="text-lg font-bold">
          {/* El mismo total que la tarjeta («Comentar, 2 comentarios»), no el de la lista, que se
              corta en 100. Sin comentarios no se muestra un cero (principio 5). */}
          Comentarios{post.stats.comments > 0 ? ` (${post.stats.comments})` : ""}
        </h2>
        {/* `#comentar`: destino de «¿Qué opinas?» y del ícono de comentar en las tarjetas. */}
        {viewer?.profile?.onboarded ? (
          <CommentForm postId={post.id} id="comentar" />
        ) : viewer ? (
          // Con sesión pero sin perfil: «Entra» sería falso, ya entró; le falta terminar su perfil.
          <p id="comentar" className="scroll-mt-24 text-sm text-muted-foreground">
            <Link href={`/bienvenida?${finishProfileParams}` as Route} className={inlineLink}>
              Termina tu perfil para comentar
            </Link>
          </p>
        ) : (
          <p id="comentar" className="scroll-mt-24 text-sm text-muted-foreground">
            <Link href={joinHref(postPath, community)} className={inlineLink}>
              Crea tu cuenta gratis
            </Link>{" "}
            para comentar. ¿Ya tienes cuenta?{" "}
            <Link
              href={`/entrar?next=${encodeURIComponent(postPath)}` as Route}
              // Palabra corta: también 44 px de ancho al tacto.
              className={`${inlineLink} -mx-1.5 px-1.5`}
            >
              Entra
            </Link>
          </p>
        )}
        {comments.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {comments.map((comment) => (
              <li key={comment.id} className="flex gap-3">
                <UserAvatar
                  name={comment.author.displayName}
                  seed={comment.author.username}
                  src={comment.author.avatarUrl}
                  className="size-8"
                />
                <div className="flex flex-col gap-0.5">
                  <p className="text-sm">
                    <Link href={`/u/${comment.author.username}` as Route} className="font-semibold">
                      {comment.author.displayName}
                    </Link>{" "}
                    <span className="text-xs text-muted-foreground">
                      {formatRelativeTime(new Date(comment.createdAt))}
                    </span>
                  </p>
                  <p className="text-[15px] whitespace-pre-line">{comment.body}</p>
                </div>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

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
