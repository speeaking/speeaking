import { describe, expect, it } from "vitest";
import {
  fitsBudget,
  type IntentProductCandidate,
  type IntentQuery,
  pickIntentProduct,
  queryStems,
  scoreIntentMatch,
} from "./intent-match";

const RUNNING: IntentQuery = {
  query: "Tenis para correr",
  categoryId: null,
  budgetMaxCents: 200_000,
};

function product(
  overrides: Partial<IntentProductCandidate> & { id: string },
): IntentProductCandidate {
  return {
    title: "Producto",
    tags: [],
    categoryId: "cat-otro",
    priceCents: 100_000,
    publishedAt: new Date("2026-09-20T12:00:00Z"),
    ...overrides,
  };
}

describe("queryStems", () => {
  it("ignora acentos, mayúsculas, palabras vacías y palabras cortas", () => {
    expect(queryStems("Busco unos Audífonos para el GYM")).toEqual(["audif"]);
    expect(queryStems("tenis para correr")).toEqual(["tenis", "corre"]);
  });
});

describe("scoreIntentMatch", () => {
  it("cuenta una coincidencia por raíz en el título o las etiquetas", () => {
    expect(
      scoreIntentMatch(RUNNING, product({ id: "a", title: "Tenis para correr ultraligeros" })),
    ).toBe(2);
    expect(scoreIntentMatch(RUNNING, product({ id: "b", title: "Tenis blancos" }))).toBe(1);
    expect(
      scoreIntentMatch(RUNNING, product({ id: "c", title: "Zapatos", tags: ["correr"] })),
    ).toBe(1);
    expect(scoreIntentMatch(RUNNING, product({ id: "d", title: "Prensa francesa" }))).toBe(0);
  });

  it("suma la categoría cuando la intención tiene una", () => {
    const intent = { ...RUNNING, categoryId: "cat-tenis" };
    expect(
      scoreIntentMatch(intent, product({ id: "a", title: "Sandalias", categoryId: "cat-tenis" })),
    ).toBe(1);
  });
});

describe("fitsBudget", () => {
  it("respeta el tope y acepta cualquier precio sin presupuesto", () => {
    expect(fitsBudget(200_000, 200_000)).toBe(true);
    expect(fitsBudget(200_001, 200_000)).toBe(false);
    expect(fitsBudget(9_999_999, null)).toBe(true);
  });
});

describe("pickIntentProduct", () => {
  it("elige el que más coincide dentro del presupuesto", () => {
    const best = pickIntentProduct(RUNNING, [
      product({ id: "a", title: "Tenis blancos" }),
      product({ id: "b", title: "Tenis para correr ultraligeros", priceCents: 149_900 }),
      product({ id: "c", title: "Tenis para correr profesionales", priceCents: 350_000 }),
    ]);
    expect(best?.id).toBe("b");
  });

  it("nunca elige algo fuera del presupuesto aunque coincida mejor", () => {
    const best = pickIntentProduct(RUNNING, [
      product({ id: "caro", title: "Tenis para correr", priceCents: 200_001 }),
    ]);
    expect(best).toBeNull();
  });

  it("devuelve null si nada coincide", () => {
    expect(pickIntentProduct(RUNNING, [product({ id: "a", title: "Maceta de barro" })])).toBeNull();
  });

  it("empata por lo más reciente y luego por id (determinista)", () => {
    const older = product({ id: "b", title: "Tenis", publishedAt: new Date("2026-09-01") });
    const newer = product({ id: "c", title: "Tenis", publishedAt: new Date("2026-09-10") });
    const twin = product({ id: "a", title: "Tenis", publishedAt: new Date("2026-09-10") });
    expect(pickIntentProduct(RUNNING, [older, newer, twin])?.id).toBe("a");
    expect(pickIntentProduct(RUNNING, [twin, newer, older])?.id).toBe("a");
  });
});
