import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { CommunityForm } from "@/modules/communities/components/community-form";
import { NO_INDEX } from "@/app/seo";

export const metadata: Metadata = { title: "Crear comunidad", robots: NO_INDEX };
export default async function CreateCommunityPage() {
  await requireOnboardedViewer("/crear/comunidad");
  return (
    <>
      <PageHeader
        title="Crea tu comunidad"
        description="Reúne a quienes comparten tus intereses."
      />
      <div className="px-4 pb-6 md:px-0">
        <CommunityForm />
      </div>
    </>
  );
}
