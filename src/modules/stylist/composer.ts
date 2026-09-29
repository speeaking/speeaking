import type { Need } from "./need";
import { foldText } from "./need";
import { type OutfitSlot } from "./slots";

/**
 * Compositor de looks (ADR-043, P2): combina productos REALES de distintos vendedores en conjuntos
 * completos dentro del presupuesto. Es código determinista: con los mismos candidatos y la misma
 * necesidad devuelve los mismos looks. La IA solo les pone nombre.
 */
export const COMPOSER_VERSION = "looks@1";

export type LookCandidate = {
  id: string;
  slot: OutfitSlot;
  priceCents: number;
  title: string;
  tags: readonly string[];
  sellerId: string;
  /** Para desempatar de forma estable: el más reciente primero. */
  publishedAt: Date | null;
};

export type LookItem = { productId: string; slot: OutfitSlot; priceCents: number };

export type LookTemplate = "top-bottom-shoes" | "dress-shoes";

export type ComposedLook = {
  template: LookTemplate;
  items: LookItem[];
  totalCents: number;
  /** Suma de relevancia de sus piezas (para ordenar looks). */
  score: number;
};

/** Huecos obligatorios de cada plantilla y los opcionales que se agregan si el presupuesto alcanza. */
const TEMPLATES: Record<LookTemplate, { required: OutfitSlot[]; optional: OutfitSlot[] }> = {
  "top-bottom-shoes": { required: ["top", "bottom", "shoes"], optional: ["accessory", "bag"] },
  "dress-shoes": { required: ["dress", "shoes"], optional: ["accessory", "bag"] },
};

/** Pistas de vocabulario por ocasión y estilo: suman relevancia a lo que las contenga. */
const OCCASION_HINTS: Record<NonNullable<Need["occasion"]>, string[]> = {
  boda: ["vestir", "elegante", "formal", "saco", "tacon", "gala", "seda", "satin", "encaje"],
  fiesta: ["fiesta", "brillo", "lentejuela", "noche", "tacon", "satin"],
  entrevista: ["vestir", "formal", "camisa", "saco", "blazer", "oxford", "sobrio"],
  trabajo: ["vestir", "oficina", "formal", "camisa", "blazer", "chino", "mocasin"],
  cita: ["casual", "elegante", "camisa", "vestido", "blazer"],
  playa: ["playa", "lino", "short", "sandalia", "huarache", "verano", "ligero"],
  viaje: ["comodo", "ligero", "mochila", "tenis", "casual"],
  deporte: ["deportivo", "running", "correr", "gym", "entrenar", "dry", "licra"],
  graduacion: ["vestir", "elegante", "formal", "saco", "vestido", "tacon"],
  diario: ["casual", "basico", "algodon", "tenis", "jeans", "mezclilla", "playera"],
};

const STYLE_HINTS: Record<NonNullable<Need["style"]>, string[]> = {
  elegante: ["elegante", "vestir", "formal", "fino", "seda", "satin", "saco", "tacon"],
  casual: ["casual", "algodon", "basico", "jeans", "mezclilla", "playera", "tenis"],
  moderno: ["moderno", "oversize", "urbano", "street", "minimal", "tendencia", "sneaker"],
  clasico: ["clasico", "tradicional", "oxford", "chino", "camisa", "mocasin", "trench"],
  llamativo: ["llamativo", "estampado", "brillo", "color", "lentejuela", "neon"],
  deportivo: ["deportivo", "running", "gym", "jogger", "sudadera", "dry", "tenis"],
  comodo: ["comodo", "suave", "algodon", "jogger", "sudadera", "sandalia", "holgado"],
};

/** Raíces de 4+ letras (5 primeras), como el resto de la plataforma. */
function stems(text: string): Set<string> {
  return new Set(
    foldText(text)
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length >= 4)
      .map((word) => word.slice(0, 5)),
  );
}

/** Relevancia de un candidato para la necesidad: palabras clave, colores y pistas de contexto. */
export function relevance(candidate: LookCandidate, need: Need): number {
  const text = `${candidate.title} ${candidate.tags.join(" ")}`;
  const productStems = stems(text);
  const folded = foldText(text);
  let score = 0;
  for (const keyword of need.keywords) {
    if (productStems.has(foldText(keyword).slice(0, 5))) score += 2;
  }
  for (const color of need.colors) if (folded.includes(color)) score += 1.5;
  const hints = [
    ...(need.occasion ? OCCASION_HINTS[need.occasion] : []),
    ...(need.style ? STYLE_HINTS[need.style] : []),
  ];
  for (const hint of hints) if (folded.includes(hint)) score += 1;
  return score;
}

function byPreference(need: Need) {
  return (a: LookCandidate & { score: number }, b: LookCandidate & { score: number }) =>
    b.score - a.score ||
    // Igual de relevantes: lo más barato primero si hay presupuesto; si no, lo más reciente.
    (need.budgetMaxCents !== null ? a.priceCents - b.priceCents : 0) ||
    (b.publishedAt?.getTime() ?? 0) - (a.publishedAt?.getTime() ?? 0) ||
    a.id.localeCompare(b.id);
}

type Scored = LookCandidate & { score: number };

/** Candidatos por hueco, ya puntuados y ordenados. */
export function rankBySlot(candidates: readonly LookCandidate[], need: Need) {
  const ranked = new Map<OutfitSlot, Scored[]>();
  for (const candidate of candidates) {
    const scored = { ...candidate, score: relevance(candidate, need) };
    const list = ranked.get(candidate.slot) ?? [];
    list.push(scored);
    ranked.set(candidate.slot, list);
  }
  for (const list of ranked.values()) list.sort(byPreference(need));
  return ranked;
}

function total(items: readonly LookItem[]) {
  return items.reduce((sum, item) => sum + item.priceCents, 0);
}

function fits(items: readonly LookItem[], budget: number | null) {
  return budget === null || total(items) <= budget;
}

/** Opciones de un hueco con las que aún no salieron en otro look primero (misma relevancia). */
function unusedFirst(options: readonly Scored[], used: Set<string>) {
  return [...options].sort((a, b) => Number(used.has(a.id)) - Number(used.has(b.id)));
}

/**
 * Arma un look con una plantilla: para cada hueco obligatorio toma la opción `offset` (las que no
 * salieron en otro look van primero; una pieza SÍ puede repetirse entre looks, como el mismo
 * pantalón con dos camisas) y, si no cabe en el presupuesto, cambia las piezas más caras por la
 * alternativa más barata de su hueco hasta que quepa. `null` si falta una pieza o no hay forma de
 * caber.
 */
function buildLook(
  template: LookTemplate,
  ranked: Map<OutfitSlot, Scored[]>,
  need: Need,
  offset: number,
  used: Set<string>,
  fixed: Map<OutfitSlot, Scored>,
): ComposedLook | null {
  const { required, optional } = TEMPLATES[template];
  const chosen = new Map<OutfitSlot, Scored>();
  for (const slot of required) {
    const pinned = fixed.get(slot);
    if (pinned) {
      chosen.set(slot, pinned);
      continue;
    }
    const options = unusedFirst(ranked.get(slot) ?? [], used);
    if (options.length === 0) return null;
    chosen.set(slot, options[offset % options.length]!);
  }
  const budget = need.budgetMaxCents;
  const items = () =>
    [...chosen.entries()].map(([slot, product]) => ({
      productId: product.id,
      slot,
      priceCents: product.priceCents,
    }));

  // Ajuste al presupuesto: la pieza más cara (no fija) baja a la opción más barata de su hueco.
  let guard = 0;
  while (!fits(items(), budget) && guard < 8) {
    guard += 1;
    const swappable = [...chosen.entries()]
      .filter(([slot]) => !fixed.has(slot))
      .sort(([, a], [, b]) => b.priceCents - a.priceCents);
    let improved = false;
    for (const [slot, current] of swappable) {
      const cheapest = (ranked.get(slot) ?? [])
        .filter((option) => option.id !== current.id)
        .sort((a, b) => a.priceCents - b.priceCents || a.id.localeCompare(b.id))[0];
      if (cheapest && cheapest.priceCents < current.priceCents) {
        chosen.set(slot, cheapest);
        improved = true;
        break;
      }
    }
    if (!improved) break;
  }
  if (!fits(items(), budget)) return null;

  // Opcionales solo si caben: el más relevante de cada hueco, sin repetir hueco.
  for (const slot of optional) {
    const option = unusedFirst(ranked.get(slot) ?? [], used).find(
      (candidate) => !chosen.has(candidate.slot),
    );
    if (!option) continue;
    const next = [...items(), { productId: option.id, slot, priceCents: option.priceCents }];
    if (fits(next, budget)) chosen.set(slot, option);
  }

  const final = items();
  return {
    template,
    items: final,
    totalCents: total(final),
    score: [...chosen.values()].reduce((sum, product) => sum + product.score, 0),
  };
}

export type ComposeInput = {
  candidates: readonly LookCandidate[];
  need: Need;
  /** «Completa mi look»: producto fijo del que se parte. */
  anchor?: LookCandidate | null;
  count?: number;
};

/**
 * Hasta `count` looks distintos (sin repetir productos entre ellos mientras haya con qué), del más
 * relevante al menos, todos dentro del presupuesto. Con un producto fijo, todos lo incluyen y la
 * plantilla la decide su hueco (un vestido no lleva pantalón).
 */
export function composeLooks({ candidates, need, anchor = null, count = 3 }: ComposeInput) {
  const ranked = rankBySlot(
    candidates.filter((candidate) => candidate.id !== anchor?.id),
    need,
  );
  const fixed = new Map<OutfitSlot, Scored>();
  if (anchor) fixed.set(anchor.slot, { ...anchor, score: relevance(anchor, need) });
  const templates: LookTemplate[] =
    anchor?.slot === "dress"
      ? ["dress-shoes"]
      : anchor && (anchor.slot === "top" || anchor.slot === "bottom")
        ? ["top-bottom-shoes"]
        : need.gender === "hombre"
          ? ["top-bottom-shoes"]
          : ["top-bottom-shoes", "dress-shoes"];

  const looks: ComposedLook[] = [];
  const used = new Set<string>();
  for (let offset = 0; looks.length < count && offset < count * 2; offset += 1) {
    for (const template of templates) {
      if (looks.length >= count) break;
      const look = buildLook(template, ranked, need, offset, used, fixed);
      if (!look) continue;
      const key = look.items
        .map((item) => item.productId)
        .sort()
        .join("|");
      if (
        looks.some(
          (existing) =>
            existing.items
              .map((i) => i.productId)
              .sort()
              .join("|") === key,
        )
      )
        continue;
      looks.push(look);
      for (const item of look.items) if (item.productId !== anchor?.id) used.add(item.productId);
    }
  }
  return looks.sort((a, b) => b.score - a.score || a.totalCents - b.totalCents);
}

/**
 * Reemplaza la pieza de un hueco por la siguiente opción («quiero otros zapatos»): la más relevante
 * que no esté ya en el look, o la que siga en precio si `direction` es "cheaper".
 */
export function swapSlot(
  look: ComposedLook,
  slot: OutfitSlot,
  candidates: readonly LookCandidate[],
  need: Need,
  direction: "next" | "cheaper" = "next",
): ComposedLook | null {
  const current = look.items.find((item) => item.slot === slot);
  if (!current) return null;
  const inLook = new Set(look.items.map((item) => item.productId));
  const ranked = (rankBySlot(candidates, need).get(slot) ?? []).filter(
    (option) => !inLook.has(option.id),
  );
  const options =
    direction === "cheaper"
      ? ranked
          .filter((option) => option.priceCents < current.priceCents)
          .sort((a, b) => b.priceCents - a.priceCents || a.id.localeCompare(b.id))
      : ranked;
  const others = look.items.filter((item) => item.slot !== slot);
  const budget = need.budgetMaxCents;
  const replacement = options.find((option) =>
    fits([...others, { productId: option.id, slot, priceCents: option.priceCents }], budget),
  );
  if (!replacement) return null;
  const items = look.items.map((item) =>
    item.slot === slot
      ? { productId: replacement.id, slot, priceCents: replacement.priceCents }
      : item,
  );
  return { ...look, items, totalCents: total(items) };
}
