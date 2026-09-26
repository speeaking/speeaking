import type { CheckoutStatus, DeliveryMethod, OrderStatus } from "@/generated/prisma/enums";

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING_PAYMENT: "Esperando pago",
  PAID: "Pagado",
  SHIPPED: "Enviado",
  DELIVERED: "Entregado",
  CANCELLED: "Cancelado",
};

export const CHECKOUT_STATUS_LABELS: Record<CheckoutStatus, string> = {
  PENDING_PAYMENT: "Esperando pago",
  PAID: "Pagado",
  FAILED: "Pago rechazado",
  EXPIRED: "Venció el tiempo de pago",
};

const PAID_PROGRESS = { PAID: 0, SHIPPED: 1, DELIVERED: 2 } as const;
type PaidProgress = keyof typeof PAID_PROGRESS;

const isPaidProgress = (status: OrderStatus): status is PaidProgress => status in PAID_PROGRESS;

/** Avance de un checkout pagado: el estado más avanzado de sus pedidos (Pagado → Entregado). */
export function paidOrderProgress(orderStatuses: OrderStatus[]): PaidProgress {
  return orderStatuses
    .filter(isPaidProgress)
    .reduce<PaidProgress>(
      (furthest, status) => (PAID_PROGRESS[status] > PAID_PROGRESS[furthest] ? status : furthest),
      "PAID",
    );
}

/** ¿El vendedor canceló todos los pedidos de un checkout pagado? (SEC-25) */
export function allOrdersCancelled(orderStatuses: OrderStatus[]) {
  return orderStatuses.length > 0 && orderStatuses.every((status) => status === "CANCELLED");
}

/** Estado que ve el comprador: ya pagado, cuenta cuándo lo enviaron, entregaron o cancelaron. */
export function buyerStatusLabel(checkoutStatus: CheckoutStatus, orderStatuses: OrderStatus[]) {
  if (checkoutStatus !== "PAID") return CHECKOUT_STATUS_LABELS[checkoutStatus];
  return allOrdersCancelled(orderStatuses)
    ? ORDER_STATUS_LABELS.CANCELLED
    : ORDER_STATUS_LABELS[paidOrderProgress(orderStatuses)];
}

export const DELIVERY_LABELS: Record<DeliveryMethod, string> = {
  NATIONAL_SHIPPING: "Envío a domicilio",
  LOCAL_DELIVERY: "Entrega local",
  PICKUP: "Recoger en persona",
};
