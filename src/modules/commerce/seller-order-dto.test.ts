import { describe, expect, it } from "vitest";
import { type SellerOrderRow, toSellerOrderDto } from "./seller-order-dto";

const address = {
  recipientName: "Ana López",
  phone: "5512345678",
  street: "Calle Secreta",
  exteriorNumber: "742",
  neighborhood: "Del Valle",
  city: "Benito Juárez",
  state: "CDMX",
  postalCode: "03100",
};

const row = (overrides: Partial<SellerOrderRow> = {}): SellerOrderRow => ({
  id: "order-1",
  status: "PAID",
  deliveryMethod: "NATIONAL_SHIPPING",
  totalCents: 359_800,
  shippingAddress: address,
  createdAt: new Date("2026-09-26T12:00:00Z"),
  buyer: { profile: { displayName: "Ana" } },
  items: [{ id: "item-1", titleSnapshot: "AirPods Pro 2", quantity: 1 }],
  checkout: { payments: [{ provider: "mercadopago" }] },
  ...overrides,
});

describe("toSellerOrderDto (SEC-08)", () => {
  it("pedido pagado: el vendedor ve a quién y adónde entregar, sin teléfono", () => {
    const dto = toSellerOrderDto(row());
    expect(dto.buyerName).toBe("Ana");
    expect(dto.shippingAddress).toEqual({
      recipientName: "Ana López",
      street: "Calle Secreta",
      exteriorNumber: "742",
      neighborhood: "Del Valle",
      city: "Benito Juárez",
      state: "CDMX",
      postalCode: "03100",
    });
    expect(JSON.stringify(dto)).not.toContain("5512345678");
  });

  it("enviado y entregado conservan los datos de entrega", () => {
    for (const status of ["SHIPPED", "DELIVERED"] as const) {
      expect(toSellerOrderDto(row({ status })).shippingAddress?.street).toBe("Calle Secreta");
    }
  });

  it("cancelado o sin pagar: ni nombre ni domicilio, aunque la copia siga guardada", () => {
    for (const status of ["CANCELLED", "PENDING_PAYMENT"] as const) {
      const dto = toSellerOrderDto(row({ status }));
      expect(dto.buyerName).toBeNull();
      expect(dto.shippingAddress).toBeNull();
      expect(JSON.stringify(dto)).not.toMatch(/Secreta|Ana/);
    }
  });

  it("una copia de domicilio con otra forma no llega al vendedor a medias", () => {
    expect(toSellerOrderDto(row({ shippingAddress: { street: 42 } })).shippingAddress).toBeNull();
    expect(toSellerOrderDto(row({ shippingAddress: null })).shippingAddress).toBeNull();
  });
});

describe("toSellerOrderDto (SEC-01)", () => {
  it("marca el pago simulado y solo ofrece cancelar", () => {
    const dto = toSellerOrderDto(row({ checkout: { payments: [{ provider: "mock" }] } }));
    expect(dto.simulatedPayment).toBe(true);
    expect(dto.actions).toEqual(["CANCELLED"]);
  });

  it("con pago simulado no da el domicilio: no hay nada que enviar", () => {
    const dto = toSellerOrderDto(row({ checkout: { payments: [{ provider: "mock" }] } }));
    expect(dto.shippingAddress).toBeNull();
    expect(JSON.stringify(dto)).not.toMatch(/Secreta|5512345678/);
  });

  it("con cobro real ofrece enviar", () => {
    const dto = toSellerOrderDto(row());
    expect(dto.simulatedPayment).toBe(false);
    expect(dto.actions).toEqual(["SHIPPED"]);
  });
});
