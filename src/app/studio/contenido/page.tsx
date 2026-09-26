import { Clapperboard } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = { title: "Contenido" };

export default function StudioContentPage() {
  return (
    <>
      <PageHeader title="Contenido" className="px-0 pt-0" />
      <EmptyState
        icon={Clapperboard}
        title="Tu contenido"
        description="Aquí verás tus publicaciones y cómo les va."
      />
    </>
  );
}
