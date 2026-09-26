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

const AMOUNT = String.raw`\$?\s?(\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.(\d{1,2}))?\s*(?:pesos|mxn)?`;

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

  const costCents = amountAfter(clean, "costaron|costó|costo|compr[eé]|me salieron");
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
