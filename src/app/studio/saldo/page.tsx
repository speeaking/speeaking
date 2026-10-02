import { Camera } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { SponsorForm } from "@/modules/billing/components/sponsor-form";
import { TopUpForm } from "@/modules/billing/components/top-up-form";
import { STORE_TRIAL_TRY_ONS, TOPUP_PACKS } from "@/modules/billing/pricing";
import { getSponsorStatus, getTryOnPricing, getWallet } from "@/modules/billing/service";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { sellerTryOnStats } from "@/modules/tryon/service";
import { simulatedPaymentsEnabled } from "@/server/providers/payments";

export const metadata: Metadata = { title: "Saldo y «Ver cómo me veo»" };

const KIND_LABELS: Record<string, string> = {
  TOPUP: "Recarga",
  PROMO: "Bono",
  TRY_ON: "Prueba",
  SPONSORED_TRY_ON: "Prueba de «Ver cómo me veo»",
  FEATURED: "Producto destacado",
  REFUND: "Devolución",
  ADJUSTMENT: "Ajuste",
};

const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/**
 * Saldo de la tienda (ADR-044, ADR-046): un solo saldo para todo lo que paga quien vende. Aquí se
 * ve cuánto se prueban sus productos, cuánta demanda dejó pasar, se recarga y se enciende «Ver
 * cómo me veo».
 */
export default async function StudioWalletPage() {
  const viewer = await requireOnboardedViewer("/studio/saldo");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  const [status, pricing, stats, wallet] = await Promise.all([
    getSponsorStatus(viewer.userId),
    getTryOnPricing(),
    sellerTryOnStats(viewer.sellerProfileId),
    getWallet(viewer.userId),
  ]);
  const kpis = [
    { label: "Saldo de la tienda", value: formatMoney(status.balanceCents) },
    { label: "Se probaron tus productos (7 días)", value: String(stats.last7Days) },
    { label: "Quisieron probarse y no pudieron (7 días)", value: String(stats.requestedLast7Days) },
    { label: "Precio por prueba hoy", value: formatMoney(pricing.priceCents) },
  ];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Saldo y «Ver cómo me veo»"
        description="Quien compra nunca paga por probarse tu ropa: lo pagas tú, solo cuando alguien se la prueba. Cada peso del saldo se gasta cuando trae ventas."
        className="px-0 pt-0"
      />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
            <dd className="font-heading text-2xl font-extrabold tabular-nums">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      {stats.requestedLast7Days > 0 && !status.enabled ? (
        <p
          role="status"
          className="flex items-start gap-2 rounded-2xl bg-secondary px-4 py-3 text-sm"
        >
          <Camera aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
          <span>
            <span className="font-semibold">
              {stats.requestedLast7Days === 1
                ? "1 persona quiso probarse tu ropa esta semana"
                : `${stats.requestedLast7Days} personas quisieron probarse tu ropa esta semana`}
            </span>{" "}
            y no pudieron. Enciende «Ver cómo me veo» abajo: cada prueba te cuesta{" "}
            {formatMoney(pricing.priceCents)} y quien se prueba compra más.
          </span>
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
        <h2 className="font-heading text-lg font-bold">«Ver cómo me veo» en mis productos</h2>
        <p className="text-sm text-ink-2">
          {stats.trialLeft > 0
            ? `${siteConfig.name} pone las primeras ${STORE_TRIAL_TRY_ONS} pruebas de tu tienda (te quedan ${stats.trialLeft}). Después, cada prueba sale de tu saldo.`
            : "Ya se usaron las pruebas de cortesía de tu tienda: desde ahora cada prueba sale de tu saldo."}
        </p>
        <SponsorForm
          enabled={status.enabled}
          dailyCapCents={status.dailyCapCents}
          priceCents={pricing.priceCents}
        />
      </section>

      <section
        aria-labelledby="recargar"
        className="flex flex-col gap-3 rounded-3xl border bg-card p-5"
      >
        <h2 id="recargar" className="font-heading text-lg font-bold">
          Recargar saldo
        </h2>
        {simulatedPaymentsEnabled() ? (
          <TopUpForm packs={TOPUP_PACKS} tryOnPriceCents={pricing.priceCents} />
        ) : (
          <p className="text-sm text-muted-foreground">
            Las recargas todavía no están disponibles: pronto podrás pagar con tarjeta o en OXXO.
          </p>
        )}
      </section>

      <section
        aria-labelledby="movimientos"
        className="flex flex-col gap-3 rounded-3xl border bg-card p-5"
      >
        <h2 id="movimientos" className="font-heading text-lg font-bold">
          Movimientos
        </h2>
        {wallet.entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no hay movimientos.</p>
        ) : (
          <ul className="flex flex-col divide-y text-sm">
            {wallet.entries.map((entry) => (
              <li key={entry.id} className="flex items-center justify-between gap-3 py-2">
                <span className="flex min-w-0 flex-col">
                  <span className="font-semibold">
                    {KIND_LABELS[entry.kind] ?? entry.kind}
                    {entry.simulated ? " (simulada)" : ""}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {dateTime.format(new Date(entry.createdAt))}
                  </span>
                </span>
                <span
                  className={entry.amountCents < 0 ? "tabular-nums" : "text-success tabular-nums"}
                >
                  {entry.amountCents > 0 ? "+" : ""}
                  {formatMoney(entry.amountCents)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="text-xs text-muted-foreground">
        Presupuesto, no planes: tú decides cuánto al día y se cobra por prueba generada. Destacar un
        producto sale del mismo saldo (
        <Link href={"/studio/campanas" as Route} className="underline">
          Campañas
        </Link>
        ). Precios en{" "}
        <Link href={"/precios" as Route} className="underline">
          /precios
        </Link>
        .
      </p>
    </div>
  );
}
