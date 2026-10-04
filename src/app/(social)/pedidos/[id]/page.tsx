import { CheckCircle2, Clock, XCircle } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { buttonVariants } from "@/components/ui/button";
import { formatMoney } from "@/lib/format";
import {
  allOrdersCancelled,
  buyerStatusLabel,
  DELIVERY_LABELS,
  ORDER_STATUS_LABELS,
  paidOrderProgress,
} from "@/modules/commerce/labels";
import { expireStaleCheckouts } from "@/modules/commerce/checkout";
import { requireViewer } from "@/modules/identity/session";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { db } from "@/server/db";
import { isSimulatedPayment } from "@/server/providers/payments";

export const metadata: Metadata = { title: "Detalle del pedido" };

const PAID_MESSAGES: Record<ReturnType<typeof paidOrderProgress>, string> = {
  // Sin notificaciones todavía: el vendedor lo ve en su lista de pedidos, no "le avisamos".
  PAID: "Ya registramos tu pedido. Aquí verás cuando lo envíen.",
  SHIPPED: "Tu pedido va en camino. Aquí verás cuando lo entreguen.",
  DELIVERED: "Tu pedido fue entregado.",
};

export default async function OrderDetailPage({ params }: PageProps<"/pedidos/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer(`/pedidos/${id}`);
  await expireStaleCheckouts(new Date(), viewer.userId);
  if (!z.uuid().safeParse(id).success) notFound();
  const checkout = await db.checkout.findFirst({
    where: { id, buyerId: viewer.userId, buyerHiddenAt: null },
    select: {
      status: true,
      totalCents: true,
      payments: { select: { status: true, provider: true, providerRef: true } },
      orders: {
        select: {
          id: true,
          status: true,
          deliveryMethod: true,
          subtotalCents: true,
          shippingCents: true,
          totalCents: true,
          seller: { select: { displayName: true } },
          // Solo datos del comprador: el costo del vendedor no se consulta.
          items: {
            select: {
              id: true,
              titleSnapshot: true,
              quantity: true,
              unitPriceCents: true,
              requestedSize: true,
              giftRecipientName: true,
            },
          },
        },
      },
    },
  });
  if (!checkout) notFound();

  const orderStatuses = checkout.orders.map((order) => order.status);
  // El vendedor canceló todo lo que se pagó (SEC-25).
  const cancelled = checkout.status === "PAID" && allOrdersCancelled(orderStatuses);
  const paid = checkout.status === "PAID" && !cancelled;
  const Icon = paid ? CheckCircle2 : checkout.status === "PENDING_PAYMENT" ? Clock : XCircle;
  const pendingPayment = checkout.payments.find((payment) => payment.status === "PENDING");
  const simulated = checkout.payments.some((payment) => isSimulatedPayment(payment.provider));

  return (
    <div className="flex flex-col gap-4 px-4 pt-5 md:px-0">
      <div className="flex justify-end">
        <RemoveContentButton
          kind="purchase"
          id={id}
          label="Eliminar de mi historial"
          description="Esta compra dejará de aparecer en tu historial. Si tiene una entrega pendiente, seguirá su curso. El vendedor conserva el comprobante."
        />
      </div>
      <div className="flex flex-col items-center gap-2 rounded-3xl border bg-card p-6 text-center">
        <Icon className={paid ? "size-10 text-success" : "size-10 text-muted-foreground"} />
        <h1 className="text-2xl font-extrabold">
          {buyerStatusLabel(checkout.status, orderStatuses)}
        </h1>
        {checkout.status === "PAID" ? (
          <p className="text-sm text-muted-foreground">
            {simulated ? "Pago simulado: no se cobró nada. " : null}
            {cancelled
              ? "El vendedor canceló tu pedido."
              : PAID_MESSAGES[paidOrderProgress(orderStatuses)]}
          </p>
        ) : null}
        {checkout.status === "FAILED" || checkout.status === "EXPIRED" ? (
          <>
            <p className="text-sm text-muted-foreground">
              No se cobró nada y tus productos regresaron a tu carrito.
            </p>
            <Link href="/carrito" className={buttonVariants()}>
              Volver a intentar
            </Link>
          </>
        ) : null}
        {pendingPayment ? (
          <Link
            href={`/checkout/pago/${pendingPayment.providerRef}` as Route}
            className={buttonVariants()}
          >
            Completar pago
          </Link>
        ) : null}
      </div>
      {checkout.orders.map((order) => (
        <section key={order.id} className="flex flex-col gap-2 rounded-3xl border bg-card p-4">
          <div className="flex justify-between text-sm">
            <span className="font-semibold">{order.seller.displayName}</span>
            <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
              {ORDER_STATUS_LABELS[order.status]}
            </span>
          </div>
          <p className="text-xs text-muted-foreground">{DELIVERY_LABELS[order.deliveryMethod]}</p>
          <ul className="flex flex-col gap-1 text-sm">
            {order.items.map((item) => (
              <li key={item.id} className="flex justify-between gap-3">
                <span>
                  {item.quantity} × {item.titleSnapshot}
                  {item.requestedSize ? (
                    <span className="block text-xs text-muted-foreground">
                      Talla solicitada: {item.requestedSize}
                    </span>
                  ) : null}
                  {item.giftRecipientName ? (
                    <span className="block text-xs text-primary-text">
                      Regalo para {item.giftRecipientName}
                    </span>
                  ) : null}
                </span>
                <span>{formatMoney(item.unitPriceCents * item.quantity)}</span>
              </li>
            ))}
          </ul>
          <p className="flex justify-between text-sm text-muted-foreground">
            <span>Envío</span>
            <span>
              {order.shippingCents === 0 ? "Sin costo" : formatMoney(order.shippingCents)}
            </span>
          </p>
        </section>
      ))}
      <p className="flex justify-between rounded-3xl bg-secondary p-4 font-heading text-xl font-extrabold">
        <span>Total</span>
        <span>{formatMoney(checkout.totalCents)}</span>
      </p>
    </div>
  );
}
