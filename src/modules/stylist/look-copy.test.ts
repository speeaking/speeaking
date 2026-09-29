import { describe, expect, it } from "vitest";
import { guardLookCopy, lookCopySchema, lookCopyTask, ruleBasedLookCopy } from "./look-copy";
import type { Need } from "./need";

const need: Need = {
  occasion: "boda",
  style: "moderno",
  budgetMaxCents: 300_000,
  gender: null,
  timeOfDay: "noche",
  colors: [],
  keywords: ["boda"],
};

const input = {
  need,
  items: [
    { slot: "top" as const, title: "Camisa negra" },
    { slot: "bottom" as const, title: "Pantalón slim" },
    { slot: "shoes" as const, title: "Zapatos oxford" },
  ],
  index: 0,
};

describe("nombre del look", () => {
  it("el código arma un nombre honesto con la ocasión, el momento y el estilo", () => {
    expect(ruleBasedLookCopy(input)).toEqual({
      title: "Boda, de noche, moderno",
      explanation:
        "Combina parte de arriba, parte de abajo y calzado con productos disponibles dentro de tu presupuesto.",
    });
    expect(ruleBasedLookCopy({ ...input, index: 1 }).title).toBe(
      "Boda, de noche, moderno · opción 2",
    );
    expect(
      ruleBasedLookCopy({
        ...input,
        need: { ...need, occasion: null, style: null, timeOfDay: null },
        index: 2,
      }).title,
    ).toBe("Look 3");
  });

  it("la respuesta simulada cumple el esquema y el prompt no manda precios", () => {
    expect(lookCopySchema.safeParse(lookCopyTask.mock(input)).success).toBe(true);
    const { user } = lookCopyTask.messages(input);
    expect(user).not.toMatch(/\$|precio|cents/i);
    expect(user).toContain("Camisa negra");
  });

  it("el guardián descarta nombres con promesas, urgencia o descuentos", () => {
    const bad = {
      title: "Look garantizado",
      explanation: "Solo hoy con 20 % de descuento, apúrate.",
    };
    expect(guardLookCopy(bad, input)).toEqual(ruleBasedLookCopy(input));
    const good = {
      title: "Noche moderna",
      explanation: "Camisa y pantalón oscuros con un toque actual.",
    };
    expect(guardLookCopy(good, input)).toEqual(good);
  });
});
