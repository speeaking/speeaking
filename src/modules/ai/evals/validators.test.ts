import { describe, expect, it } from "vitest";
import {
  allowedNumbers,
  hasContactOrPayment,
  hasDarkPattern,
  inventedNumbers,
  isSpanish,
  numbersIn,
  pesos,
  unsupportedClaims,
} from "./validators";

describe("inventedNumbers (P2)", () => {
  const allowed = allowedNumbers([pesos(349_900), 50, pesos(30_000), 15]);

  it("acepta el precio confirmado en cualquier formato y la cantidad", () => {
    expect(
      inventedNumbers(
        "AirPods Pro 2 a $3,499 (3499 pesos, $3,499.00). Quedan 50.",
        allowed,
        "AirPods Pro 2",
      ),
    ).toEqual([]);
  });

  it("marca cifras que no están en los datos: otro precio, descuentos, días o specs", () => {
    expect(
      inventedNumbers(
        "Antes $4,200, hoy con 20 % de descuento. Te llega en 2 días y la batería dura 30 horas.",
        allowed,
        "AirPods Pro 2",
      ),
    ).toEqual(["4200", "20", "2", "30"]);
  });

  it("no cuenta las cifras del nombre del producto ni las duraciones del guion de video", () => {
    expect(
      inventedNumbers(
        "0–3 s: muestra los AirPods Pro 2. 3–8 s: úsalos. Video de 15 segundos.",
        allowed,
        "AirPods Pro 2",
      ),
    ).toEqual([]);
  });

  it("los centavos se comparan con el precio exacto", () => {
    const salsa = allowedNumbers([pesos(8_950)]);
    expect(inventedNumbers("Salsa a $89.50", salsa, "Salsa")).toEqual([]);
    expect(inventedNumbers("Salsa a $89.90", salsa, "Salsa")).toEqual(["89.9"]);
  });

  it("numbersIn normaliza separadores de miles", () => {
    expect(numbersIn("$489,000 y 100000 piezas")).toEqual(["489000", "100000"]);
  });
});

describe("unsupportedClaims (P4)", () => {
  it("marca garantía, originalidad y envío gratis que no respaldan los datos", () => {
    expect(
      unsupportedClaims("Originales, con garantía y envío gratis.", "Tenis Nike Air Max 90"),
    ).toEqual(["warranty", "authenticity", "free_shipping", "national_shipping"]);
  });

  it("permite las afirmaciones que sí respaldan los datos del producto", () => {
    expect(
      unsupportedClaims(
        "Garantía del vendedor y envío a todo México.",
        "Bocina",
        new Set(["warranty", "national_shipping"]),
      ),
    ).toEqual([]);
  });

  it("repetir el nombre confirmado no es una afirmación del modelo", () => {
    expect(unsupportedClaims("Tenis Nike originales en caja.", "Tenis Nike originales")).toEqual(
      [],
    );
  });
});

describe("hasDarkPattern y hasContactOrPayment", () => {
  it.each(["¡Últimas piezas!", "Solo hoy", "Se están agotando", "Apúrate, stock limitado"])(
    "detecta urgencia: «%s»",
    (text) => expect(hasDarkPattern(text)).toBe(true),
  );

  it("no confunde un texto normal con urgencia", () => {
    expect(hasDarkPattern("Escríbeme y te cuento más de los colores.")).toBe(false);
  });

  it.each([
    "Mándame WhatsApp al 55 1234 5678",
    "Más info en mitienda.com",
    "Deposítame y te lo envío",
  ])("detecta contacto o pago por fuera: «%s»", (text) => {
    expect(hasContactOrPayment(text)).toBe(true);
  });
});

describe("isSpanish", () => {
  it("reconoce español con palabras en inglés de marcas o modas", () => {
    expect(
      isSpanish("Hoodie oversize de algodón para el frío, con capucha y bolsa al frente."),
    ).toBe(true);
  });

  it("rechaza texto en inglés", () => {
    expect(
      isSpanish("Get the best oversized hoodie for your style and comfort, it is the one."),
    ).toBe(false);
  });
});
