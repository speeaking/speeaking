import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import {
  FEATURED_DAY_PRICE_CENTS,
  FEATURED_MAX_DAYS,
  FEATURED_MIN_DAYS,
  STORE_TRIAL_TRY_ONS,
  TOPUP_PACKS,
  TRY_ON_TIERS,
  tryOnsAffordable,
} from "@/modules/billing/pricing";
import { getTryOnPricing } from "@/modules/billing/service";

export const metadata: Metadata = {
  title: "Precios",
  description:
    "Gratis para quien compra. Quien vende paga solo por lo que le trae ventas, y el precio baja cuando la comunidad crece.",
};

export default async function PricingPage() {
  const pricing = await getTryOnPricing();
  return (
    <>
      <PageHeader
        title="Precios"
        description={`En ${siteConfig.name}, comprar, probarte ropa y armar looks es gratis. Quien vende paga solo por lo que le trae ventas: pruebas de «Ver cómo me veo» sobre sus productos y días de producto destacado. Y el precio baja conforme más gente usa la plataforma.`}
      />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Si compras: gratis, siempre</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Buscar, seguir comunidades, publicar, comentar y mensajes.</li>
            <li>«¿Qué necesitas?», «Crea mi look» y «Completa mi look».</li>
            <li>
              «Ver cómo me veo»: la simulación la paga la tienda de la prenda (o {siteConfig.name}{" "}
              en sus primeras pruebas). Tú nunca pagas por verte con algo.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Si vendes: gratis publicar y vender</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Publicar productos, la ayuda para redactar y el kit de anuncios: gratis.</li>
            <li>Sin comisión por venta durante el piloto.</li>
            <li>
              Las primeras {STORE_TRIAL_TRY_ONS} pruebas de «Ver cómo me veo» de tu tienda las pone{" "}
              {siteConfig.name}.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">
            «Ver cómo me veo»: precio comunitario por prueba
          </h2>
          <p className="text-sm text-ink-2">
            Cada simulación nos cuesta dinero (un modelo de imagen la genera). La tienda paga cada
            prueba sobre sus productos al precio del nivel en que esté la comunidad: entre más
            pruebas haga toda la plataforma al mes, más barato para todos. Hoy estamos en el{" "}
            <strong>nivel {pricing.level}</strong>: {formatMoney(pricing.priceCents)} por prueba.
          </p>
          <table className="w-full text-left text-sm">
            <thead className="text-muted-foreground">
              <tr>
                <th className="py-1 font-medium">Nivel</th>
                <th className="py-1 font-medium">Pruebas al mes en la plataforma</th>
                <th className="py-1 text-right font-medium">Precio por prueba</th>
              </tr>
            </thead>
            <tbody>
              {TRY_ON_TIERS.map((tier) => (
                <tr
                  key={tier.level}
                  className={cn("border-t", tier.level === pricing.level && "font-bold")}
                  aria-current={tier.level === pricing.level ? "true" : undefined}
                >
                  <td className="py-1.5">
                    {tier.level}
                    {tier.level === pricing.level ? " · hoy" : ""}
                  </td>
                  <td className="py-1.5">
                    {tier.minMonthlyTryOns === 0
                      ? "menos de 5,000"
                      : `${tier.minMonthlyTryOns.toLocaleString("es-MX")} o más`}
                  </td>
                  <td className="py-1.5 text-right tabular-nums">{formatMoney(tier.priceCents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-xs text-muted-foreground">
            Precios con IVA incluido. La tienda decide un tope diario y se cobra solo por prueba
            generada. Nunca vendemos por debajo de nuestro costo: si un proveedor sube de precio, el
            mínimo se ajusta y lo avisamos aquí.
            {pricing.floored ? " Hoy aplica ese mínimo." : ""}
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Producto destacado</h2>
          <p className="text-sm text-ink-2">
            Tu producto aparece como «Patrocinado» en la columna de publicidad, junto a otros
            productos y arriba de Comprar: {formatMoney(FEATURED_DAY_PRICE_CENTS)} por día, de{" "}
            {FEATURED_MIN_DAYS} a {FEATURED_MAX_DAYS} días, desde el saldo de tu tienda.
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Recargas de saldo de la tienda</h2>
          <ul className="grid gap-3 text-sm sm:grid-cols-3">
            {TOPUP_PACKS.map((pack) => {
              const total = pack.amountCents + pack.bonusCents;
              return (
                <li key={pack.id} className="flex flex-col gap-0.5 rounded-2xl bg-secondary p-3">
                  <span className="text-xs font-bold tracking-wide text-muted-foreground uppercase">
                    {pack.name}
                  </span>
                  <span className="font-heading text-xl font-extrabold">
                    {formatMoney(pack.amountCents)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {pack.bonusCents > 0 ? `+ ${formatMoney(pack.bonusCents)} de regalo · ` : ""}≈{" "}
                    {tryOnsAffordable(total, pricing.priceCents)} pruebas o{" "}
                    {Math.floor(total / FEATURED_DAY_PRICE_CENTS)} días destacado
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="text-xs text-muted-foreground">
            Un solo saldo para todo, sin planes que venzan. No es dinero ni se transfiere; puedes
            pedir la devolución del saldo no usado dentro de los 5 días hábiles siguientes a una
            recarga. En esta etapa las recargas son simuladas y no se cobra nada.
          </p>
        </section>
      </div>
    </>
  );
}
