import { ChartColumn, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { FunnelCard } from "@/modules/analytics/components/funnel-card";
import { ProductActivityList } from "@/modules/analytics/components/product-activity-list";
import { getProductAnalytics } from "@/modules/analytics/seller-panel-queries";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Analítica" };

/**
 * Analítica (ADR-056): el embudo de la tienda y la actividad de cada producto en los últimos 30
 * días. La sesión y la tienda se validan aquí, en el servidor (la redirección del proxy es optimista).
 */
export default async function StudioAnalyticsPage() {
  const viewer = await requireOnboardedViewer("/studio/analitica");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  const analytics = await getProductAnalytics(viewer.sellerProfileId);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Analítica"
        description={`Últimos ${analytics.days} días`}
        className="px-0 pt-0"
      />
      {analytics.products.length === 0 ? (
        <EmptyState
          icon={ChartColumn}
          title="Todavía no hay números"
          description="Cuando publiques productos verás aquí sus visitas, guardados, pruebas y ventas."
          action={
            <Link href="/studio/sube-y-vende" className={buttonVariants()}>
              <Sparkles data-icon="inline-start" />
              Sube y vende
            </Link>
          }
        />
      ) : (
        <>
          <FunnelCard
            steps={analytics.funnel}
            days={analytics.days}
            ordersFromContent={analytics.ordersFromContent}
          />
          <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
            <div className="flex flex-col">
              <h2 className="font-heading text-lg font-bold">Por producto</h2>
              <p className="text-xs text-muted-foreground">
                De más visto a menos. «Pruebas» cuenta quién se lo probó con «Ver cómo me veo» o
                quiso hacerlo.
              </p>
            </div>
            <ProductActivityList rows={analytics.products} />
          </section>
        </>
      )}
    </div>
  );
}
