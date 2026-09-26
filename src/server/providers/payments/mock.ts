import { randomUUID } from "node:crypto";
import { SIMULATED_PAYMENT_PROVIDER } from "./policy";
import type { PaymentProvider } from "./types";

/**
 * Pagos simulados (V0.1): no hay cargos reales. La "página del proveedor" es
 * /checkout/pago/[ref], donde se simula aprobar o rechazar; el resultado entra por el mismo
 * camino que un webhook real (`applyPaymentEvent`). Solo existe si `simulatedPaymentsEnabled()`.
 */
export class MockPaymentProvider implements PaymentProvider {
  readonly id = SIMULATED_PAYMENT_PROVIDER;

  async createPayment() {
    const providerRef = `mock_${randomUUID().replaceAll("-", "")}`;
    return { providerRef, redirectUrl: `/checkout/pago/${providerRef}` };
  }

  /** Nada que dar de baja: la pasarela simulada solo acepta pagos en PENDING. */
  async cancelPayment() {}
}
