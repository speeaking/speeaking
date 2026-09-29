import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { SponsorForm } from "@/modules/billing/components/sponsor-form";
import { getSponsorStatus, getTryOnPricing } from "@/modules/billing/service";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Saldo y pruebas patrocinadas" };

export default async function StudioWalletPage() {
  const viewer = await requireOnboardedViewer("/studio/saldo");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  const [status, pricing] = await Promise.all([getSponsorStatus(viewer.userId), getTryOnPricing()]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Saldo y pruebas patrocinadas"
        description="Tu saldo es el mismo para comprar y vender. Con él puedes regalar pruebas de Pruébatelo sobre tus productos."
        className="px-0 pt-0"
        actions={
          <Link href={"/saldo" as Route} className={buttonVariants({ variant: "outline" })}>
            Recargar saldo
          </Link>
        }
      />

      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          { label: "Saldo", value: formatMoney(status.balanceCents) },
          { label: "Gastado hoy en pruebas", value: formatMoney(status.spentTodayCents) },
          { label: "Pruebas patrocinadas (30 días)", value: String(status.sponsoredLast30Days) },
          { label: "Precio por prueba hoy", value: formatMoney(pricing.priceCents) },
        ].map((kpi) => (
          <div key={kpi.label} className="flex flex-col gap-1 rounded-2xl border bg-card p-4">
            <dt className="text-xs text-muted-foreground">{kpi.label}</dt>
            <dd className="font-heading text-2xl font-extrabold tabular-nums">{kpi.value}</dd>
          </div>
        ))}
      </dl>

      <section className="flex flex-col gap-3 rounded-3xl border bg-card p-5">
        <h2 className="font-heading text-lg font-bold">Pruebas gratis en mis productos</h2>
        <SponsorForm
          enabled={status.enabled}
          dailyCapCents={status.dailyCapCents}
          priceCents={pricing.priceCents}
        />
      </section>

      <p className="text-xs text-muted-foreground">
        Presupuesto, no planes: tú decides cuánto al día; se cobra por prueba generada. Impulsar
        (publicidad por resultados) llegará cuando haya tráfico.
      </p>
    </div>
  );
}
