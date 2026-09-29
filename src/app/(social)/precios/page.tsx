import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import { FREE_TRY_ONS_PER_MONTH, TOPUP_PACKS, TRY_ON_TIERS } from "@/modules/billing/pricing";
import { getTryOnPricing } from "@/modules/billing/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Precios",
  description: "Qué es gratis, qué se cobra y por qué el precio baja cuando la comunidad crece.",
};

export default async function PricingPage() {
  const pricing = await getTryOnPricing();
  return (
    <>
      <PageHeader
        title="Precios"
        description={`En ${siteConfig.name} publicar, buscar y armar looks es gratis. Solo se cobra lo que nos cuesta dinero de verdad: las simulaciones de Pruébatelo después de las gratis del mes. Y el precio baja conforme más gente usa la plataforma.`}
      />
      <div className="flex flex-col gap-4 px-4 md:px-0">
        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Gratis, siempre</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Publicar productos y la ayuda para redactar tu publicación («Sube y vende»).</li>
            <li>Buscar, seguir comunidades, publicar y comentar.</li>
            <li>«¿Qué necesitas?», «Crea mi look» y «Completa mi look».</li>
            <li>
              {FREE_TRY_ONS_PER_MONTH} simulaciones de Pruébatelo al mes por persona (y las que
              patrocine una tienda).
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Pruébatelo: precio comunitario</h2>
          <p className="text-sm text-ink-2">
            Cada simulación nos cuesta dinero (un modelo de imagen la genera). Después de tus{" "}
            {FREE_TRY_ONS_PER_MONTH} gratis, pagas con saldo el precio del nivel en que esté la
            comunidad: entre más pruebas haga toda la plataforma al mes, más barato para todos. Hoy
            estamos en el <strong>nivel {pricing.level}</strong>: {formatMoney(pricing.priceCents)}{" "}
            por prueba.
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
            Precios con IVA incluido. Nunca vendemos por debajo de nuestro costo: si un proveedor
            sube de precio, el mínimo se ajusta y lo avisamos aquí.
            {pricing.floored ? " Hoy aplica ese mínimo." : ""}
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Recargas de saldo</h2>
          <ul className="flex flex-wrap gap-3 text-sm">
            {TOPUP_PACKS.map((pack) => (
              <li key={pack.id} className="rounded-2xl bg-secondary px-3 py-2">
                <span className="font-bold">{formatMoney(pack.amountCents)}</span>
                {pack.bonusCents > 0 ? (
                  <span className="text-muted-foreground">
                    {" "}
                    + {formatMoney(pack.bonusCents)} de regalo
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
          <p className="text-xs text-muted-foreground">
            El saldo no es dinero ni se transfiere; sirve para usos dentro de la plataforma. Puedes
            pedir la devolución del saldo no usado dentro de los 5 días hábiles siguientes a una
            recarga. En esta etapa las recargas son simuladas y no se cobra nada.
          </p>
        </section>

        <section className="flex flex-col gap-2 rounded-3xl border bg-card p-5">
          <h2 className="font-heading text-lg font-bold">Si vendes</h2>
          <ul className="list-disc space-y-1 pl-5 text-sm text-ink-2">
            <li>Publicar y vender: gratis, sin comisión durante el piloto.</li>
            <li>
              Pruebas patrocinadas: enciendes «pruebas gratis en mis productos» con un tope diario y
              pagas cada prueba a precio comunitario. Quien se prueba tu producto compra más.
            </li>
            <li>
              Impulsar (publicidad por resultados): cuando haya tráfico. «Si no vendes, no pagas».
            </li>
          </ul>
        </section>
      </div>
    </>
  );
}
