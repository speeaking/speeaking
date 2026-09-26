import { describe, expect, it } from "vitest";
import {
  availableDeliveryMethods,
  cartFingerprint,
  commonPaymentMethods,
  computeOrderTotals,
  exceedsReservationLimit,
  fitsInInt32,
  MAX_INT32,
  orderShippingCents,
  restoredCartItems,
  sellerProfitCents,
} from "./checkout-math";

const shipsEverywhere = {
  pickupAvailable: true,
  localDeliveryAvailable: true,
  nationalShippingAvailable: true,
  shippingPriceCents: 9_900,
};

describe("availableDeliveryMethods", () => {
  it("solo ofrece métodos que TODOS los productos de un vendedor permiten", () => {
    expect(
      availableDeliveryMethods([shipsEverywhere, { ...shipsEverywhere, pickupAvailable: false }]),
    ).toEqual(["NATIONAL_SHIPPING", "LOCAL_DELIVERY"]);
  });

  it("sin métodos en común no hay forma de entregar", () => {
    expect(
      availableDeliveryMethods([
        { ...shipsEverywhere, localDeliveryAvailable: false, nationalShippingAvailable: false },
        {
          ...shipsEverywhere,
          pickupAvailable: false,
          localDeliveryAvailable: false,
          nationalShippingAvailable: false,
        },
      ]),
    ).toEqual([]);
  });
});

describe("orderShippingCents", () => {
  it("envío nacional: se cobra el envío más alto del pedido (un paquete por vendedor)", () => {
    expect(
      orderShippingCents("NATIONAL_SHIPPING", [
        { shippingPriceCents: 9_900 },
        { shippingPriceCents: 14_900 },
      ]),
    ).toBe(14_900);
  });

  it("recoger o entrega local no cobran envío", () => {
    expect(orderShippingCents("PICKUP", [{ shippingPriceCents: 9_900 }])).toBe(0);
    expect(orderShippingCents("LOCAL_DELIVERY", [{ shippingPriceCents: 9_900 }])).toBe(0);
  });
});

describe("computeOrderTotals", () => {
  it("la comisión de la plataforma se descuenta al vendedor, no se suma al comprador", () => {
    const totals = computeOrderTotals({
      lines: [
        { unitPriceCents: 349_900, quantity: 2 },
        { unitPriceCents: 34_900, quantity: 1 },
      ],
      shippingCents: 9_900,
      platformFeeBps: 500,
    });

    expect(totals).toEqual({
      subtotalCents: 734_700,
      shippingCents: 9_900,
      platformFeeCents: 36_735,
      totalCents: 744_600,
    });
  });
});

describe("commonPaymentMethods", () => {
  it("intersección de lo que aceptan todos los vendedores del carrito", () => {
    expect(
      commonPaymentMethods([
        ["CARD", "TRANSFER", "OXXO"],
        ["CARD", "TRANSFER"],
      ]),
    ).toEqual(["CARD", "TRANSFER"]);
    expect(commonPaymentMethods([])).toEqual([]);
  });
});

describe("sellerProfitCents (P2: beneficio real del vendedor)", () => {
  it("ventas − costo − comisión − comisión estimada del procesador", () => {
    expect(
      sellerProfitCents({
        lines: [{ unitPriceCents: 349_900, unitCostCents: 240_000, quantity: 2 }],
        platformFeeCents: 0,
        paymentFeeBps: 350,
      }),
    ).toBe(2 * 109_900 - Math.round(699_800 * 0.035));
  });
});

describe("cartFingerprint", () => {
  const airpods = {
    productId: "a",
    quantity: 1,
    unitPriceCents: 349_900,
    shippingPriceCents: 9_900,
  };
  const funda = { productId: "b", quantity: 2, unitPriceCents: 19_900, shippingPriceCents: null };

  it("no depende del orden de las líneas", () => {
    expect(cartFingerprint([airpods, funda])).toBe(cartFingerprint([funda, airpods]));
  });

  it("cambia si cambian las piezas, el precio, el envío o aparece otro producto", () => {
    const base = cartFingerprint([airpods]);
    expect(cartFingerprint([{ ...airpods, quantity: 2 }])).not.toBe(base);
    expect(cartFingerprint([{ ...airpods, unitPriceCents: 299_900 }])).not.toBe(base);
    expect(cartFingerprint([{ ...airpods, shippingPriceCents: 14_900 }])).not.toBe(base);
    expect(cartFingerprint([{ ...airpods, shippingPriceCents: null }])).not.toBe(base);
    expect(cartFingerprint([{ ...airpods, shippingPriceCents: 0 }])).not.toBe(
      cartFingerprint([{ ...airpods, shippingPriceCents: null }]),
    );
    expect(cartFingerprint([airpods, funda])).not.toBe(base);
  });
});

describe("restoredCartItems", () => {
  it("un pedido cancelado regresa al carrito con su publicación de origen", () => {
    expect(
      restoredCartItems([{ productId: "a", quantity: 2, sourcePostId: "post-1" }], [], 10),
    ).toEqual([{ productId: "a", quantity: 2, sourcePostId: "post-1" }]);
  });

  it("se suma a lo que ya estaba en el carrito sin pasar del tope por producto", () => {
    expect(
      restoredCartItems(
        [
          { productId: "a", quantity: 4, sourcePostId: null },
          { productId: "b", quantity: 1, sourcePostId: null },
        ],
        [{ productId: "a", quantity: 8 }],
        10,
      ),
    ).toEqual([
      { productId: "a", quantity: 10, sourcePostId: null },
      { productId: "b", quantity: 1, sourcePostId: null },
    ]);
  });

  it("junta las piezas repetidas de un mismo producto", () => {
    expect(
      restoredCartItems(
        [
          { productId: "a", quantity: 1, sourcePostId: null },
          { productId: "a", quantity: 2, sourcePostId: "post-2" },
        ],
        [{ productId: "a", quantity: 1 }],
        10,
      ),
    ).toEqual([{ productId: "a", quantity: 4, sourcePostId: "post-2" }]);
  });
});

describe("fitsInInt32 (SEC-23)", () => {
  it("el precio máximo por 10 piezas ya no cabe en una columna int4", () => {
    expect(fitsInInt32(1_000_000_000)).toBe(true);
    expect(fitsInInt32(MAX_INT32)).toBe(true);
    expect(fitsInInt32(1_000_000_000 * 10)).toBe(false);
    expect(fitsInInt32(MAX_INT32 + 1)).toBe(false);
  });

  it("rechaza negativos, fracciones y valores no finitos", () => {
    for (const value of [-1, 0.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(fitsInInt32(value)).toBe(false);
    }
  });
});

describe("exceedsReservationLimit (SEC-05)", () => {
  it("suma lo que la persona ya apartó sin pagar con lo que pide ahora", () => {
    expect(exceedsReservationLimit([{ productId: "a", quantity: 10 }], [], 10)).toBe(false);
    expect(
      exceedsReservationLimit(
        [{ productId: "a", quantity: 1 }],
        [{ productId: "a", quantity: 10 }],
        10,
      ),
    ).toBe(true);
    expect(
      exceedsReservationLimit(
        [{ productId: "a", quantity: 4 }],
        [{ productId: "a", quantity: 6 }],
        10,
      ),
    ).toBe(false);
  });

  it("lo apartado de otros productos no cuenta", () => {
    expect(
      exceedsReservationLimit(
        [{ productId: "a", quantity: 5 }],
        [{ productId: "b", quantity: 10 }],
        10,
      ),
    ).toBe(false);
  });
});
