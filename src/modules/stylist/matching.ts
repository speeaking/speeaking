import "server-only";
import { type IntentQuery, fitsBudget, scoreIntentMatch } from "@/modules/discovery/intent-match";
import { db } from "@/server/db";

/**
 * Coincidencia comprador–producto para el vendedor (ADR-043, bandera `buyerMatching`): cuántas
 * personas distintas declararon hace poco una intención («¿Qué buscas?» del registro, búsquedas
 * guardadas, «¿Qué necesitas?») que coincide con cada producto y cuyo presupuesto alcanza. Solo un
 * número agregado: el vendedor nunca ve quiénes ni qué escribieron (principio 6, SEC-16). Lo
 * calcula el mismo código determinista que «Lo que buscas» (P2).
 */
const INTENT_WINDOW_DAYS = 30;
const MAX_INTENTS = 500;

export type MatchableProduct = {
  id: string;
  title: string;
  tags: readonly string[];
  categoryId: string;
  priceCents: number;
  publishedAt: Date | null;
};

/** Producto → personas distintas que buscan algo así (solo > 0). */
export async function countMatchingIntents(
  products: readonly MatchableProduct[],
  now = new Date(),
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (products.length === 0) return counts;
  const intents = await db.shoppingIntent.findMany({
    where: {
      status: "ACTIVE",
      createdAt: { gte: new Date(now.getTime() - INTENT_WINDOW_DAYS * 86_400_000) },
      OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
    },
    orderBy: { createdAt: "desc" },
    take: MAX_INTENTS,
    select: { userId: true, query: true, categoryId: true, budgetMaxCents: true },
  });
  for (const product of products) {
    const people = new Set<string>();
    for (const intent of intents) {
      const query: IntentQuery = {
        query: intent.query,
        categoryId: intent.categoryId,
        budgetMaxCents: intent.budgetMaxCents,
      };
      if (!fitsBudget(product.priceCents, intent.budgetMaxCents)) continue;
      if (scoreIntentMatch(query, product) > 0) people.add(intent.userId);
    }
    if (people.size > 0) counts.set(product.id, people.size);
  }
  return counts;
}

export function matchingLabel(count: number) {
  return count === 1 ? "1 persona busca algo así" : `${count} personas buscan algo así`;
}
