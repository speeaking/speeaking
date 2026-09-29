import { Wallet } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { formatMoney } from "@/lib/format";
import { TopUpForm } from "@/modules/billing/components/top-up-form";
import { FREE_TRY_ONS_PER_MONTH, TOPUP_PACKS } from "@/modules/billing/pricing";
import { getTryOnPricing, getWallet } from "@/modules/billing/service";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { tryOnAllowance } from "@/modules/tryon/service";
import { simulatedPaymentsEnabled } from "@/server/providers/payments";

export const metadata: Metadata = { title: "Tu saldo", robots: { index: false } };

const KIND_LABELS: Record<string, string> = {
  TOPUP: "Recarga",
  PROMO: "Bono",
  TRY_ON: "Prueba (Pruébatelo)",
  SPONSORED_TRY_ON: "Prueba patrocinada",
  REFUND: "Devolución",
  ADJUSTMENT: "Ajuste",
};

const dateTime = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

export default async function WalletPage() {
  const viewer = await requireOnboardedViewer("/saldo");
  const [wallet, pricing, allowance] = await Promise.all([
    getWallet(viewer.userId),
    getTryOnPricing(),
    tryOnAllowance(viewer.userId),
  ]);

  return (
    <>
      <PageHeader
        title="Tu saldo"
        description="Sirve para las pruebas de Pruébatelo cuando se acaban las gratis del mes. Cada peso que entra se reinvierte en la plataforma."
      />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <section className="flex flex-col gap-1 rounded-3xl border bg-card p-5">
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Wallet aria-hidden="true" className="size-4" />
            Saldo disponible
          </p>
          <p className="font-heading text-4xl font-extrabold tabular-nums">
            {formatMoney(wallet.balanceCents, wallet.currency)}
          </p>
          {wallet.simulatedCents > 0 ? (
            <p className="text-xs text-muted-foreground">
              {formatMoney(wallet.simulatedCents)} son de recargas simuladas (etapa de prueba).
            </p>
          ) : null}
          <p className="mt-2 text-sm text-ink-2">
            Te{" "}
            {allowance.freeLeft === 1
              ? "queda 1 prueba gratis"
              : `quedan ${allowance.freeLeft} pruebas gratis`}{" "}
            este mes (de {FREE_TRY_ONS_PER_MONTH}). Después, cada prueba cuesta{" "}
            {formatMoney(pricing.priceCents)}: precio comunitario nivel {pricing.level} de{" "}
            {pricing.levels}
            {pricing.nextLevelAt !== null && pricing.nextPriceCents !== null
              ? `, baja a ${formatMoney(pricing.nextPriceCents)} cuando la comunidad pase de ${pricing.nextLevelAt.toLocaleString("es-MX")} pruebas al mes`
              : ""}
            .{" "}
            <Link
              href={"/precios" as Route}
              className="font-semibold text-primary-text underline-offset-2 hover:underline"
            >
              Ver precios
            </Link>
          </p>
        </section>

        <section
          aria-labelledby="recargar"
          className="flex flex-col gap-3 rounded-3xl border bg-card p-5"
        >
          <h2 id="recargar" className="font-heading text-lg font-bold">
            Recargar
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
      </div>
    </>
  );
}
