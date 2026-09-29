import type { MediaDTO } from "@/modules/catalog/dto";
import type { CandidateRow } from "@/modules/stylist/queries";
import { classifySlot, type OutfitSlot, SLOT_LABELS } from "@/modules/stylist/slots";

/**
 * «Agrégale…» en el diálogo de «Ver cómo me veo» (ADR-046): hasta 3 productos reales que
 * completan la prenda que la persona está viendo, cada uno de un hueco distinto. Código puro y
 * determinista (P2): primero los de la misma tienda (su patrocinio cubre la prueba y el pedido
 * sale junto), luego los más baratos. Un producto sin foto o del mismo hueco no entra.
 */
export type ComplementDTO = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  slot: OutfitSlot;
  slotLabel: string;
  image: MediaDTO | null;
  sellerName: string;
};

export const MAX_COMPLEMENTS = 3;

/** Huecos que completan a cada prenda, en orden de utilidad. */
const COMPLEMENTS_FOR: Record<OutfitSlot, readonly OutfitSlot[]> = {
  top: ["bottom", "shoes", "outerwear", "bag", "accessory"],
  bottom: ["top", "shoes", "outerwear", "bag", "accessory"],
  dress: ["shoes", "bag", "outerwear", "accessory"],
  outerwear: ["top", "bottom", "shoes", "bag"],
  shoes: ["top", "bottom", "dress", "bag"],
  bag: ["top", "bottom", "dress", "shoes"],
  accessory: ["top", "bottom", "dress", "shoes"],
};

function slotOf(candidate: CandidateRow): OutfitSlot | null {
  return classifySlot({
    categorySlug: candidate.categorySlug,
    parentSlug: candidate.parentSlug,
    title: candidate.title,
    tags: candidate.tags,
  });
}

export function suggestComplements(
  anchor: { id: string; slot: OutfitSlot; sellerId: string },
  candidates: readonly CandidateRow[],
  limit = MAX_COMPLEMENTS,
): ComplementDTO[] {
  const wanted = COMPLEMENTS_FOR[anchor.slot];
  const bySlot = new Map<OutfitSlot, CandidateRow[]>();
  for (const candidate of candidates) {
    if (candidate.id === anchor.id || !candidate.image) continue;
    const slot = slotOf(candidate);
    if (!slot || !wanted.includes(slot)) continue;
    const list = bySlot.get(slot) ?? [];
    list.push(candidate);
    bySlot.set(slot, list);
  }
  const picks: ComplementDTO[] = [];
  for (const slot of wanted) {
    if (picks.length >= limit) break;
    const list = bySlot.get(slot);
    if (!list || list.length === 0) continue;
    const [best] = [...list].sort(
      (a, b) =>
        Number(b.sellerId === anchor.sellerId) - Number(a.sellerId === anchor.sellerId) ||
        a.priceCents - b.priceCents ||
        a.id.localeCompare(b.id),
    );
    if (!best) continue;
    picks.push({
      id: best.id,
      slug: best.slug,
      title: best.title,
      priceCents: best.priceCents,
      currency: best.currency,
      slot,
      slotLabel: SLOT_LABELS[slot],
      image: best.image,
      sellerName: best.sellerName,
    });
  }
  return picks;
}
