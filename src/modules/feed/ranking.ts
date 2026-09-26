/**
 * Algoritmo del feed v0: explicable, determinista y sin dependencias (fácil de probar y de
 * reemplazar por un modelo). Ver docs/architecture.md → Feed, comunidades y Commerce Engine.
 */
import type { FeedPolicy } from "./policy";

export const ALGORITHM_VERSION = "v0-explicable";

const HOUR = 3_600_000;

export type Candidate = {
  id: string;
  authorId: string;
  communityId: string | null;
  /** Categoría del producto asociado (solo relevante para piezas comerciales). */
  categoryId: string | null;
  /** Pieza comercial: publicación de producto o con producto etiquetado. */
  isCommerce: boolean;
  /** Título y etiquetas del producto, para relacionarlo con lo que la persona dijo buscar. */
  productText: string;
  publishedAt: Date;
  likeCount: number;
  commentCount: number;
  saveCount: number;
};

/**
 * Algo que la persona buscó: lo que declaró ("¿Buscas algo ahora?", `declared`) o una búsqueda
 * que hizo dentro de la plataforma (`search`). Se distingue para decirle la verdad en la tarjeta:
 * «Porque buscas…» contra «Porque buscaste…».
 */
export type IntentQuery = {
  query: string;
  source: "declared" | "search";
  /** Solo intenciones declaradas: su categoría, si la tiene. */
  categoryId: string | null;
  /** Solo intenciones declaradas: presupuesto máximo en centavos (moneda del sitio). */
  budgetMaxCents: number | null;
};

export type ViewerContext = {
  communityIds: ReadonlySet<string>;
  followingIds: ReadonlySet<string>;
  /** Intención de compra por categoría, de 0 a 1 (Commerce Engine). */
  categoryIntent: ReadonlyMap<string, number>;
  /** Categorías de productos que la persona vio, abrió, guardó o agregó al carrito. */
  viewedCategoryIds: ReadonlySet<string>;
  /** Lo que declaró buscar primero y después sus búsquedas recientes. */
  intentQueries: readonly IntentQuery[];
};

export type RankReason = "follow" | "community" | "intent" | "explore";

/**
 * Por qué una pieza comercial se eligió por intención, solo en términos que se pueden decir sin
 * mentir: la búsqueda que coincidió o una categoría que la persona sí vio. Si la intención vino de
 * otra señal, no hay explicación (`null`) y la tarjeta no inventa una.
 */
export type IntentMatch =
  | { basis: "query"; query: string; source: IntentQuery["source"] }
  | { basis: "viewed"; categoryId: string };

export type Ranked = {
  candidate: Candidate;
  score: number;
  reason: RankReason;
  intent: IntentMatch | null;
};

export type MixedItem = Ranked & { slot: "content" | "commerce"; position: number };

/** Puntúa y ordena candidatos: (recencia + engagement) × (1 + afinidad). */
export function rankCandidates(
  candidates: readonly Candidate[],
  context: ViewerContext,
  policy: FeedPolicy,
  now: Date,
): Ranked[] {
  return candidates
    .map((candidate) => {
      const ageHours = Math.max(0, (now.getTime() - candidate.publishedAt.getTime()) / HOUR);
      const recency = 0.5 ** (ageHours / policy.recencyHalfLifeHours);
      const interactions =
        candidate.likeCount + 2 * candidate.commentCount + 3 * candidate.saveCount;
      const engagement = Math.min(1, Math.log1p(interactions) / Math.log1p(100));

      let affinity = 0;
      let reason: RankReason = "explore";
      let intent: IntentMatch | null = null;
      if (context.followingIds.has(candidate.authorId)) {
        affinity += 0.8;
        reason = "follow";
      }
      if (candidate.communityId && context.communityIds.has(candidate.communityId)) {
        affinity += 0.5;
        if (reason === "explore") reason = "community";
      }
      if (candidate.isCommerce) {
        const matched = textIntentMatch(context.intentQueries, candidate.productText);
        const strength = Math.max(
          candidate.categoryId ? (context.categoryIntent.get(candidate.categoryId) ?? 0) : 0,
          matched ? 0.8 : 0,
        );
        if (strength > 0) {
          affinity += 1.2 * strength;
          if (strength >= 0.5) {
            reason = "intent";
            intent = matched
              ? { basis: "query", query: matched.query, source: matched.source }
              : candidate.categoryId && context.viewedCategoryIds.has(candidate.categoryId)
                ? { basis: "viewed", categoryId: candidate.categoryId }
                : null;
          }
        }
      }

      return {
        candidate,
        score: (0.6 * recency + 0.4 * engagement) * (1 + affinity),
        reason,
        intent,
      };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.candidate.publishedAt.getTime() - a.candidate.publishedAt.getTime() ||
        a.candidate.id.localeCompare(b.candidate.id),
    );
}

/** Toma el primer elemento cuyo autor no apareció en las últimas posiciones (diversidad). */
function takeDiverse(queue: Ranked[], recentAuthors: readonly string[]): Ranked | undefined {
  if (queue.length === 0) return undefined;
  const index = queue.findIndex((item) => !recentAuthors.includes(item.candidate.authorId));
  return queue.splice(index === -1 ? 0 : index, 1)[0];
}

/**
 * Arma la secuencia final respetando la política:
 * - como máximo 1 pieza comercial cada `commerceSlotEvery` posiciones (nunca se rellena con
 *   comercio si se acaba el contenido: el feed termina antes);
 * - una de cada ~1/`explorationShare` piezas de contenido es exploración;
 * - un mismo autor no se repite dentro de `authorWindow` posiciones si hay alternativas.
 */
export function mixFeed(ranked: readonly Ranked[], policy: FeedPolicy): MixedItem[] {
  const commerce = ranked.filter((item) => item.candidate.isCommerce);
  const affinity = ranked.filter((item) => !item.candidate.isCommerce && item.reason !== "explore");
  const explore = ranked.filter((item) => !item.candidate.isCommerce && item.reason === "explore");
  const exploreEvery =
    policy.explorationShare > 0 ? Math.max(2, Math.round(1 / policy.explorationShare)) : Infinity;

  const result: MixedItem[] = [];
  let lastCommerce = Number.NEGATIVE_INFINITY;
  let contentSlots = 0;

  for (;;) {
    const position = result.length;
    const recentAuthors = result
      .slice(Math.max(0, position - policy.authorWindow + 1))
      .map((item) => item.candidate.authorId);
    const commerceTurn =
      (position + 1) % policy.commerceSlotEvery === 0 &&
      position - lastCommerce >= policy.minGapBetweenCommerce;

    if (commerceTurn && commerce.length > 0) {
      const pick = takeDiverse(commerce, recentAuthors)!;
      result.push({ ...pick, slot: "commerce", position });
      lastCommerce = position;
      continue;
    }

    const wantsExplore = (contentSlots + 1) % exploreEvery === 0;
    const [primary, secondary] = wantsExplore ? [explore, affinity] : [affinity, explore];
    const pick = takeDiverse(primary.length > 0 ? primary : secondary, recentAuthors);
    if (!pick) break;
    result.push({ ...pick, slot: "content", position });
    contentSlots += 1;
  }
  return result;
}

// ───────────────────────────── Commerce Engine ─────────────────────────────

export type IntentSignal = {
  categoryId: string;
  type: "SEARCH" | "PRODUCT_VIEW" | "CLICK" | "SAVE" | "ADD_TO_CART" | "DECLARED";
  ageHours: number;
};

const SIGNAL_WEIGHTS: Record<IntentSignal["type"], number> = {
  SEARCH: 3,
  PRODUCT_VIEW: 2,
  CLICK: 2,
  SAVE: 4,
  ADD_TO_CART: 6,
  DECLARED: 8,
};
const INTENT_HALF_LIFE_HOURS = 72;

/** Intención por categoría (0–1): señales ponderadas con decaimiento de 72 h. */
export function categoryIntentScores(signals: readonly IntentSignal[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const signal of signals) {
    const weight = SIGNAL_WEIGHTS[signal.type] * 0.5 ** (signal.ageHours / INTENT_HALF_LIFE_HOURS);
    totals.set(signal.categoryId, (totals.get(signal.categoryId) ?? 0) + weight);
  }
  return new Map([...totals].map(([categoryId, total]) => [categoryId, 1 - Math.exp(-total / 6)]));
}

const STOPWORDS = new Set(["para", "con", "los", "las", "una", "uno", "por", "que", "del", "mis"]);

function tokens(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

/**
 * La primera búsqueda de la persona que coincide con el producto (raíces de 5 letras, sin acentos),
 * o `null`. Devuelve la búsqueda para poder decir en la tarjeta cuál fue.
 */
export function textIntentMatch<Q extends Pick<IntentQuery, "query">>(
  queries: readonly Q[],
  productText: string,
): Q | null {
  if (queries.length === 0 || !productText) return null;
  const productStems = new Set(tokens(productText).map((token) => token.slice(0, 5)));
  return (
    queries.find((query) =>
      tokens(query.query).some((token) => token.length >= 4 && productStems.has(token.slice(0, 5))),
    ) ?? null
  );
}

/**
 * «En tu presupuesto» (P2: lo decide el código, no la IA). Solo cuenta un presupuesto que la
 * persona declaró para ESTE tipo de producto: su búsqueda coincide con el producto o su categoría
 * es la del producto. El precio y el presupuesto van en centavos de la misma moneda.
 */
export function fitsDeclaredBudget(
  queries: readonly IntentQuery[],
  product: { categoryId: string | null; productText: string; priceCents: number },
): boolean {
  return queries.some(
    (query) =>
      query.source === "declared" &&
      query.budgetMaxCents !== null &&
      product.priceCents <= query.budgetMaxCents &&
      ((query.categoryId !== null && query.categoryId === product.categoryId) ||
        textIntentMatch([query], product.productText) !== null),
  );
}

// ──────────────────────────────── Cursor ────────────────────────────────

export type FeedCursor = { offset: number; asOf: number };

export function encodeCursor(cursor: FeedCursor): string {
  return Buffer.from(JSON.stringify({ v: 1, o: cursor.offset, t: cursor.asOf })).toString(
    "base64url",
  );
}

/** Decodifica el cursor; si fue manipulado o es inválido devuelve null (se empieza de nuevo). */
export function decodeCursor(value: string | null | undefined): FeedCursor | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
    if (typeof parsed !== "object" || parsed === null) return null;
    const { v, o, t } = parsed as Record<string, unknown>;
    if (v !== 1 || !Number.isInteger(o) || !Number.isInteger(t)) return null;
    if ((o as number) < 0 || (o as number) > 10_000 || (t as number) <= 0) return null;
    return { offset: o as number, asOf: t as number };
  } catch {
    return null;
  }
}
