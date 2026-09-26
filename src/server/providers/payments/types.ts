import type { PaymentMethod } from "@/generated/prisma/enums";

/**
 * Proveedor de pagos (ADR-005 / ADR-011). La plataforma NUNCA recibe ni guarda datos de tarjeta:
 * el proveedor cobra en su propia página y nos notifica el resultado (webhook o redirección).
 */
export interface PaymentProvider {
  readonly id: string;
  createPayment(input: {
    checkoutId: string;
    amountCents: number;
    currency: string;
    method: PaymentMethod;
    description: string;
  }): Promise<{
    providerRef: string;
    /** Adónde mandar a la persona para completar el pago (página del proveedor). */
    redirectUrl: string;
  }>;
  /**
   * Da de baja un pago que ya no se debe cobrar (checkout vencido o abandonado) para que el proveedor
   * no acepte un pago tardío (SEC-23). Idempotente.
   */
  cancelPayment(input: { providerRef: string }): Promise<void>;
}

/** Notificación normalizada del proveedor (webhook real o simulación). */
export type PaymentEventInput = {
  provider: string;
  providerEventId: string;
  providerRef: string;
  status: "APPROVED" | "DECLINED" | "EXPIRED";
  /**
   * Monto cobrado según el proveedor. Un APPROVED sin monto, o con monto o moneda distintos a los
   * del pago, no se aplica (SEC-23).
   */
  amountCents?: number;
  currency?: string;
  payload: Record<string, unknown>;
};
