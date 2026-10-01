import { Check, Circle, Package, Sparkles } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatCompactNumber, formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FunnelCard } from "@/modules/analytics/components/funnel-card";
import {
  type PendingItem,
  PendingCard,
  Sparkline,
  StatTile,
  TrendBadge,
} from "@/modules/analytics/components/panel-pieces";
import { formatHours, PerformanceCard } from "@/modules/analytics/components/performance-card";
import { ProductActivityList } from "@/modules/analytics/components/product-activity-list";
import { sellerActivationSteps } from "@/modules/analytics/seller-metrics";
import { PRODUCT_PENDINGS } from "@/modules/analytics/seller-panel";
import { getSellerPanel } from "@/modules/analytics/seller-panel-queries";
import { getSellerDashboard } from "@/modules/analytics/seller-queries";
import { countSimulatedSales } from "@/modules/commerce/seller-orders";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

const SURFACE_LABELS: Record<string, string> = {
  FEED: "Desde el feed",
  SHARE_LINK: "Links compartidos",
  PRODUCT_PAGE: "Directo",
  SHOP: "Comprar",
  COMMUNITY: "Comunidades",
};

const TOP_PRODUCTS = 5;

const productsFilter = (slug: string) => `/studio/productos?filtro=${slug}` as Route;

/**
 * Resumen del Studio (ADR-056), con lo más útil del panel de Mercado Libre adaptado a lo que sí
 * medimos: arriba ventas, pendientes, mensajes y visitas de 7 días; luego qué pide atención, el
 * beneficio (la métrica norte), el desempeño, el embudo y los productos más vistos.
 */
export default async function StudioPage() {
  const viewer = await requireOnboardedViewer("/studio");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;

  const [metrics, panel] = await Promise.all([
    getSellerDashboard(viewer.sellerProfileId),
    getSellerPanel(viewer.sellerProfileId, viewer.userId),
  ]);
  // Mismo periodo que el beneficio: ventas cuyo pago fue simulado (SEC-01).
  const simulatedSales = await countSimulatedSales(viewer.sellerProfileId, metrics.days);
  const steps = sellerActivationSteps({
    products: metrics.totalProducts,
    shares: metrics.shares,
    paidOrders: metrics.orders,
  });
  const nextStep = steps.find((step) => !step.done);
  const sales = panel.salesPendings;
  const catalog = panel.productPendings;

  const salesItems: PendingItem[] = [
    {
      label: "Por despachar",
      count: sales.toDispatch,
      href: "/studio/pedidos",
      detail:
        sales.oldestToDispatchHours !== null
          ? `El más antiguo lleva ${formatHours(sales.oldestToDispatchHours)}`
          : undefined,
    },
    {
      label: "En camino",
      count: sales.inTransit,
      href: "/studio/pedidos",
      detail: "Márcalos como entregados cuando lleguen",
    },
    {
      label: "Pagos simulados por cancelar",
      count: sales.simulatedToCancel,
      href: "/studio/pedidos",
      detail: "No se cobró dinero: cancélalos para recuperar las piezas",
    },
    {
      label: "Mensajes sin leer",
      count: panel.unreadMessages,
      href: "/mensajes",
    },
  ];
  const catalogItems: PendingItem[] = [
    {
      label: PRODUCT_PENDINGS.hidden.label,
      count: catalog.hidden,
      href: productsFilter(PRODUCT_PENDINGS.hidden.slug),
      detail: "No aparecen en ningún lado hasta que se resuelvan",
    },
    {
      label: PRODUCT_PENDINGS.soldOut.label,
      count: catalog.soldOut,
      href: productsFilter(PRODUCT_PENDINGS.soldOut.slug),
      detail: "Repón existencias o páusalos",
    },
    {
      label: PRODUCT_PENDINGS.needsProof.label,
      count: catalog.needsProof,
      href: productsFilter(PRODUCT_PENDINGS.needsProof.slug),
      detail: "Sube el comprobante que te pedimos",
    },
    {
      label: PRODUCT_PENDINGS.noPhoto.label,
      count: catalog.noPhoto,
      href: productsFilter(PRODUCT_PENDINGS.noPhoto.slug),
      detail: "Agrega al menos una foto",
    },
    {
      label: PRODUCT_PENDINGS.drafts.label,
      count: catalog.drafts,
      href: productsFilter(PRODUCT_PENDINGS.drafts.slug),
      detail: "Termínalos para publicarlos",
    },
  ];
  const topProducts = panel.products.slice(0, TOP_PRODUCTS);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Resumen"
        description={`Últimos ${panel.windowDays} días`}
        className="px-0 pt-0"
        actions={
          <Link href="/studio/sube-y-vende" className={buttonVariants()}>
            <Sparkles data-icon="inline-start" />
            Sube y vende
          </Link>
        }
      />

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
            <div className="flex flex-wrap items-center gap-3">
              <Link href="/studio/sube-y-vende" className={buttonVariants({ variant: "outline" })}>
                <Sparkles data-icon="inline-start" />
                Sube y vende
              </Link>
              <Link
                href="/studio/productos/nuevo"
                className={buttonVariants({ variant: "link", className: "px-0" })}
              >
                <Package data-icon="inline-start" />
                Publicar a mano
              </Link>
            </div>
          ) : nextStep.id === "share" ? (
            <Link href="/studio/productos" className={buttonVariants({ className: "self-start" })}>
              Compartir mis productos
            </Link>
          ) : null}
        </section>
      ) : null}

      <section aria-label="Tu semana" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          label="Ventas"
          value={formatMoney(panel.sales.value)}
          trend={<TrendBadge changePct={panel.sales.changePct} />}
          href="/studio/pedidos"
        >
          <Sparkline points={panel.sales.series} />
        </StatTile>
        <StatTile
          label="Por despachar"
          value={String(sales.toDispatch)}
          href="/studio/pedidos"
          footer={
            sales.oldestToDispatchHours !== null
              ? `El más antiguo: ${formatHours(sales.oldestToDispatchHours)}`
              : "Nada esperando"
          }
        />
        <StatTile
          label="Mensajes sin leer"
          value={String(panel.unreadMessages)}
          href="/mensajes"
          footer={panel.unreadMessages > 0 ? "Responde rápido: ayuda a vender" : "Al día"}
        />
        <StatTile
          label="Visitas"
          value={formatCompactNumber(panel.visits.value)}
          trend={<TrendBadge changePct={panel.visits.changePct} />}
          href="/studio/analitica"
          footer="A tus productos"
        />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <PendingCard
          title="Pendientes en tus ventas"
          items={salesItems}
          allClear="Todo en orden: ninguna venta está esperando."
        />
        <PendingCard
          title="Pendientes en tus productos"
          items={catalogItems}
          allClear="Todo en orden en tu catálogo."
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="dark flex flex-col gap-1 rounded-3xl border bg-card p-5 text-foreground">
          <p className="text-sm text-muted-foreground">
            Tu beneficio estimado · últimos {metrics.days} días
          </p>
          <p className="font-heading text-4xl font-extrabold">{formatMoney(metrics.profitCents)}</p>
          <p className="text-xs text-muted-foreground">
            Ventas de {formatMoney(metrics.revenueCents)} − costo de tus productos − comisiones
            (procesador estimado en {(metrics.estimatedPaymentFeeBps / 100).toFixed(1)} %).
            Calculado con tus datos, no por IA.
          </p>
          {simulatedSales > 0 ? (
            <p className="text-xs font-semibold text-destructive">
              Incluye {simulatedSales === 1 ? "1 venta" : `${simulatedSales} ventas`} con pago
              simulado: no se cobró dinero.
            </p>
          ) : null}
        </section>
        <PerformanceCard performance={panel.performance} />
      </div>

      <FunnelCard
        steps={panel.funnel}
        days={panel.days}
        ordersFromContent={panel.ordersFromContent}
      />

      {topProducts.length > 0 ? (
        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <div className="flex items-baseline justify-between gap-3">
            <div className="flex flex-col">
              <h2 className="font-heading text-lg font-bold">Tus productos más vistos</h2>
              <p className="text-xs text-muted-foreground">
                Últimos {panel.days} días · {panel.activeProducts}{" "}
                {panel.activeProducts === 1 ? "producto activo" : "productos activos"}
              </p>
            </div>
            <Link
              href="/studio/analitica"
              className="shrink-0 text-sm font-semibold text-primary-text hover:underline"
            >
              Ver todos
            </Link>
          </div>
          <ProductActivityList rows={topProducts} />
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
