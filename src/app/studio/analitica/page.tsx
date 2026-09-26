import { ChartColumn } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";

export const metadata: Metadata = { title: "Analítica" };

export default function StudioAnalyticsPage() {
  return (
    <>
      <PageHeader title="Analítica" className="px-0 pt-0" />
      <EmptyState
        icon={ChartColumn}
        title="Tu analítica"
        description="Visitas, conversión y beneficio por producto y por publicación."
      />
    </>
  );
}
