import { afterEach, describe, expect, it, vi } from "vitest";
import { isSimulatedPayment, type PaymentsConfig, simulatedPaymentsAllowed } from "./policy";

const config = (overrides: Partial<PaymentsConfig>): PaymentsConfig => ({
  NODE_ENV: "development",
  PAYMENT_PROVIDER: "mock",
  ALLOW_SIMULATED_PAYMENTS: false,
  ...overrides,
});

describe("simulatedPaymentsAllowed (SEC-01)", () => {
  it("desarrollo y pruebas: el simulador está disponible sin configurar nada", () => {
    expect(simulatedPaymentsAllowed(config({ NODE_ENV: "development" }))).toBe(true);
    expect(simulatedPaymentsAllowed(config({ NODE_ENV: "test" }))).toBe(true);
  });

  it("producción: solo con permiso explícito", () => {
    expect(simulatedPaymentsAllowed(config({ NODE_ENV: "production" }))).toBe(false);
    expect(
      simulatedPaymentsAllowed(config({ NODE_ENV: "production", ALLOW_SIMULATED_PAYMENTS: true })),
    ).toBe(true);
  });

  it("identifica los pagos simulados por su proveedor", () => {
    expect(isSimulatedPayment("mock")).toBe(true);
    expect(isSimulatedPayment("mercadopago")).toBe(false);
  });
});

describe("getPaymentProvider", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("@/server/env");
  });

  async function load(env: PaymentsConfig) {
    vi.doMock("@/server/env", () => ({ env }));
    return import("./index");
  }

  it("en desarrollo usa la pasarela simulada", async () => {
    const payments = await load(config({}));
    expect(payments.simulatedPaymentsEnabled()).toBe(true);
    expect(payments.getPaymentProvider().id).toBe("mock");
  });

  it("en producción sin permiso no crea el simulador (aunque el arranque ya habría fallado)", async () => {
    const payments = await load(config({ NODE_ENV: "production" }));
    expect(payments.simulatedPaymentsEnabled()).toBe(false);
    expect(() => payments.getPaymentProvider()).toThrow(/no están permitidos/);
  });

  it("un piloto cerrado en producción lo usa con ALLOW_SIMULATED_PAYMENTS", async () => {
    const payments = await load(config({ NODE_ENV: "production", ALLOW_SIMULATED_PAYMENTS: true }));
    expect(payments.getPaymentProvider().id).toBe("mock");
  });
});
