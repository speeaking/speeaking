import "server-only";
import { db } from "@/server/db";
import { toSellerOrderDto } from "./seller-order-dto";

export type { SellerOrderDto } from "./seller-order-dto";

/**
 * Pedidos del vendedor para el Studio, como DTO explícito (SEC-08): solo los que se pagaron alguna
 * vez (un intento abandonado, rechazado o vencido no es una venta y no le muestra a nadie), y el
 * nombre y domicilio del comprador solo mientras el pedido sigue pagado. Nunca datos de pago.
 */
export async function listSellerOrders(sellerId: string) {
  const rows = await db.order.findMany({
    where: { sellerId, paidAt: { not: null } },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      status: true,
      deliveryMethod: true,
      totalCents: true,
      shippingAddress: true,
      createdAt: true,
      buyer: { select: { profile: { select: { displayName: true } } } },
      items: { select: { id: true, titleSnapshot: true, quantity: true } },
      checkout: {
        select: { payments: { where: { status: "APPROVED" }, select: { provider: true } } },
      },
    },
  });
  return rows.map(toSellerOrderDto);
}
