import { isLoopbackUrl } from "../../loopback";

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

/**
 * ¿Se puede recargar saldo con el simulador (ADR-071)? Nunca en un sitio público: el saldo paga
 * costos reales de IA (pruebas patrocinadas de «Ver cómo me veo»), así que regalarlo es regalar
 * dinero. Los pedidos simulados del piloto siguen (`simulatedPaymentsAllowed`); el saldo llega con el
 * primer proveedor real. En desarrollo, pruebas y el build de producción en loopback (E2E), sí.
 */
export function simulatedTopUpsAllowed(config: PaymentsConfig & { APP_URL: string }) {
  return (
    simulatedPaymentsAllowed(config) &&
    (config.NODE_ENV !== "production" || isLoopbackUrl(config.APP_URL))
  );
}

/** Un pago del proveedor simulado: no se cobró dinero. */
export function isSimulatedPayment(provider: string) {
  return provider === SIMULATED_PAYMENT_PROVIDER;
}
