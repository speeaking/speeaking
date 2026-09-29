import { z } from "zod";
import { parsePesosToCents } from "@/modules/catalog/pricing";
import { MAX_PROPOSAL_CENTS } from "./proposal-numbers";

/**
 * Contrato de "Vende con IA". Cualquier proveedor (simulado o real) debe devolver exactamente
 * esta forma; se valida SIEMPRE antes de usarla. Las cifras financieras NO salen de aquí: las
 * calcula el código con los números que confirmó el vendedor (P2). El rango de precio y el
 * presupuesto diario los pone el código (`proposal-numbers.ts`) sobre lo que devuelva la IA; el
 * contenido lo revisa `output-guard.ts` (SEC-28).
 */
export const saleProposalSchema = z.object({
  productName: z.string().min(2).max(120),
  headline: z.string().min(5).max(160),
  description: z.string().min(20).max(2000),
  valueProposition: z.string().min(10).max(400),
  categorySlug: z
    .string()
    .regex(/^[a-z0-9-]+$/)
    .nullable(),
  tags: z.array(z.string().min(2).max(30)).max(10),
  targetAudiences: z
    .array(z.object({ name: z.string().max(80), why: z.string().max(240) }))
    .min(1)
    .max(5),
  contentIdeas: z.array(z.string().max(240)).min(1).max(8),
  adIdeas: z.array(z.string().max(240)).min(1).max(6),
  videoScript: z.string().max(1200),
  suggestedPriceRange: z
    .object({
      minCents: z.int().positive().max(MAX_PROPOSAL_CENTS),
      maxCents: z.int().positive().max(MAX_PROPOSAL_CENTS),
      rationale: z.string().max(400),
    })
    .refine((range) => range.minCents <= range.maxCents, {
      message: "El mínimo del rango no puede ser mayor que el máximo.",
    }),
  suggestedDailyBudgetCents: z.int().min(0).max(MAX_PROPOSAL_CENTS),
  budgetRationale: z.string().max(400),
  objections: z
    .array(z.object({ objection: z.string().max(160), answer: z.string().max(300) }))
    .min(1)
    .max(6),
  ctas: z.array(z.string().max(60)).min(1).max(6),
  assumptions: z.array(z.string().max(240)).min(1).max(8),
});

export type SaleProposal = z.infer<typeof saleProposalSchema>;

/**
 * Lo que devuelve el MODELO: la propuesta sin cifras. El rango de precio y el presupuesto diario
 * los pone el código (`withCodeNumbers`); del rango, la IA solo redacta el porqué (P2, H2).
 */
export const saleProposalAiSchema = saleProposalSchema
  .omit({ suggestedPriceRange: true, suggestedDailyBudgetCents: true })
  .extend({
    suggestedPriceRange: z.object({ rationale: z.string().max(400) }),
    // Sin patrón: el código la normaliza con `knownCategorySlug` antes de usarla.
    categorySlug: z.string().max(120).nullable(),
  });

export type SaleProposalAiOutput = z.infer<typeof saleProposalAiSchema>;

function categoryKey(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").trim().toLowerCase();
}

/**
 * La categoría que eligió el modelo, solo si existe en la plataforma. Varios modelos devuelven la
 * línea completa de la lista («audio: Audio»), el nombre en vez del slug, mayúsculas o una cadena
 * vacía en vez de null: eso no invalida la propuesta, se normaliza aquí o queda sin categoría.
 */
export function knownCategorySlug(
  value: string | null,
  categories: readonly { slug: string; name: string }[],
): string | null {
  if (!value) return null;
  const key = categoryKey(value.split(":")[0] ?? "");
  if (!key) return null;
  const match = categories.find(
    (category) => category.slug === key || categoryKey(category.name) === key,
  );
  return match?.slug ?? null;
}

/** Datos confirmados por el vendedor que recibe la IA. */
export type SaleProposalRequest = {
  text: string;
  productName: string;
  quantity: number;
  priceCents: number;
  costCents: number;
  city: string | null;
  hasPhoto: boolean;
};

export type ParsedSellerText = {
  productName: string;
  quantity: number | null;
  costCents: number | null;
  priceCents: number | null;
};

const AMOUNT = String.raw`\$?\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(?:pesos|mxn))?`;

/** Palabras que anteceden al costo en el texto libre del vendedor. */
const COST_KEYWORDS = String.raw`costaron|costó|costo|compr[eé]|me salieron|me sal(?:e|en|i[oó])|me cuestan?|invert[ií]|inversi[oó]n|pagu[eé]|consegu[ií]|me (?:lo|la|los|las) dejaron`;

/** Un monto con marca de dinero («$2,400», «2400 pesos», «$180.50 mxn»). */
const MARKED_AMOUNT = String.raw`\$\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?(?:\s*(?:pesos|mxn))?|(?<![\p{L}\p{N}])(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:pesos|mxn)(?![\p{L}\p{N}])`;

function amountCents(integer: string, decimals: string | undefined) {
  return Number(integer.replace(/[,\s]/g, "")) * 100 + Number((decimals ?? "0").padEnd(2, "0"));
}

/**
 * Quita del texto libre el costo, que es privado y nunca sale hacia el proveedor de IA (H3):
 *
 * 1. Los montos que siguen a una palabra de costo («me costaron $2,400» → «me costaron [costo]»).
 * 2. Con el costo confirmado (`secret`), CUALQUIER monto en pesos igual al costo por pieza o al
 *    costo total («pagué $24,000 por las 10», «a mí me salen en $180»), aunque ninguna palabra lo
 *    anuncie. Un monto igual al precio de venta no se toca: ese es público.
 */
export function withoutCostMentions(
  text: string,
  secret?: { costCents: number; quantity: number; priceCents?: number },
) {
  const byKeyword = text.replace(
    new RegExp(`((?:${COST_KEYWORDS})[^\\d$]{0,25})${AMOUNT}`, "giu"),
    (_match, lead: string) => `${lead}[costo]`,
  );
  if (!secret || secret.costCents <= 0) return byKeyword;
  const hidden = new Set([secret.costCents, secret.costCents * secret.quantity]);
  if (secret.priceCents !== undefined) hidden.delete(secret.priceCents);
  return byKeyword.replace(
    new RegExp(MARKED_AMOUNT, "giu"),
    (match, int1?: string, dec1?: string, int2?: string, dec2?: string) => {
      const cents = int1 ? amountCents(int1, dec1) : amountCents(int2!, dec2);
      return hidden.has(cents) ? "[costo]" : match;
    },
  );
}

function amountAfter(text: string, keywords: string) {
  const match = new RegExp(`(?:${keywords})[^\\d$]{0,25}${AMOUNT}`, "i").exec(text);
  if (!match) return null;
  return parsePesosToCents(`${match[1]}${match[2] ? `.${match[2]}` : ""}`);
}

/**
 * Extrae nombre, cantidad, costo y precio del texto libre del vendedor, SIN IA (determinista).
 * Si un número no aparece, devuelve null: nunca lo inventa. El vendedor confirma todo.
 */
export function parseSellerText(text: string): ParsedSellerText {
  const clean = text.replace(/\s+/g, " ").trim();
  const quantityMatch = /(?:tengo|vendo|son|hay)\s+(\d{1,5})\s+/i.exec(clean);
  const quantity = quantityMatch ? Number(quantityMatch[1]) : null;

  const costCents = amountAfter(clean, COST_KEYWORDS);
  const priceCents = amountAfter(
    clean,
    "venderl[oa]s? a|venderl[oa]s? en|vender a|vender en|precio|a \\$",
  );

  // Nombre: lo que sigue a "tengo 50 / vendo 3 / quiero vender" hasta el primer signo o número.
  const nameMatch =
    /(?:tengo|vendo|quiero vender|voy a vender)\s+(?:\d{1,5}\s+)?([^.,;$\n]+?)(?=\s*(?:[.,;]|\s(?:me|y|a|en|por|que|costo|precio)\s|$))/i.exec(
      clean,
    );
  const productName = (nameMatch?.[1] ?? clean.split(/[.,;]/)[0] ?? "").trim().slice(0, 120);

  return { productName, quantity, costCents, priceCents };
}
