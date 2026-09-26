import { describe, expect, it } from "vitest";
import {
  answerQuickQuestion,
  localDeliveryLine,
  nationalShippingLine,
  type ProductFacts,
  QUICK_QUESTIONS,
  stockLabel,
} from "./quick-answers";

const airpods: ProductFacts = {
  status: "ACTIVE",
  stock: 12,
  city: "Ciudad de México",
  state: "CDMX",
  pickupAvailable: true,
  localDeliveryAvailable: true,
  localDeliveryZones: ["Coyoacán", "Benito Juárez"],
  nationalShippingAvailable: true,
  shippingPriceCents: 9_900,
  currency: "MXN",
  deliveryMinDays: 2,
  deliveryMaxDays: 5,
  warrantyType: "SELLER",
  warrantyDays: 90,
  returnWindowDays: 7,
  authenticity: "DECLARED_ORIGINAL",
  acceptedPaymentMethods: ["CARD", "TRANSFER"],
};

const localOnly: ProductFacts = {
  ...airpods,
  nationalShippingAvailable: false,
  shippingPriceCents: null,
};

describe("answerQuickQuestion (P4: solo datos verificables)", () => {
  it("disponibilidad con las piezas exactas", () => {
    expect(answerQuickQuestion("availability", airpods)).toBe(
      "Sí, está disponible: quedan 12 piezas.",
    );
    expect(answerQuickQuestion("availability", { ...airpods, stock: 1 })).toBe(
      "Sí, está disponible: queda 1 pieza.",
    );
    expect(answerQuickQuestion("availability", { ...airpods, stock: 1_250 })).toBe(
      "Sí, está disponible: quedan 1,250 piezas.",
    );
    expect(answerQuickQuestion("availability", { ...airpods, stock: 0 })).toBe(
      "Por ahora está agotado.",
    );
    expect(answerQuickQuestion("availability", { ...airpods, status: "PAUSED" })).toBe(
      "El vendedor pausó este producto por ahora.",
    );
  });

  it("envíos con costo, tiempos y entrega local sin costo (misma regla que el checkout)", () => {
    expect(answerQuickQuestion("shipping", airpods)).toBe(
      "Sí, el vendedor envía a todo México por $99 y te llega en 2 a 5 días. Entrega local sin costo en Coyoacán y Benito Juárez.",
    );
    expect(
      answerQuickQuestion("shipping", {
        ...airpods,
        shippingPriceCents: 0,
        localDeliveryAvailable: false,
        localDeliveryZones: [],
      }),
    ).toBe("Sí, el vendedor envía gratis a todo México y te llega en 2 a 5 días.");
  });

  it("solo entrega local: no promete envío nacional", () => {
    expect(answerQuickQuestion("shipping", localOnly)).toBe(
      "El vendedor no envía a todo México. Entrega local sin costo en Coyoacán y Benito Juárez.",
    );
  });

  it("sin envío nacional lo dice sin inventar alternativas", () => {
    expect(
      answerQuickQuestion("shipping", {
        ...airpods,
        nationalShippingAvailable: false,
        localDeliveryAvailable: false,
        localDeliveryZones: [],
      }),
    ).toBe("El vendedor no ofrece envíos por ahora.");
  });

  it("garantía, devoluciones y autenticidad declarada (sin afirmar lo no verificado)", () => {
    expect(answerQuickQuestion("warranty", airpods)).toBe(
      "Sí, tiene garantía del vendedor por 90 días.",
    );
    expect(answerQuickQuestion("warranty", { ...airpods, warrantyType: "NONE" })).toBe(
      "El vendedor no ofrece garantía.",
    );
    expect(answerQuickQuestion("returns", airpods)).toBe(
      "Sí, el vendedor acepta devoluciones dentro de 7 días.",
    );
    expect(answerQuickQuestion("returns", { ...airpods, returnWindowDays: 0 })).toBe(
      "El vendedor no acepta devoluciones.",
    );
    expect(answerQuickQuestion("authenticity", airpods)).toBe(
      "El vendedor declara que es original. No es una verificación de la plataforma.",
    );
  });

  it("métodos de pago según lo que el vendedor configuró", () => {
    expect(answerQuickQuestion("payment", airpods)).toBe(
      "El vendedor acepta tarjeta y transferencia.",
    );
    expect(answerQuickQuestion("payment", { ...airpods, acceptedPaymentMethods: [] })).toBe(
      "El vendedor no lo ha especificado.",
    );
  });

  it("recoger en persona sin revelar una dirección exacta", () => {
    expect(answerQuickQuestion("pickup", airpods)).toBe(
      "Sí, puedes recogerlo en Ciudad de México, CDMX. El punto exacto lo acuerdas con el vendedor.",
    );
    // No contradice a la entrega local: solo niega recoger, no entregar.
    expect(answerQuickQuestion("pickup", { ...airpods, pickupAvailable: false })).toBe(
      "No se puede recoger en persona.",
    );
  });

  it("'¿Sigue disponible?' va al final: la ficha ya muestra las existencias", () => {
    expect(QUICK_QUESTIONS.at(-1)?.id).toBe("availability");
  });
});

describe("líneas declarativas de la ficha", () => {
  it("existencias", () => {
    expect(stockLabel(airpods)).toBe("Disponible · 12 piezas");
    expect(stockLabel({ ...airpods, stock: 1 })).toBe("Disponible · 1 pieza");
    expect(stockLabel({ ...airpods, stock: 1_250 })).toBe("Disponible · 1,250 piezas");
    expect(stockLabel({ ...airpods, stock: 0 })).toBe("Agotado");
    expect(stockLabel({ ...airpods, status: "SOLD_OUT" })).toBe("Agotado");
    expect(stockLabel({ ...airpods, status: "PAUSED" })).toBe("Pausado por el vendedor");
  });

  it("envío nacional con su costo en centavos y tiempos", () => {
    expect(
      nationalShippingLine({
        ...airpods,
        shippingPriceCents: 14_900,
        deliveryMinDays: 3,
        deliveryMaxDays: 7,
      }),
    ).toBe("+ $149 de envío a todo México · 3 a 7 días");
    expect(nationalShippingLine({ ...airpods, shippingPriceCents: 0 })).toBe(
      "Envío gratis a todo México · 2 a 5 días",
    );
    expect(nationalShippingLine({ ...airpods, deliveryMinDays: 3, deliveryMaxDays: 3 })).toBe(
      "+ $99 de envío a todo México · 3 días",
    );
    expect(nationalShippingLine({ ...airpods, deliveryMinDays: 1, deliveryMaxDays: 1 })).toBe(
      "+ $99 de envío a todo México · 1 día",
    );
    expect(nationalShippingLine({ ...airpods, deliveryMinDays: null, deliveryMaxDays: null })).toBe(
      "+ $99 de envío a todo México",
    );
    // Sin tarifa el checkout no ofrece envío nacional: la ficha tampoco.
    expect(nationalShippingLine({ ...airpods, shippingPriceCents: null })).toBeNull();
    expect(nationalShippingLine(localOnly)).toBeNull();
  });

  it("entrega local solo cuando el checkout la ofrece y hay zonas que nombrar", () => {
    expect(localDeliveryLine(airpods)).toBe("Entrega local sin costo en Coyoacán y Benito Juárez");
    expect(localDeliveryLine({ ...airpods, localDeliveryZones: ["Zapopan"] })).toBe(
      "Entrega local sin costo en Zapopan",
    );
    expect(localDeliveryLine({ ...airpods, localDeliveryZones: [] })).toBeNull();
    // Misma columna que lee el checkout: si no la ofrece ahí, la ficha no la promete.
    expect(localDeliveryLine({ ...airpods, localDeliveryAvailable: false })).toBeNull();
    expect(answerQuickQuestion("shipping", { ...airpods, localDeliveryAvailable: false })).toBe(
      "Sí, el vendedor envía a todo México por $99 y te llega en 2 a 5 días.",
    );
  });

  it("'y' pasa a 'e' ante el sonido /i/, salvo diptongo", () => {
    const zones = (localDeliveryZones: string[]) =>
      localDeliveryLine({ ...airpods, localDeliveryZones });
    expect(zones(["Coyoacán", "Iztapalapa"])).toBe(
      "Entrega local sin costo en Coyoacán e Iztapalapa",
    );
    expect(zones(["Tlalpan", "Coyoacán", "Hidalgo"])).toBe(
      "Entrega local sin costo en Tlalpan, Coyoacán e Hidalgo",
    );
    expect(zones(["Centro", "Hierro Viejo"])).toBe(
      "Entrega local sin costo en Centro y Hierro Viejo",
    );
  });
});
