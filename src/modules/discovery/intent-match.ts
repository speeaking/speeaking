/**
 * «Lo que buscas»: el mejor producto para la intención de compra declarada. Lo calcula código
 * determinista (P2) con la misma idea que el Commerce Engine del feed: raíces de 5 letras sin
 * acentos y la categoría, si la intención tiene una.
 */

/** Intención declarada ("¿Buscas algo ahora?"). El presupuesto va en centavos de la moneda local. */
export type IntentQuery = {
  query: string;
  categoryId: string | null;
  budgetMaxCents: number | null;
};

/** Datos públicos del producto que bastan para decidir (nunca el costo). */
export type IntentProductCandidate = {
  id: string;
  title: string;
  tags: readonly string[];
  categoryId: string;
  priceCents: number;
  publishedAt: Date | null;
};

const STOPWORDS = new Set([
  "para",
  "con",
  "los",
  "las",
  "una",
  "uno",
  "unos",
  "unas",
  "por",
  "que",
  "del",
  "mis",
  "algo",
  "busco",
  "quiero",
]);

function words(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length >= 3 && !STOPWORDS.has(word));
}

/** Raíces de lo que la persona busca (palabras de 4+ letras, igual que el feed). */
export function queryStems(query: string): string[] {
  return [
    ...new Set(
      words(query)
        .filter((word) => word.length >= 4)
        .map((word) => word.slice(0, 5)),
    ),
  ];
}

/**
 * Qué tanto coincide un producto con la intención: una unidad por raíz de la búsqueda que aparece
 * en el título o las etiquetas, más una si la categoría es la misma. 0 = no coincide.
 */
export function scoreIntentMatch(intent: IntentQuery, product: IntentProductCandidate): number {
  const productStems = new Set(
    words(`${product.title} ${product.tags.join(" ")}`).map((word) => word.slice(0, 5)),
  );
  const textMatches = queryStems(intent.query).filter((stem) => productStems.has(stem)).length;
  const categoryMatch = intent.categoryId !== null && intent.categoryId === product.categoryId;
  return textMatches + (categoryMatch ? 1 : 0);
}

/** ¿Cabe en el presupuesto? Sin presupuesto declarado, cualquier precio cabe. */
export function fitsBudget(priceCents: number, budgetMaxCents: number | null) {
  return budgetMaxCents === null || priceCents <= budgetMaxCents;
}

/**
 * El mejor producto dentro del presupuesto: más coincidencias primero, luego el publicado más
 * recientemente y, para empatar de forma estable, el id. `null` si ninguno coincide.
 */
export function pickIntentProduct<T extends IntentProductCandidate>(
  intent: IntentQuery,
  products: readonly T[],
): T | null {
  let best: { product: T; score: number } | null = null;
  for (const product of products) {
    if (!fitsBudget(product.priceCents, intent.budgetMaxCents)) continue;
    const score = scoreIntentMatch(intent, product);
    if (score === 0) continue;
    if (!best || compare({ product, score }, best) < 0) best = { product, score };
  }
  return best?.product ?? null;
}

function compare<T extends IntentProductCandidate>(
  a: { product: T; score: number },
  b: { product: T; score: number },
) {
  return (
    b.score - a.score ||
    (b.product.publishedAt?.getTime() ?? 0) - (a.product.publishedAt?.getTime() ?? 0) ||
    a.product.id.localeCompare(b.product.id)
  );
}
