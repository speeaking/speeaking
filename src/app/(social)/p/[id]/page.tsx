import type { Metadata } from "next";
import { pageMetadata, NO_INDEX } from "@/app/seo";
import { Suspense } from "react";
import { FeedSkeleton } from "@/components/states/feed-skeleton";
import { PostDetail } from "@/modules/social/components/post-detail";
import { getVisiblePost } from "./post";
import { getProfileIndexing } from "../../u/[username]/profile";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await getVisiblePost(id);
  if (!post) return { robots: NO_INDEX };
  const visibility = await getProfileIndexing(post.author.username);
  const title = `${post.author.displayName}: ${post.body.slice(0, 60) || "Publicación"}`;
  // Un video (ADR-062) se comparte con su portada.
  const image = post.media[0] ?? post.video?.poster ?? undefined;
  return pageMetadata({
    title,
    description: post.body || `Publicación de ${post.author.displayName} en speeaking.`,
    path: `/p/${encodeURIComponent(id)}`,
    noIndex: !visibility?.discoverable || !visibility.onboardedAt,
    image: image ? { ...image, alt: title } : undefined,
  });
}

/**
 * Página de una publicación (enlace compartido o recarga): el cuerpo vive en `PostDetail`. Que
 * exista ya lo comprobó el layout. El esqueleto va aquí y no en un `loading.tsx` del segmento, que
 * también envolvería /p/[id]/comentarios y volvería «suave» (200) su redirección.
 */
export default async function PostPage({ params, searchParams }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const { foto } = await searchParams;
  return (
    <Suspense fallback={<FeedSkeleton />}>
      <PostDetail id={id} photo={foto} />
    </Suspense>
  );
}
