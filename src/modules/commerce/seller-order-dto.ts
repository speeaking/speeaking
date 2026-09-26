/**
 * Lo que el vendedor ve de un pedido (SEC-08), como función pura: el nombre y el domicilio del
 * comprador existen para entregar una compra pagada. En cualquier otro estado no salen del servidor.
 */
import { z } from "zod";
import type { DeliveryMethod, OrderStatus } from "@/generated/prisma/enums";
import { isSimulatedPayment } from "@/server/providers/payments/policy";
import { type SellerOrderAction, sellerOrderActions } from "./order-transitions";

/** Estados en los que hay una entrega en curso o hecha: solo ahí el vendedor ve al comprador. */
const BUYER_VISIBLE_STATUSES: readonly OrderStatus[] = ["PAID", "SHIPPED", "DELIVERED"];

/**
 * Campos del domicilio que necesita el vendedor para entregar. El teléfono y el resto de la copia
 * guardada no se incluyen.
 */
const sellerAddressSchema = z.object({
  recipientName: z.string(),
  street: z.string(),
  exteriorNumber: z.string(),
  interiorNumber: z.string().optional(),
  neighborhood: z.string(),
  city: z.string(),
  state: z.string(),
  postalCode: z.string(),
  references: z.string().optional(),
});

export type SellerShippingAddress = z.output<typeof sellerAddressSchema>;

export type SellerOrderRow = {
  id: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  totalCents: number;
  shippingAddress: unknown;
  createdAt: Date;
  buyer: { profile: { displayName: string } | null };
  items: { id: string; titleSnapshot: string; quantity: number }[];
  /** Pagos aprobados del checkout. */
  checkout: { payments: { provider: string }[] };
};

export type SellerOrderDto = {
  id: string;
  status: OrderStatus;
  deliveryMethod: DeliveryMethod;
  totalCents: number;
  createdAt: Date;
  items: { id: string; title: string; quantity: number }[];
  /** Pago simulado: no se cobró dinero y no se debe enviar mercancía (SEC-01). */
  simulatedPayment: boolean;
  /** `null` si el pedido ya no está pagado (p. ej. cancelado). */
  buyerName: string | null;
  /** `null` al recoger en persona o si el pedido ya no está pagado. */
  shippingAddress: SellerShippingAddress | null;
  actions: SellerOrderAction[];
};

export function toSellerOrderDto(row: SellerOrderRow): SellerOrderDto {
  const buyerVisible = BUYER_VISIBLE_STATUSES.includes(row.status);
  const simulatedPayment = row.checkout.payments.some((payment) =>
    isSimulatedPayment(payment.provider),
  );
  const address = buyerVisible ? sellerAddressSchema.safeParse(row.shippingAddress) : null;
  return {
    id: row.id,
    status: row.status,
    deliveryMethod: row.deliveryMethod,
    totalCents: row.totalCents,
    createdAt: row.createdAt,
    items: row.items.map((item) => ({
      id: item.id,
      title: item.titleSnapshot,
      quantity: item.quantity,
    })),
    simulatedPayment,
    buyerName: buyerVisible ? (row.buyer.profile?.displayName ?? "Comprador") : null,
    shippingAddress: address?.success ? address.data : null,
    actions: sellerOrderActions({
      status: row.status,
      deliveryMethod: row.deliveryMethod,
      simulatedPayment,
    }),
  };
}
