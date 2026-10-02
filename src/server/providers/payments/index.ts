import "server-only";
import { env } from "@/server/env";
import { MockPaymentProvider } from "./mock";
import { simulatedPaymentsAllowed, simulatedTopUpsAllowed } from "./policy";
import type { PaymentProvider } from "./types";

let provider: PaymentProvider | undefined;

/**
 * Proveedor de pagos activo según `PAYMENT_PROVIDER`. Hoy solo el simulado; Mercado Pago o Stripe se
 * agregan aquí (con `PAID` solo por webhook con firma verificada, nunca por una acción del navegador).
 */
export function getPaymentProvider(): PaymentProvider {
  provider ??= createProvider();
  return provider;
}

function createProvider(): PaymentProvider {
  // Defensa en profundidad (SEC-01): en producción el arranque ya falla sin
  // ALLOW_SIMULATED_PAYMENTS=true, pero el simulador tampoco se crea si no está permitido.
  if (!simulatedPaymentsEnabled()) {
    throw new Error("[payments] Los pagos simulados no están permitidos en este entorno.");
  }
  return new MockPaymentProvider();
}

/** ¿Existe la pasarela simulada? Si no, su página y su acción responden 404. */
export function simulatedPaymentsEnabled() {
  return simulatedPaymentsAllowed(env);
}

/** ¿Se puede recargar saldo con el simulador? Nunca en un sitio público (ADR-071). */
export function simulatedTopUpsEnabled() {
  return simulatedTopUpsAllowed(env);
}

export { isSimulatedPayment, SIMULATED_PAYMENT_PROVIDER } from "./policy";
export type { PaymentEventInput, PaymentProvider } from "./types";
