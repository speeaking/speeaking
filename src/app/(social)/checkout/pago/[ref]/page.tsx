import { ShieldCheck } from "lucide-react";
import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import { simulatePaymentAction } from "@/modules/commerce/actions";
import { expireStaleCheckouts } from "@/modules/commerce/checkout";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { isSimulatedPayment, simulatedPaymentsEnabled } from "@/server/providers/payments";

export const metadata: Metadata = { title: "Pasarela de pago simulada" };

/**
 * Página del proveedor simulado: con un proveedor real aquí estaría la página de Mercado Pago o
 * Stripe. Solo existe donde se permiten pagos simulados (SEC-01).
 */
export default async function MockPaymentPage({ params }: PageProps<"/checkout/pago/[ref]">) {
  if (!simulatedPaymentsEnabled()) notFound();
  const { ref } = await params;
  const viewer = await requireOnboardedViewer(`/checkout/pago/${ref}`);
  await expireStaleCheckouts(new Date(), viewer.userId);
  const payment = await db.payment.findUnique({
    where: { providerRef: ref },
    select: {
      provider: true,
      status: true,
      amountCents: true,
      method: true,
      checkoutId: true,
      checkout: { select: { buyerId: true } },
    },
  });
  if (
    !payment ||
    !isSimulatedPayment(payment.provider) ||
    payment.checkout.buyerId !== viewer.userId
  ) {
    notFound();
  }
  if (payment.status !== "PENDING") redirect(`/pedidos/${payment.checkoutId}`);

  return (
    <div className="mx-4 mt-6 flex flex-col gap-5 rounded-3xl border bg-card p-6 md:mx-0">
      <p className="rounded-full bg-accent px-3 py-1 text-center text-xs font-bold tracking-wide text-accent-foreground uppercase">
        Pasarela simulada · no se cobra nada
      </p>
      <div className="flex flex-col items-center gap-1 text-center">
        <ShieldCheck className="size-10 text-success" />
        <h1 className="text-2xl font-extrabold">Pagar {formatMoney(payment.amountCents)}</h1>
        <p className="text-sm text-muted-foreground">Pedido #{payment.checkoutId.slice(0, 8)}</p>
      </div>
      <form action={simulatePaymentAction.bind(null, ref, "APPROVED")}>
        <Button type="submit" size="lg" className="h-12 w-full text-base">
          Pagar (simulado)
        </Button>
      </form>
      <details className="text-sm">
        <summary className="cursor-pointer text-center text-muted-foreground">
          Opciones de prueba
        </summary>
        <form action={simulatePaymentAction.bind(null, ref, "DECLINED")} className="mt-3">
          <Button type="submit" variant="outline" size="lg" className="h-11 w-full">
            Simular pago rechazado
          </Button>
        </form>
      </details>
    </div>
  );
}
