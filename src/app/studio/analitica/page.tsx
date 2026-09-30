import { ChartColumn } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Analítica" };

/**
 * Todavía sin métricas, pero con la misma guardia que sus hermanas de Studio: la redirección por
 * cookie del proxy es optimista; la sesión y la tienda se validan aquí, en el servidor, para que el
 * día que reciba números reales no dependa de acordarse.
 */
export default async function StudioAnalyticsPage() {
  const viewer = await requireOnboardedViewer("/studio/analitica");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
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
