import { Megaphone } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = { title: "Campañas" };

export default function StudioCampaignsPage() {
  return (
    <>
      <PageHeader title="Campañas" className="px-0 pt-0" />
      <EmptyState
        icon={Megaphone}
        title="Campañas con IA"
        description="Elige producto, objetivo y presupuesto; la IA propone la estrategia."
      />
    </>
  );
}
