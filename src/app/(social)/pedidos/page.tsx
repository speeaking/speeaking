import { ReceiptText } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/states/empty-state";
import { formatMoney, formatRelativeTime } from "@/lib/format";
import { buyerStatusLabel } from "@/modules/commerce/labels";
import { expireStaleCheckouts } from "@/modules/commerce/checkout";
import { requireViewer } from "@/modules/identity/session";
import { RemoveContentButton } from "@/modules/identity/components/remove-content-button";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Mis pedidos" };

export default async function MyOrdersPage() {
  const viewer = await requireViewer("/pedidos");
  await expireStaleCheckouts(new Date(), viewer.userId);
  const checkouts = await db.checkout.findMany({
    where: { buyerId: viewer.userId, buyerHiddenAt: null },
    orderBy: { createdAt: "desc" },
    take: 30,
    select: {
      id: true,
      status: true,
      totalCents: true,
      createdAt: true,
      orders: {
        select: {
          status: true,
          seller: { select: { displayName: true } },
          items: { select: { titleSnapshot: true, quantity: true } },
        },
      },
    },
  });

  return (
    <>
      <PageHeader title="Mis pedidos" />
      <div className="flex flex-col gap-3 px-4 md:px-0">
        {checkouts.length === 0 ? (
          <EmptyState
            icon={ReceiptText}
            title="Aún no has comprado nada"
            description="Cuando compres, aquí verás el estado de tus pedidos."
          />
        ) : (
          checkouts.map((checkout) => {
            const items = checkout.orders.flatMap((order) => order.items);
            const status = buyerStatusLabel(
              checkout.status,
              checkout.orders.map((order) => order.status),
            );
            const sellers = checkout.orders.map((order) => order.seller.displayName);
            return (
              <article key={checkout.id} className="flex flex-col rounded-3xl border bg-card">
                <Link
                  href={`/pedidos/${checkout.id}` as Route}
                  className="flex flex-col gap-1 rounded-t-3xl p-4 hover:bg-secondary"
                >
                  <span className="flex justify-between text-sm">
                    <span className="font-semibold">{status}</span>
                    <span className="text-muted-foreground">
                      {formatRelativeTime(checkout.createdAt)}
                    </span>
                  </span>
                  <span className="line-clamp-1 text-sm text-muted-foreground">
                    {items.map((item) => `${item.quantity} × ${item.titleSnapshot}`).join(", ")}
                  </span>
                  <span className="line-clamp-1 text-xs text-muted-foreground">
                    De {sellers.join(", ")}
                  </span>
                  <span className="font-heading text-lg font-bold">
                    {formatMoney(checkout.totalCents)}
                  </span>
                </Link>
                <div className="flex justify-end border-t px-2 py-1">
                  <RemoveContentButton
                    kind="purchase"
                    id={checkout.id}
                    label="Eliminar de mi historial"
                    description="Esta compra dejará de aparecer en tu historial. Si tiene una entrega pendiente, seguirá su curso. El vendedor conserva el comprobante."
                  />
                </div>
              </article>
            );
          })
        )}
      </div>
    </>
  );
}
