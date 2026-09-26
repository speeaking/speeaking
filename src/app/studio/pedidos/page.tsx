import { ReceiptText, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { advanceOrderAction, cancelOrderAction } from "@/modules/commerce/actions";
import { expireStaleCheckouts } from "@/modules/commerce/checkout";
import { DELIVERY_LABELS, ORDER_STATUS_LABELS } from "@/modules/commerce/labels";
import { listSellerOrders } from "@/modules/commerce/seller-orders";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Pedidos" };

export default async function StudioOrdersPage() {
  const viewer = await requireOnboardedViewer("/studio/pedidos");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
  // Las reservas vencidas regresan al inventario aunque su comprador no vuelva (SEC-05).
  await expireStaleCheckouts();
  const orders = await listSellerOrders(viewer.sellerProfileId);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader title="Pedidos" className="px-0 pt-0" />
      {orders.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Sin pedidos todavía"
          description="Cuando alguien te compre, verás aquí el pedido y su estado."
        />
      ) : (
        <ul className="flex flex-col gap-3">
          {orders.map((order) => {
            const address = order.shippingAddress;
            return (
              <li key={order.id} className="flex flex-col gap-2 rounded-3xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">{order.buyerName ?? "Comprador"}</span>
                  <span className="flex gap-1.5">
                    {order.simulatedPayment ? (
                      <span className="rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                        Pago simulado
                      </span>
                    ) : null}
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                      {ORDER_STATUS_LABELS[order.status]}
                    </span>
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {DELIVERY_LABELS[order.deliveryMethod]} · {formatRelativeTime(order.createdAt)}
                </p>
                <ul className="text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.title}
                    </li>
                  ))}
                </ul>
                {order.simulatedPayment && order.status === "PAID" ? (
                  <p
                    role="note"
                    className="flex gap-2 rounded-2xl bg-destructive/10 p-3 text-xs text-destructive"
                  >
                    <TriangleAlert className="size-4 shrink-0" />
                    No se cobró dinero: no envíes mercancía. Cancela el pedido para que las piezas
                    regresen a tu inventario.
                  </p>
                ) : null}
                {address ? (
                  <p className="rounded-2xl bg-secondary p-3 text-xs">
                    {address.recipientName} · {address.street} {address.exteriorNumber}
                    {address.interiorNumber ? ` int. ${address.interiorNumber}` : null},{" "}
                    {address.neighborhood}, {address.city}, {address.state} {address.postalCode}
                    {address.references ? ` · ${address.references}` : null}
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-heading text-lg font-bold">
                    {formatMoney(order.totalCents)}
                  </span>
                  <div className="flex gap-2">
                    {order.actions.includes("SHIPPED") ? (
                      <form action={advanceOrderAction.bind(null, order.id, "SHIPPED")}>
                        <Button type="submit" size="sm">
                          Marcar enviado
                        </Button>
                      </form>
                    ) : null}
                    {order.actions.includes("DELIVERED") ? (
                      <form action={advanceOrderAction.bind(null, order.id, "DELIVERED")}>
                        <Button type="submit" size="sm" variant="outline">
                          Marcar entregado
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
                {order.actions.includes("CANCELLED") ? (
                  // Cancelar no se deshace: se confirma en un segundo paso.
                  <details className="text-sm">
                    <summary className="cursor-pointer text-muted-foreground">
                      Cancelar pedido
                    </summary>
                    <form
                      action={cancelOrderAction.bind(null, order.id)}
                      className="mt-2 flex flex-col gap-2"
                    >
                      <p className="text-xs text-muted-foreground">
                        Las piezas regresan a tu inventario y no se puede deshacer.
                      </p>
                      <Button type="submit" size="sm" variant="destructive" className="self-start">
                        Sí, cancelar pedido
                      </Button>
                    </form>
                  </details>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
