/**
 * Política de pagos simulados (SEC-01), sin dependencias del servidor: la usan el esquema de
 * variables de entorno (falla al arrancar) y el código en tiempo de ejecución (404 en la pasarela
 * simulada).
 */

/** Proveedores de pago configurables con `PAYMENT_PROVIDER`. Mercado Pago o Stripe se agregan aquí. */
export const PAYMENT_PROVIDERS = ["mock"] as const;
export type PaymentProviderId = (typeof PAYMENT_PROVIDERS)[number];

/** Id del proveedor simulado; también se guarda en `Payment.provider`. */
export const SIMULATED_PAYMENT_PROVIDER = "mock" satisfies PaymentProviderId;

export type PaymentsConfig = {
  NODE_ENV: "development" | "test" | "production";
  PAYMENT_PROVIDER: PaymentProviderId;
  ALLOW_SIMULATED_PAYMENTS: boolean;
};

/**
 * ¿Se pueden simular pagos? Solo con el proveedor simulado y, en producción, únicamente si
 * `ALLOW_SIMULATED_PAYMENTS=true` (un piloto cerrado donde nadie paga de verdad es una decisión
 * explícita, nunca un olvido de configuración).
 */
export function simulatedPaymentsAllowed(config: PaymentsConfig) {
  return (
    config.PAYMENT_PROVIDER === SIMULATED_PAYMENT_PROVIDER &&
    (config.NODE_ENV !== "production" || config.ALLOW_SIMULATED_PAYMENTS)
  );
}

/** Un pago del proveedor simulado: no se cobró dinero. */
export function isSimulatedPayment(provider: string) {
  return provider === SIMULATED_PAYMENT_PROVIDER;
}
