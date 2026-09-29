import { Megaphone } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { FeatureForm } from "@/modules/billing/components/feature-form";
import { FEATURED_DAY_PRICE_CENTS } from "@/modules/billing/pricing";
import { getWallet, listSellerFeatured } from "@/modules/billing/service";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Campañas" };

const dateFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeZone: "America/Mexico_City",
});

/**
 * Campañas (ADR-046): hoy, «Destacar» un producto por días desde el saldo de la tienda. Aparece
 * como «Patrocinado» en la columna derecha, junto a otros productos y arriba de Comprar. Impulsar
 * (publicidad por resultado, P12) llega con tráfico.
 */
export default async function StudioCampaignsPage() {
  const viewer = await requireOnboardedViewer("/studio/campanas");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  const [products, wallet] = await Promise.all([
    listSellerFeatured(viewer.userId),
    getWallet(viewer.userId),
  ]);
  const active = products.filter((product) => product.daysLeft > 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Campañas"
        description={`Destaca un producto por ${formatMoney(FEATURED_DAY_PRICE_CENTS)} al día: sale como «Patrocinado» en la columna de la derecha, junto a otros productos y arriba de Comprar.`}
        className="px-0 pt-0"
        actions={
          <Link href={"/studio/saldo" as Route} className={buttonVariants({ variant: "outline" })}>
            Saldo: {formatMoney(wallet.balanceCents)}
          </Link>
        }
      />

      {products.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Publica un producto para destacarlo"
          description="Solo se destacan productos activos, con existencias y visibles."
          action={
            <Link href="/studio/sube-y-vende" className={buttonVariants()}>
              Sube y vende
            </Link>
          }
        />
      ) : (
        <>
          {active.length > 0 ? (
            <p role="status" className="rounded-2xl bg-secondary px-4 py-3 text-sm">
              {active.length === 1
                ? "Tienes 1 producto destacado."
                : `Tienes ${active.length} productos destacados.`}{" "}
              Los días se suman si vuelves a destacar antes de que venza.
            </p>
          ) : null}
          <ul className="flex flex-col gap-3">
            {products.map((product) => (
              <li
                key={product.id}
                className="flex flex-col gap-3 rounded-3xl border bg-card p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <Link
                    href={`/producto/${product.slug}` as Route}
                    className="truncate font-semibold hover:underline"
                  >
                    {product.title}
                  </Link>
                  <span className="text-xs text-muted-foreground">
                    {product.daysLeft > 0 && product.featuredUntil
                      ? `Destacado hasta el ${dateFormat.format(new Date(product.featuredUntil))} · ${product.daysLeft === 1 ? "1 día" : `${product.daysLeft} días`}`
                      : "Sin destacar"}
                    {" · "}
                    {product.visitsFromFeatured === 1
                      ? "1 visita desde un destacado"
                      : `${product.visitsFromFeatured} visitas desde destacados`}{" "}
                    (30 días)
                  </span>
                  {!product.sellable ? (
                    <span className="text-xs text-destructive">
                      Pausado, agotado u oculto: no se muestra aunque tenga días.
                    </span>
                  ) : null}
                </div>
                {product.sellable ? (
                  <FeatureForm
                    productId={product.id}
                    title={product.title}
                    balanceCents={wallet.balanceCents}
                  />
                ) : null}
              </li>
            ))}
          </ul>
        </>
      )}

      <p className="text-xs text-muted-foreground">
        Presupuesto, no planes: pagas los días por adelantado desde tu saldo y se rotan con los
        demás destacados. Un producto que pauses u ocultemos deja de mostrarse sin devolución de los
        días. Impulsar (publicidad por resultados) llegará cuando haya tráfico.
      </p>
    </div>
  );
}
