import { describe, expect, it } from "vitest";
import { buyerStatusLabel, paidOrderProgress } from "./labels";

describe("paidOrderProgress", () => {
  it("toma el estado más avanzado de los pedidos del checkout", () => {
    expect(paidOrderProgress(["PAID"])).toBe("PAID");
    expect(paidOrderProgress(["PAID", "SHIPPED"])).toBe("SHIPPED");
    expect(paidOrderProgress(["SHIPPED", "DELIVERED"])).toBe("DELIVERED");
  });

  it("estados fuera del avance (cancelado, sin pedidos) se quedan en Pagado", () => {
    expect(paidOrderProgress([])).toBe("PAID");
    expect(paidOrderProgress(["CANCELLED"])).toBe("PAID");
  });
});

describe("buyerStatusLabel", () => {
  it("pagado: muestra el avance que marcó el vendedor", () => {
    expect(buyerStatusLabel("PAID", ["PAID"])).toBe("Pagado");
    expect(buyerStatusLabel("PAID", ["SHIPPED"])).toBe("Enviado");
    expect(buyerStatusLabel("PAID", ["DELIVERED"])).toBe("Entregado");
  });

  it("pagado y cancelado por el vendedor: Cancelado (si solo cancela uno, cuenta el resto)", () => {
    expect(buyerStatusLabel("PAID", ["CANCELLED"])).toBe("Cancelado");
    expect(buyerStatusLabel("PAID", ["CANCELLED", "CANCELLED"])).toBe("Cancelado");
    expect(buyerStatusLabel("PAID", ["CANCELLED", "SHIPPED"])).toBe("Enviado");
  });

  it("sin pagar: el estado del pago", () => {
    expect(buyerStatusLabel("PENDING_PAYMENT", ["PENDING_PAYMENT"])).toBe("Esperando pago");
    expect(buyerStatusLabel("FAILED", ["CANCELLED"])).toBe("Pago rechazado");
    expect(buyerStatusLabel("EXPIRED", ["CANCELLED"])).toBe("Venció el tiempo de pago");
  });
});
