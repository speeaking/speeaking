/**
 * Qué puede hacer el vendedor con un pedido (SEC-25), como tabla: el mismo dato decide los botones
 * del Studio y la condición atómica del `updateMany` en el servidor.
 */
import type { DeliveryMethod, OrderStatus } from "@/generated/prisma/enums";

export type SellerOrderAction = "SHIPPED" | "DELIVERED" | "CANCELLED";

const SHIPS: readonly DeliveryMethod[] = ["NATIONAL_SHIPPING", "LOCAL_DELIVERY"];
const ANY: readonly DeliveryMethod[] = ["NATIONAL_SHIPPING", "LOCAL_DELIVERY", "PICKUP"];

/**
 * Enviar solo aplica si hay envío; entregar exige haber enviado, salvo al recoger en persona;
 * cancelar solo antes de enviar (el stock regresa).
 */
export const SELLER_ORDER_TRANSITIONS: Record<
  SellerOrderAction,
  readonly { from: OrderStatus; methods: readonly DeliveryMethod[] }[]
> = {
  SHIPPED: [{ from: "PAID", methods: SHIPS }],
  DELIVERED: [
    { from: "SHIPPED", methods: SHIPS },
    { from: "PAID", methods: ["PICKUP"] },
  ],
  CANCELLED: [{ from: "PAID", methods: ANY }],
};

export function canSellerMoveOrder(
  order: { status: OrderStatus; deliveryMethod: DeliveryMethod },
  to: SellerOrderAction,
) {
  return SELLER_ORDER_TRANSITIONS[to].some(
    (rule) => rule.from === order.status && rule.methods.includes(order.deliveryMethod),
  );
}

/**
 * Botones que el Studio ofrece para un pedido. Con pago simulado no se cobró dinero: nunca se envía
 * ni se entrega, solo se cancela (SEC-01). Con un cobro real, cancelar exige reembolsar y todavía no
 * hay reembolsos, así que no se ofrece. Mismas reglas que `advanceOrder` y `cancelOrderBySeller`.
 */
export function sellerOrderActions(order: {
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  simulatedPayment: boolean;
}): SellerOrderAction[] {
  const allowed: readonly SellerOrderAction[] = order.simulatedPayment
    ? ["CANCELLED"]
    : ["SHIPPED", "DELIVERED"];
  return allowed.filter((to) => canSellerMoveOrder(order, to));
}

/** La misma regla como condición de Prisma, para aplicar la transición de forma atómica. */
export function sellerTransitionWhere(to: SellerOrderAction) {
  return {
    OR: SELLER_ORDER_TRANSITIONS[to].map((rule) => ({
      status: rule.from,
      deliveryMethod: { in: [...rule.methods] },
    })),
  };
}
