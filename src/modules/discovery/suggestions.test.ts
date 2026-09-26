import { describe, expect, it } from "vitest";
import {
  MIN_FOLLOW_INTERMEDIARIES,
  rankSuggestions,
  scoreSuggestion,
  type SuggestionSignals,
  suggestionReasonText,
} from "./suggestions";

function signals(overrides: Partial<SuggestionSignals> & { userId: string }): SuggestionSignals {
  return {
    followedByFollowing: 0,
    sharedCommunities: [],
    commentsOnYourPosts: 0,
    ...overrides,
  };
}

describe("scoreSuggestion", () => {
  it("sin señales no hay sugerencia", () => {
    expect(scoreSuggestion(signals({ userId: "a" }))).toBeNull();
  });

  it("suma las señales y explica con la que más aportó", () => {
    const ranked = scoreSuggestion(
      signals({ userId: "a", followedByFollowing: 2, sharedCommunities: ["Gaming", "Deportes"] }),
    );
    expect(ranked).toEqual({
      userId: "a",
      score: 3 * 2 + 2,
      reason: { kind: "followed-by-following" },
    });
  });

  it("un comentario pesa más que dos personas en común", () => {
    const ranked = scoreSuggestion(
      signals({ userId: "a", followedByFollowing: 2, commentsOnYourPosts: 3 }),
    );
    expect(ranked?.reason).toEqual({ kind: "commented" });
    expect(ranked?.score).toBe(3 * 2 + 7);
  });

  it("los topes impiden que una sola señal enorme lo decida todo", () => {
    expect(scoreSuggestion(signals({ userId: "a", followedByFollowing: 40 }))?.score).toBe(15);
    expect(scoreSuggestion(signals({ userId: "a", commentsOnYourPosts: 50 }))?.score).toBe(7);
    expect(
      scoreSuggestion(signals({ userId: "a", sharedCommunities: ["A", "B", "C", "D", "E", "F"] }))
        ?.score,
    ).toBe(4);
  });

  it("en empate gana la señal de mayor prioridad (en común > comentó)", () => {
    const ranked = scoreSuggestion(
      signals({ userId: "a", followedByFollowing: 2, commentsOnYourPosts: 2 }),
    );
    expect(ranked?.reason).toEqual({ kind: "followed-by-following" });
  });

  it("con un solo intermediario la señal no cuenta: delataría a quién sigue esa persona (SEC-17)", () => {
    expect(MIN_FOLLOW_INTERMEDIARIES).toBe(2);
    expect(scoreSuggestion(signals({ userId: "a", followedByFollowing: 1 }))).toBeNull();
    const ranked = scoreSuggestion(
      signals({ userId: "a", followedByFollowing: 1, sharedCommunities: ["Gaming"] }),
    );
    expect(ranked).toEqual({
      userId: "a",
      score: 1,
      reason: { kind: "communities", names: ["Gaming"] },
    });
  });

  it("los «me gusta» no son una señal: nunca se revela quién dio «me gusta»", () => {
    // Aunque llegara el dato por error, no suma ni explica nada.
    const leaked = { ...signals({ userId: "a" }), likesOnYourPosts: 5 } as SuggestionSignals;
    expect(scoreSuggestion(leaked)).toBeNull();
    const ranked = scoreSuggestion({ ...leaked, sharedCommunities: ["Gaming"] });
    expect(ranked).toEqual({
      userId: "a",
      score: 1,
      reason: { kind: "communities", names: ["Gaming"] },
    });
  });

  it("ordena y deduplica los nombres de las comunidades", () => {
    const ranked = scoreSuggestion(
      signals({ userId: "a", sharedCommunities: ["Tecnología", "Deportes", "Tecnología"] }),
    );
    expect(ranked?.reason).toEqual({ kind: "communities", names: ["Deportes", "Tecnología"] });
  });
});

describe("rankSuggestions", () => {
  it("ordena por puntuación, empata por id y respeta el límite", () => {
    const ranked = rankSuggestions(
      [
        signals({ userId: "c", sharedCommunities: ["Gaming"] }),
        signals({ userId: "b", followedByFollowing: 2 }),
        signals({ userId: "a", followedByFollowing: 2 }),
        signals({ userId: "z" }),
        signals({ userId: "d", commentsOnYourPosts: 3 }),
      ],
      3,
    );
    expect(ranked.map((entry) => entry.userId)).toEqual(["d", "a", "b"]);
  });

  it("es determinista sin importar el orden de entrada", () => {
    const input = [
      signals({ userId: "b", sharedCommunities: ["Humor"] }),
      signals({ userId: "a", sharedCommunities: ["Gaming"] }),
      signals({ userId: "c", commentsOnYourPosts: 1 }),
    ];
    const forward = rankSuggestions(input, 10).map((entry) => entry.userId);
    const backward = rankSuggestions(input.toReversed(), 10).map((entry) => entry.userId);
    expect(forward).toEqual(["c", "a", "b"]);
    expect(backward).toEqual(forward);
  });

  it("en empate va primero quien tuvo actividad más reciente (no la cuenta más antigua)", () => {
    const ranked = rankSuggestions(
      [
        signals({ userId: "antigua", sharedCommunities: ["Gaming"], activityRank: 7 }),
        signals({ userId: "sin-actividad", sharedCommunities: ["Gaming"] }),
        signals({ userId: "zeta-reciente", sharedCommunities: ["Gaming"], activityRank: 0 }),
      ],
      10,
    );
    expect(ranked.map((entry) => entry.userId)).toEqual([
      "zeta-reciente",
      "antigua",
      "sin-actividad",
    ]);
  });

  it("la actividad solo desempata: la puntuación manda", () => {
    const ranked = rankSuggestions(
      [
        signals({ userId: "activa", sharedCommunities: ["Gaming"], activityRank: 0 }),
        signals({ userId: "en-comun", followedByFollowing: 2, activityRank: 30 }),
      ],
      10,
    );
    expect(ranked.map((entry) => entry.userId)).toEqual(["en-comun", "activa"]);
  });
});

describe("suggestionReasonText", () => {
  it.each([
    [{ kind: "followed-by-following" } as const, "La siguen personas que sigues"],
    [{ kind: "commented" } as const, "Comentó tu publicación"],
    [{ kind: "communities", names: ["Gaming"] } as const, "También está en Gaming"],
    [
      { kind: "communities", names: ["Deportes", "Gaming"] } as const,
      "También está en Deportes y Gaming",
    ],
    [
      { kind: "communities", names: ["Comida", "Gaming", "Tecnología"] } as const,
      "También está en Comida, Gaming y Tecnología",
    ],
    [
      { kind: "communities", names: ["Comida", "Deportes", "Gaming", "Humor"] } as const,
      "También está en Comida, Deportes y 2 más",
    ],
  ])("%o → «%s»", (reason, text) => {
    expect(suggestionReasonText(reason)).toBe(text);
  });
});
