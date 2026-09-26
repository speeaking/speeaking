import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_POLICY } from "./policy";
import {
  type Candidate,
  categoryIntentScores,
  CURSOR_MAX_AGE_MS,
  decodeCursor,
  encodeCursor,
  fitsDeclaredBudget,
  type IntentQuery,
  mixFeed,
  rankCandidates,
  textIntentMatch,
  type ViewerContext,
} from "./ranking";

const NOW = new Date("2026-09-25T12:00:00Z");
const HOUR = 3_600_000;

function candidate(overrides: Partial<Candidate> & { id: string }): Candidate {
  return {
    authorId: `author-${overrides.id}`,
    communityId: null,
    categoryId: null,
    isCommerce: false,
    productText: "",
    publishedAt: new Date(NOW.getTime() - HOUR),
    likeCount: 0,
    commentCount: 0,
    saveCount: 0,
    ...overrides,
  };
}

const emptyContext: ViewerContext = {
  communityIds: new Set(),
  followingIds: new Set(),
  categoryIntent: new Map(),
  viewedCategoryIds: new Set(),
  intentQueries: [],
};

const declared = (query: string, extra: Partial<IntentQuery> = {}): IntentQuery => ({
  query,
  source: "declared",
  categoryId: null,
  budgetMaxCents: null,
  ...extra,
});
const searched = (query: string): IntentQuery => ({
  query,
  source: "search",
  categoryId: null,
  budgetMaxCents: null,
});

describe("rankCandidates", () => {
  it("prefiere lo reciente cuando todo lo demás es igual", () => {
    const [first] = rankCandidates(
      [
        candidate({ id: "viejo", publishedAt: new Date(NOW.getTime() - 72 * HOUR) }),
        candidate({ id: "nuevo", publishedAt: new Date(NOW.getTime() - HOUR) }),
      ],
      emptyContext,
      DEFAULT_FEED_POLICY,
      NOW,
    );
    expect(first?.candidate.id).toBe("nuevo");
  });

  it("sube el contenido de comunidades propias y de cuentas seguidas, con su motivo", () => {
    const context: ViewerContext = {
      ...emptyContext,
      communityIds: new Set(["gaming"]),
      followingIds: new Set(["author-seguido"]),
    };
    const ranked = rankCandidates(
      [
        candidate({ id: "ajeno" }),
        candidate({ id: "comunidad", communityId: "gaming" }),
        candidate({ id: "seguido" }),
      ],
      context,
      DEFAULT_FEED_POLICY,
      NOW,
    );
    expect(ranked.map((item) => item.candidate.id)).toEqual(["seguido", "comunidad", "ajeno"]);
    expect(ranked.map((item) => item.reason)).toEqual(["follow", "community", "explore"]);
  });

  it("la intención de compra solo impulsa productos, no contenido", () => {
    const context: ViewerContext = {
      ...emptyContext,
      categoryIntent: new Map([["audio", 0.9]]),
    };
    const ranked = rankCandidates(
      [
        candidate({ id: "post", categoryId: "audio" }),
        candidate({ id: "producto", categoryId: "audio", isCommerce: true }),
      ],
      context,
      DEFAULT_FEED_POLICY,
      NOW,
    );
    const product = ranked.find((item) => item.candidate.id === "producto")!;
    const post = ranked.find((item) => item.candidate.id === "post")!;
    expect(product.reason).toBe("intent");
    expect(product.score).toBeGreaterThan(post.score);
  });

  it("devuelve la búsqueda que coincidió, con su origen, para explicarla en la tarjeta", () => {
    const context: ViewerContext = {
      ...emptyContext,
      intentQueries: [declared("tenis para correr"), searched("audífonos")],
    };
    const [tenis, audio, silla] = rankCandidates(
      [
        candidate({ id: "tenis", isCommerce: true, productText: "Tenis ultraligeros correr" }),
        candidate({
          id: "audio",
          isCommerce: true,
          productText: "AirPods audifonos",
          publishedAt: new Date(NOW.getTime() - 2 * HOUR),
        }),
        candidate({
          id: "silla",
          isCommerce: true,
          productText: "Silla gamer",
          publishedAt: new Date(NOW.getTime() - 3 * HOUR),
        }),
      ],
      context,
      DEFAULT_FEED_POLICY,
      NOW,
    );

    expect(tenis?.intent).toEqual({
      basis: "query",
      query: "tenis para correr",
      source: "declared",
    });
    expect(audio?.intent).toEqual({ basis: "query", query: "audífonos", source: "search" });
    expect(silla?.reason).toBe("explore");
    expect(silla?.intent).toBeNull();
  });

  it("por categoría solo dice «lo que has visto» si la persona vio esa categoría", () => {
    const context: ViewerContext = {
      ...emptyContext,
      categoryIntent: new Map([
        ["audio", 0.9],
        ["tenis", 0.9],
      ]),
      viewedCategoryIds: new Set(["audio"]),
    };
    const ranked = rankCandidates(
      [
        candidate({ id: "visto", categoryId: "audio", isCommerce: true }),
        candidate({ id: "declarado", categoryId: "tenis", isCommerce: true }),
      ],
      context,
      DEFAULT_FEED_POLICY,
      NOW,
    );
    const seen = ranked.find((item) => item.candidate.id === "visto")!;
    const other = ranked.find((item) => item.candidate.id === "declarado")!;

    expect(seen.intent).toEqual({ basis: "viewed", categoryId: "audio" });
    // La intención existe (sube en el ranking) pero no hay una explicación honesta que mostrar.
    expect(other.reason).toBe("intent");
    expect(other.intent).toBeNull();
  });

  it("el contenido nunca trae explicación de intención", () => {
    const context: ViewerContext = {
      ...emptyContext,
      intentQueries: [declared("tenis para correr")],
    };
    const [post] = rankCandidates(
      [candidate({ id: "post", productText: "tenis para correr" })],
      context,
      DEFAULT_FEED_POLICY,
      NOW,
    );
    expect(post?.intent).toBeNull();
  });
});

describe("mixFeed", () => {
  const content = Array.from({ length: 30 }, (_, index) =>
    candidate({ id: `c${index}`, authorId: `a${index % 6}`, communityId: "mia" }),
  );
  const commerce = Array.from({ length: 10 }, (_, index) =>
    candidate({ id: `p${index}`, authorId: `s${index}`, isCommerce: true }),
  );
  const context: ViewerContext = { ...emptyContext, communityIds: new Set(["mia"]) };
  const ranked = rankCandidates([...content, ...commerce], context, DEFAULT_FEED_POLICY, NOW);

  it("respeta el tope comercial: como máximo 1 de cada N posiciones", () => {
    const mixed = mixFeed(ranked, DEFAULT_FEED_POLICY);
    const commercePositions = mixed
      .filter((item) => item.slot === "commerce")
      .map((item) => item.position);

    expect(commercePositions[0]).toBe(DEFAULT_FEED_POLICY.commerceSlotEvery - 1);
    for (let index = 1; index < commercePositions.length; index += 1) {
      expect(commercePositions[index]! - commercePositions[index - 1]!).toBeGreaterThanOrEqual(
        DEFAULT_FEED_POLICY.commerceSlotEvery,
      );
    }
    expect(commercePositions.length).toBeLessThanOrEqual(
      Math.ceil(mixed.length / DEFAULT_FEED_POLICY.commerceSlotEvery),
    );
  });

  it("no repite autor dentro de la ventana de diversidad cuando hay alternativas", () => {
    const mixed = mixFeed(ranked, DEFAULT_FEED_POLICY);
    const window = DEFAULT_FEED_POLICY.authorWindow;
    const contentOnly = mixed.slice(0, 12);
    for (let index = 0; index < contentOnly.length; index += 1) {
      const recent = contentOnly.slice(Math.max(0, index - window + 1), index);
      expect(recent.map((item) => item.candidate.authorId)).not.toContain(
        contentOnly[index]!.candidate.authorId,
      );
    }
  });

  it("intercala exploración para no encerrar a la persona en una burbuja", () => {
    const explore = Array.from({ length: 10 }, (_, index) =>
      candidate({ id: `e${index}`, authorId: `x${index}`, communityId: "otra" }),
    );
    const withExplore = rankCandidates([...content, ...explore], context, DEFAULT_FEED_POLICY, NOW);
    const mixed = mixFeed(withExplore, DEFAULT_FEED_POLICY).slice(0, 20);

    expect(mixed.some((item) => item.reason === "explore")).toBe(true);
  });

  it("incluye cada elemento una sola vez y numera posiciones consecutivas", () => {
    const mixed = mixFeed(ranked, DEFAULT_FEED_POLICY);
    const ids = mixed.map((item) => item.candidate.id);

    expect(new Set(ids).size).toBe(ids.length);
    expect(mixed.map((item) => item.position)).toEqual(mixed.map((_, index) => index));
  });
});

describe("categoryIntentScores", () => {
  it("acumula señales con decaimiento y devuelve valores entre 0 y 1", () => {
    const scores = categoryIntentScores([
      { categoryId: "audio", type: "PRODUCT_VIEW", ageHours: 1 },
      { categoryId: "audio", type: "PRODUCT_VIEW", ageHours: 2 },
      { categoryId: "audio", type: "SAVE", ageHours: 3 },
      { categoryId: "tenis", type: "PRODUCT_VIEW", ageHours: 24 * 20 },
    ]);

    expect(scores.get("audio")).toBeGreaterThan(0.5);
    expect(scores.get("audio")).toBeLessThanOrEqual(1);
    expect(scores.get("tenis") ?? 0).toBeLessThan(0.1);
  });
});

describe("textIntentMatch", () => {
  it("relaciona lo que la persona dijo buscar con el producto, sin acentos ni mayúsculas", () => {
    const query = declared("Audífonos para el metro");
    expect(textIntentMatch([query], "AirPods Pro 2 audifonos inalambricos")).toBe(query);
    expect(textIntentMatch([declared("laptop para editar")], "Tenis para correr")).toBeNull();
  });

  it("devuelve la primera búsqueda que coincide", () => {
    const first = declared("tenis blancos");
    const second = searched("tenis para correr");
    expect(textIntentMatch([declared("laptop"), first, second], "Tenis de running")).toBe(first);
  });
});

describe("fitsDeclaredBudget", () => {
  const tenis = { categoryId: "calzado", productText: "Tenis para correr", priceCents: 149_900 };

  it("cabe si el precio no pasa del presupuesto declarado para ese producto", () => {
    const budget = declared("tenis para correr", { budgetMaxCents: 200_000 });
    expect(fitsDeclaredBudget([budget], tenis)).toBe(true);
    expect(fitsDeclaredBudget([budget], { ...tenis, priceCents: 200_000 })).toBe(true);
    expect(fitsDeclaredBudget([budget], { ...tenis, priceCents: 200_001 })).toBe(false);
  });

  it("también cuenta la categoría declarada, aunque el texto no coincida", () => {
    const budget = declared("algo para el gym", {
      categoryId: "calzado",
      budgetMaxCents: 200_000,
    });
    expect(fitsDeclaredBudget([budget], tenis)).toBe(true);
  });

  it("no usa presupuestos de otra cosa, ni búsquedas sin presupuesto", () => {
    expect(
      fitsDeclaredBudget([declared("laptop para editar", { budgetMaxCents: 2_000_000 })], tenis),
    ).toBe(false);
    expect(fitsDeclaredBudget([declared("tenis para correr")], tenis)).toBe(false);
    expect(fitsDeclaredBudget([searched("tenis para correr")], tenis)).toBe(false);
  });
});

describe("cursor", () => {
  it("codifica y decodifica posición y momento de referencia", () => {
    const cursor = encodeCursor({ offset: 20, asOf: NOW.getTime() });

    expect(decodeCursor(cursor, NOW.getTime())).toEqual({ offset: 20, asOf: NOW.getTime() });
  });

  it("ignora cursores manipulados o inválidos", () => {
    expect(decodeCursor("no-es-un-cursor")).toBeNull();
    expect(decodeCursor(encodeCursor({ offset: -5, asOf: 1 }))).toBeNull();
    expect(decodeCursor(undefined)).toBeNull();
  });

  it("SEC-31: un momento de referencia fuera de rango es inválido (antes: Invalid Date → 500)", () => {
    const now = NOW.getTime();
    const at = (asOf: number) => decodeCursor(encodeCursor({ offset: 10, asOf }), now);

    expect(at(9e15)).toBeNull();
    expect(at(Number.MAX_SAFE_INTEGER)).toBeNull();
    expect(at(now + 5 * 60 * 1000)).toBeNull();
    expect(at(now - CURSOR_MAX_AGE_MS - 1)).toBeNull();
    expect(at(now - CURSOR_MAX_AGE_MS)).toEqual({ offset: 10, asOf: now - CURSOR_MAX_AGE_MS });
    expect(at(now + 30 * 1000)).toEqual({ offset: 10, asOf: now + 30 * 1000 });
    const raw = (payload: unknown) =>
      decodeCursor(Buffer.from(JSON.stringify(payload)).toString("base64url"), now);
    expect(raw({ v: 1, o: 10, t: 1.5e308 })).toBeNull();
    expect(raw({ v: 1, o: 10, t: String(now) })).toBeNull();
    expect(raw({ v: 1, o: 1e20, t: now })).toBeNull();
  });
});
