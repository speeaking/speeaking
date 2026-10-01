import { describe, expect, it } from "vitest";
import { applyReaction, REACTIONS, reactionMeta, TOP_REACTIONS, topReactions } from "./reactions";

describe("REACTIONS", () => {
  it("son seis, empiezan por «Me gusta» y cada una tiene emoji y etiqueta distintos", () => {
    expect(REACTIONS).toHaveLength(6);
    expect(REACTIONS[0]).toMatchObject({ kind: "LIKE", label: "Me gusta" });
    expect(new Set(REACTIONS.map((reaction) => reaction.emoji)).size).toBe(6);
    expect(new Set(REACTIONS.map((reaction) => reaction.label)).size).toBe(6);
  });

  it("reactionMeta devuelve la ficha de cada tipo", () => {
    expect(reactionMeta("HAHA")).toEqual({ kind: "HAHA", emoji: "😂", label: "Me divierte" });
  });
});

describe("topReactions", () => {
  it("ordena por cantidad, deja fuera los ceros y corta en tres", () => {
    expect(TOP_REACTIONS).toBe(3);
    expect(topReactions({ LIKE: 2, HAHA: 9, WOW: 5, SAD: 0, ANGRY: 1 })).toEqual([
      "HAHA",
      "WOW",
      "LIKE",
    ]);
  });

  it("en empate manda el orden fijo de la tira (❤️ antes que 😡)", () => {
    expect(topReactions({ ANGRY: 3, LIKE: 3, CARE: 3 })).toEqual(["LIKE", "CARE", "ANGRY"]);
  });

  it("sin reacciones devuelve una lista vacía", () => {
    expect(topReactions({})).toEqual([]);
  });
});

describe("applyReaction (estado optimista)", () => {
  const empty = { kind: null, count: 0, top: [] as const };

  it("agregar suma uno y mete el emoji en el resumen", () => {
    expect(applyReaction(empty, "HAHA")).toEqual({ kind: "HAHA", count: 1, top: ["HAHA"] });
  });

  it("cambiar de reacción no mueve el total y suma el nuevo emoji al resumen", () => {
    const state = { kind: "LIKE", count: 4, top: ["LIKE"] } as const;
    expect(applyReaction(state, "WOW")).toEqual({ kind: "WOW", count: 4, top: ["LIKE", "WOW"] });
  });

  it("quitar (null) resta uno y, si no queda nadie, vacía el resumen", () => {
    expect(applyReaction({ kind: "LIKE", count: 1, top: ["LIKE"] }, null)).toEqual({
      kind: null,
      count: 0,
      top: [],
    });
    expect(applyReaction({ kind: "SAD", count: 7, top: ["LIKE", "SAD"] }, null)).toEqual({
      kind: null,
      count: 6,
      top: ["LIKE", "SAD"],
    });
  });

  it("el total nunca baja de cero aunque el estado venga desfasado", () => {
    expect(applyReaction({ kind: "LIKE", count: 0, top: [] }, null).count).toBe(0);
  });

  it("el resumen no pasa de tres emojis", () => {
    const state = { kind: null, count: 10, top: ["LIKE", "HAHA", "WOW"] } as const;
    expect(applyReaction(state, "ANGRY").top).toEqual(["LIKE", "HAHA", "WOW"]);
  });

  it("sin reacción, quitar no cambia nada", () => {
    expect(applyReaction(empty, null)).toEqual({ kind: null, count: 0, top: [] });
  });
});
