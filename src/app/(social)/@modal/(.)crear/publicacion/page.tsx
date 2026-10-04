import { RouteModal } from "@/components/layout/route-modal";
import { NewPost, productSlugParam } from "@/modules/social/components/new-post";

/**
 * Escribir una publicación en una ventana encima de donde estabas (ADR-068), como «Crear
 * publicación» de Facebook. La URL es la misma /crear/publicacion: recargar abre la página completa.
 * Al publicar, la publicación nueva se abre en su capa y, al cerrarla, sigues donde ibas.
 */
export default async function NewPostModalPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { producto, tipo, comunidad } = await searchParams;
  return (
    <RouteModal
      label="Crear publicación"
      match="/crear/publicacion"
      showTitle
      presentation="composer"
    >
      <div className="px-4 sm:px-6">
        <NewPost
          productSlug={productSlugParam(producto)}
          defaultMedia={tipo === "video" ? "video" : "photos"}
          communitySlug={typeof comunidad === "string" ? comunidad : undefined}
          inLayer
        />
      </div>
    </RouteModal>
  );
}
