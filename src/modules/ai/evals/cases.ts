import { z } from "zod";
import type { AdKitProduct } from "../ad-kit/facts";

/**
 * Casos de evaluación (`evals/*.jsonl`, uno por línea). Son FICTICIOS: textos de vendedores
 * mexicanos inventados para la prueba, sin nombres, teléfonos ni datos de personas reales. Si algún
 * día se usan textos reales, será con permiso y sin datos personales (plan-90-dias.md §6.2 #7).
 */

const blocked = z.enum(["counterfeit", "weapons", "drugs", "prescription", "vapes"]);

export const saleProposalCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  notes: z.string().optional(),
  input: z.object({
    text: z.string().min(1).max(1000),
    productName: z.string().min(2).max(120),
    quantity: z.int().min(1).max(100_000),
    priceCents: z.int().min(1).max(1_000_000_000),
    costCents: z.int().min(0).max(1_000_000_000),
    city: z.string().nullable(),
    hasPhoto: z.boolean(),
  }),
  expected: z.object({
    /** Slugs aceptables; vacío = cualquiera (o ninguno). */
    categories: z.array(z.string()).default([]),
    /** Si el producto debe bloquearse antes de llamar al modelo, y por qué. */
    blocked: blocked.nullable().default(null),
  }),
});

export type SaleProposalCase = z.infer<typeof saleProposalCaseSchema>;

const factsSchema = z.object({
  status: z.enum(["DRAFT", "ACTIVE", "PAUSED", "SOLD_OUT", "ARCHIVED"]).default("ACTIVE"),
  stock: z.int().min(0).default(5),
  city: z.string(),
  state: z.string(),
  pickupAvailable: z.boolean().default(false),
  localDeliveryAvailable: z.boolean().default(false),
  localDeliveryZones: z.array(z.string()).default([]),
  nationalShippingAvailable: z.boolean().default(false),
  shippingPriceCents: z.int().min(0).nullable().default(null),
  currency: z.string().length(3).default("MXN"),
  deliveryMinDays: z.int().min(1).nullable().default(null),
  deliveryMaxDays: z.int().min(1).nullable().default(null),
  warrantyType: z.enum(["NONE", "SELLER", "MANUFACTURER"]).default("NONE"),
  warrantyDays: z.int().min(1).nullable().default(null),
  returnWindowDays: z.int().min(0).default(0),
  authenticity: z
    .enum(["NOT_APPLICABLE", "DECLARED_ORIGINAL", "GENERIC"])
    .default("NOT_APPLICABLE"),
  acceptedPaymentMethods: z
    .array(z.enum(["CARD", "TRANSFER", "CASH_ON_DELIVERY", "OXXO"]))
    .default(["CASH_ON_DELIVERY"]),
});

export const adCopyCaseSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]+$/),
  notes: z.string().optional(),
  product: z.object({
    slug: z.string().regex(/^[a-z0-9-]+$/),
    title: z.string().min(2).max(120),
    description: z.string().max(2000),
    priceCents: z.int().min(1).max(1_000_000_000),
    currency: z.string().length(3).default("MXN"),
    categoryName: z.string(),
    condition: z.enum(["NEW", "LIKE_NEW", "USED_GOOD", "USED_FAIR", "REFURBISHED"]).default("NEW"),
    tags: z.array(z.string()).default([]),
    facts: factsSchema,
  }),
  expected: z.object({
    /** El anuncio habla del producto: menciona al menos una de estas palabras. */
    mentions: z.array(z.string()).min(1),
    blocked: blocked.nullable().default(null),
  }),
});

export type AdCopyCase = z.infer<typeof adCopyCaseSchema>;

export function adKitProductOf(testCase: AdCopyCase): AdKitProduct {
  return { id: `00000000-0000-4000-8000-${"0".repeat(12)}`, ...testCase.product };
}

/** Lee un archivo JSONL de casos y valida cada línea (el error dice la línea, no su contenido). */
export function parseCases<T>(jsonl: string, schema: z.ZodType<T>): T[] {
  const cases: T[] = [];
  const ids = new Set<string>();
  jsonl.split(/\r?\n/u).forEach((line, index) => {
    if (!line.trim()) return;
    let raw: unknown;
    try {
      raw = JSON.parse(line);
    } catch {
      throw new Error(`Línea ${index + 1}: no es JSON válido.`);
    }
    const parsed = schema.safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Línea ${index + 1}: ${z.prettifyError(parsed.error)}`);
    }
    const id = (parsed.data as { id: string }).id;
    if (ids.has(id)) throw new Error(`Línea ${index + 1}: id repetido «${id}».`);
    ids.add(id);
    cases.push(parsed.data);
  });
  return cases;
}
