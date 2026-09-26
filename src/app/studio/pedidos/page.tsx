import { ReceiptText } from "lucide-react";
import type { Metadata } from "next";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { Button } from "@/components/ui/button";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { listSellerOrders } from "@/modules/analytics/seller-queries";
import { advanceOrderAction } from "@/modules/commerce/actions";
import { DELIVERY_LABELS, ORDER_STATUS_LABELS } from "@/modules/commerce/labels";
import { SellerActivation } from "@/modules/identity/components/seller-activation";
import { requireOnboardedViewer } from "@/modules/identity/session";

export const metadata: Metadata = { title: "Pedidos" };

type Address = {
  street?: string;
  exteriorNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  recipientName?: string;
};

export default async function StudioOrdersPage() {
  const viewer = await requireOnboardedViewer("/studio/pedidos");
  if (!viewer.sellerProfileId) return <SellerActivation defaultName={viewer.profile.displayName} />;
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
            const address = order.shippingAddress as Address | null;
            return (
              <li key={order.id} className="flex flex-col gap-2 rounded-3xl border bg-card p-4">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <span className="font-semibold">
                    {order.buyer.profile?.displayName ?? "Comprador"}
                  </span>
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold">
                    {ORDER_STATUS_LABELS[order.status]}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {DELIVERY_LABELS[order.deliveryMethod]} · {formatRelativeTime(order.createdAt)}
                </p>
                <ul className="text-sm">
                  {order.items.map((item) => (
                    <li key={item.id}>
                      {item.quantity} × {item.titleSnapshot}
                    </li>
                  ))}
                </ul>
                {address?.street ? (
                  <p className="rounded-2xl bg-secondary p-3 text-xs">
                    {address.recipientName} · {address.street} {address.exteriorNumber},{" "}
                    {address.neighborhood}, {address.city}, {address.state} {address.postalCode}
                  </p>
                ) : null}
                <div className="flex items-center justify-between">
                  <span className="font-heading text-lg font-bold">
                    {formatMoney(order.totalCents)}
                  </span>
                  <div className="flex gap-2">
                    {order.status === "PAID" && order.deliveryMethod !== "PICKUP" ? (
                      <form action={advanceOrderAction.bind(null, order.id, "SHIPPED")}>
                        <Button type="submit" size="sm">
                          Marcar enviado
                        </Button>
                      </form>
                    ) : null}
                    {order.status === "SHIPPED" ||
                    (order.status === "PAID" && order.deliveryMethod === "PICKUP") ? (
                      <form action={advanceOrderAction.bind(null, order.id, "DELIVERED")}>
                        <Button type="submit" size="sm" variant="outline">
                          Marcar entregado
                        </Button>
                      </form>
                    ) : null}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
