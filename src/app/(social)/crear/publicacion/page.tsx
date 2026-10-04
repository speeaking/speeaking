import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { NewPost, productSlugParam } from "@/modules/social/components/new-post";

export const metadata: Metadata = { title: "Nueva publicación" };

/**
 * La página completa para escribir (enlaces directos y recargas). Desde el feed y desde «Crear» se
 * abre la misma en una ventana encima, sin salir de donde estabas (ADR-068, `@modal`).
 */
export default async function NewPostPage({ searchParams }: PageProps<"/crear/publicacion">) {
  const { producto, tipo, comunidad } = await searchParams;
  return (
    <>
      <PageHeader title="Nueva publicación" />
      <div className="px-4 md:px-0">
        <NewPost
          productSlug={productSlugParam(producto)}
          defaultMedia={tipo === "video" ? "video" : "photos"}
          communitySlug={typeof comunidad === "string" ? comunidad : undefined}
        />
      </div>
    </>
  );
}
