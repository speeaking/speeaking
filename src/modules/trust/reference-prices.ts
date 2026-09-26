import { z } from "zod";
import type { ProductCondition } from "@/generated/prisma/enums";
import { hasPhrase } from "./text";

/**
 * Precios de referencia de artículos de marca que se falsifican seguido: el precio por debajo del
 * cual un artículo NUEVO y ORIGINAL casi no se consigue en México. REFERENCIA APROXIMADA, capturada
 * a mano y a propósito baja (≈ la mitad del precio de lista), para que solo salten los precios
 * inverosímiles. No es un precio oficial ni sale de la IA. El equipo la podrá editar desde /admin
 * con el ajuste `trust.referencePrices` (mismo formato); mientras no exista, se usa esta lista.
 *
 * `anyOf`: el título (con etiquetas) debe contener TODAS las frases de al menos un grupo. Gana la
 * primera entrada que coincida, así que las más específicas van primero.
 */
export const REFERENCE_PRICES_LABEL = "referencia aproximada";
export const REFERENCE_PRICES_REVIEWED = "2026-09";

export const referencePriceSchema = z.object({
  id: z.string().regex(/^[a-z0-9-]{2,60}$/),
  /** Cómo se nombra en los mensajes («AirPods Pro»). */
  label: z.string().min(2).max(80),
  brandId: z.string().min(2).max(40),
  anyOf: z
    .array(z.array(z.string().min(1).max(40)).min(1).max(4))
    .min(1)
    .max(8),
  /** Precio mínimo típico de uno nuevo y original, en centavos de MXN. */
  floorCents: z.int().min(1_000).max(100_000_000),
});
export const referencePricesSchema = z.array(referencePriceSchema).max(200);

export type ReferencePrice = z.infer<typeof referencePriceSchema>;

export const DEFAULT_REFERENCE_PRICES: readonly ReferencePrice[] = [
  {
    id: "airpods-max",
    label: "AirPods Max",
    brandId: "apple",
    anyOf: [["airpods max"]],
    floorCents: 600_000,
  },
  {
    id: "airpods-pro",
    label: "AirPods Pro",
    brandId: "apple",
    anyOf: [["airpods pro"]],
    floorCents: 250_000,
  },
  { id: "airpods", label: "AirPods", brandId: "apple", anyOf: [["airpods"]], floorCents: 150_000 },
  {
    id: "apple-watch",
    label: "Apple Watch",
    brandId: "apple",
    anyOf: [["apple watch"]],
    floorCents: 300_000,
  },
  {
    id: "iphone-reciente",
    label: "iPhone 15 o posterior",
    brandId: "apple",
    anyOf: [["iphone 15"], ["iphone 16"], ["iphone 17"]],
    floorCents: 800_000,
  },
  {
    id: "control-dualsense",
    label: "control DualSense de PlayStation 5",
    brandId: "sony",
    anyOf: [["dualsense"], ["control", "ps5"], ["control", "playstation 5"]],
    floorCents: 90_000,
  },
  {
    id: "consola-ps5",
    label: "consola PlayStation 5",
    brandId: "sony",
    anyOf: [
      ["consola", "ps5"],
      ["consola", "playstation 5"],
    ],
    floorCents: 600_000,
  },
  {
    id: "control-xbox",
    label: "control de Xbox",
    brandId: "xbox",
    anyOf: [["control", "xbox"]],
    floorCents: 70_000,
  },
  {
    id: "control-pro-switch",
    label: "control Pro de Nintendo Switch",
    brandId: "nintendo",
    anyOf: [["pro controller"], ["control pro", "nintendo"]],
    floorCents: 90_000,
  },
  {
    id: "galaxy-buds",
    label: "Galaxy Buds",
    brandId: "samsung",
    anyOf: [["galaxy buds"]],
    floorCents: 80_000,
  },
  {
    id: "jbl-flip-charge",
    label: "bocina JBL Flip o Charge",
    brandId: "jbl",
    anyOf: [["jbl flip"], ["jbl charge"]],
    floorCents: 90_000,
  },
  {
    id: "nike-air-jordan-1",
    label: "tenis Nike Air Jordan 1",
    brandId: "nike",
    anyOf: [["jordan 1"], ["air jordan"]],
    floorCents: 150_000,
  },
  {
    id: "nike-air-force-1",
    label: "tenis Nike Air Force 1",
    brandId: "nike",
    anyOf: [["air force 1"], ["air force one"]],
    floorCents: 100_000,
  },
  {
    id: "nike-pegasus",
    label: "tenis para correr Nike Pegasus",
    brandId: "nike",
    anyOf: [["nike", "pegasus"]],
    floorCents: 120_000,
  },
  {
    id: "adidas-samba",
    label: "tenis Adidas Samba",
    brandId: "adidas",
    anyOf: [["adidas", "samba"]],
    floorCents: 100_000,
  },
  {
    id: "stanley-quencher",
    label: "vaso Stanley Quencher",
    brandId: "stanley",
    anyOf: [
      ["stanley", "quencher"],
      ["vaso", "stanley"],
      ["termo", "stanley"],
    ],
    floorCents: 45_000,
  },
  {
    id: "lentes-ray-ban",
    label: "lentes Ray-Ban",
    brandId: "ray-ban",
    anyOf: [["ray ban"], ["rayban"]],
    floorCents: 120_000,
  },
  {
    id: "bolsa-louis-vuitton",
    label: "artículo de piel Louis Vuitton",
    brandId: "louis-vuitton",
    anyOf: [["louis vuitton"], ["vuitton"]],
    floorCents: 1_000_000,
  },
  {
    id: "reloj-rolex",
    label: "reloj Rolex",
    brandId: "rolex",
    anyOf: [["rolex"]],
    floorCents: 4_000_000,
  },
];

/** Un usado se compara contra la mitad de la referencia (sigue siendo inverosímil más abajo). */
const USED_FACTOR = 0.5;
const NEW_CONDITIONS: readonly ProductCondition[] = ["NEW", "LIKE_NEW"];

export type ReferenceMatch = { entry: ReferencePrice; floorCents: number; isNew: boolean };

/**
 * Referencia que aplica a un producto: la primera entrada de la marca del producto cuyo grupo de
 * frases aparece completo en el título (normalizado, con etiquetas). `null` si ninguna aplica.
 */
export function matchReferencePrice(
  normalizedTitle: string,
  itemBrandIds: readonly string[],
  condition: ProductCondition,
  references: readonly ReferencePrice[],
): ReferenceMatch | null {
  const entry = references.find(
    (candidate) =>
      itemBrandIds.includes(candidate.brandId) &&
      candidate.anyOf.some((group) => group.every((phrase) => hasPhrase(normalizedTitle, phrase))),
  );
  if (!entry) return null;
  const isNew = NEW_CONDITIONS.includes(condition);
  return {
    entry,
    floorCents: isNew ? entry.floorCents : Math.round(entry.floorCents * USED_FACTOR),
    isNew,
  };
}
