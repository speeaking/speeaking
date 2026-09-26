import { Check, Circle, Package, Sparkles } from "lucide-react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { sellerActivationSteps } from "@/modules/analytics/seller-metrics";
import { getSellerDashboard } from "@/modules/analytics/seller-queries";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

const SURFACE_LABELS: Record<string, string> = {
  FEED: "Desde el feed",
  SHARE_LINK: "Links compartidos",
  PRODUCT_PAGE: "Directo",
  SHOP: "Comprar",
  COMMUNITY: "Comunidades",
};

export default async function StudioPage() {
  const viewer = await requireOnboardedViewer("/studio");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;

  const metrics = await getSellerDashboard(viewer.sellerProfileId);
  const steps = sellerActivationSteps({
    products: metrics.totalProducts,
    shares: metrics.shares,
    paidOrders: metrics.orders,
  });
  const nextStep = steps.find((step) => !step.done);

  const kpis = [
    { label: "Ventas", value: formatMoney(metrics.revenueCents) },
    { label: "Pedidos", value: String(metrics.orders) },
    { label: "Productos activos", value: String(metrics.activeProducts) },
    { label: "Visitas", value: String(metrics.visits) },
    { label: "Conversión", value: `${metrics.conversion.toFixed(1)} %` },
    { label: "Ventas por contenido", value: String(metrics.attributedOrders) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resumen"
        description={`Últimos ${metrics.days} días`}
        className="px-0 pt-0"
        actions={
          <Link href="/studio/vende-con-ia" className={buttonVariants()}>
            <Sparkles data-icon="inline-start" />
            Vende con IA
          </Link>
        }
      />

      <section className="dark flex flex-col gap-1 rounded-3xl border bg-card p-5 text-foreground">
        <p className="text-sm text-muted-foreground">Tu beneficio estimado</p>
        <p className="font-heading text-4xl font-extrabold">{formatMoney(metrics.profitCents)}</p>
        <p className="text-xs text-muted-foreground">
          Ventas − costo de tus productos − comisiones (procesador estimado en{" "}
          {(metrics.estimatedPaymentFeeBps / 100).toFixed(1)} %). Calculado con tus datos, no por
          IA.
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-3">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
            <dd className="font-heading text-2xl font-extrabold">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      {nextStep ? (
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Tu camino a la primera venta</h2>
          <ol className="flex flex-col gap-2">
            {steps.map((step) => (
              <li
                key={step.id}
                className={cn(
                  "flex items-center gap-2 text-sm",
                  step.done && "text-muted-foreground line-through",
                )}
              >
                {step.done ? (
                  <Check className="size-4 text-success" />
                ) : (
                  <Circle className="size-4" />
                )}
                {step.label}
              </li>
            ))}
          </ol>
          {nextStep.id === "product" ? (
            <div className="flex flex-wrap gap-2">
              <Link href="/studio/vende-con-ia" className={buttonVariants()}>
                <Sparkles data-icon="inline-start" />
                Crear con IA
              </Link>
              <Link
                href="/studio/productos/nuevo"
                className={buttonVariants({ variant: "outline" })}
              >
                <Package data-icon="inline-start" />
                Crear manualmente
              </Link>
            </div>
          ) : nextStep.id === "share" ? (
            <Link href="/studio/productos" className={buttonVariants({ className: "self-start" })}>
              Compartir mis productos
            </Link>
          ) : null}
        </section>
      ) : null}

      {metrics.visitsBySurface.length > 0 ? (
        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">¿De dónde llegan tus visitas?</h2>
          <ul className="flex flex-col gap-2 text-sm">
            {metrics.visitsBySurface.map((row) => (
              <li key={row.surface ?? "otro"} className="flex justify-between">
                <span>{SURFACE_LABELS[row.surface ?? ""] ?? "Otro"}</span>
                <span className="font-semibold">{row.count}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
