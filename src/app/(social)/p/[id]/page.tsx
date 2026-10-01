import type { Metadata } from "next";
import { loadPost, PostDetail } from "@/modules/social/components/post-detail";

export async function generateMetadata({ params }: PageProps<"/p/[id]">): Promise<Metadata> {
  const { id } = await params;
  const post = await loadPost(id, null);
  if (!post) return {};
  const title = `${post.author.displayName}: ${post.body.slice(0, 60) || "Publicación"}`;
  // Un video (ADR-062) se comparte con su portada.
  const image = post.media[0] ?? post.video?.poster ?? undefined;
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

/** Página de una publicación (enlace compartido o recarga): el cuerpo vive en `PostDetail`. */
export default async function PostPage({ params, searchParams }: PageProps<"/p/[id]">) {
  const { id } = await params;
  const { foto } = await searchParams;
  return <PostDetail id={id} photo={foto} />;
}
