import { RouteModal } from "@/components/layout/route-modal";
import { PostDetail } from "@/modules/social/components/post-detail";

/**
 * Una publicación abierta desde el feed se ve en capa, sin salir de donde estabas (ADR-052). La URL
 * es la misma /p/[id]: compartirla o recargar abre la página completa.
 */
export default async function PostModalPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const { foto } = await searchParams;
  return (
    <RouteModal label="Publicación" match="/p/">
      <PostDetail id={id} photo={foto} />
    </RouteModal>
  );
}
