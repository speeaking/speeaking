import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { PhotoSearch } from "@/modules/search/components/photo-search";

export const metadata: Metadata = { title: "Buscar con una foto", robots: { index: false } };

/**
 * Búsqueda por foto (ADR-061). Pide sesión: cada búsqueda llama a un modelo que ve imágenes (con
 * cuota por persona y dentro del presupuesto de IA).
 */
export default async function PhotoSearchPage() {
  await requireOnboardedViewer("/buscar/foto");
  return (
    <div className="flex flex-col gap-2 px-4 pb-8 md:px-0">
      <PageHeader
        title="Buscar con una foto"
        description="Encuentra ropa y cosas parecidas a las de tu foto."
        className="px-0"
      />
      <PhotoSearch />
    </div>
  );
}
