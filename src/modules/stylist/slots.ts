/**
 * Huecos de un look (ADR-043). Cada producto de moda ocupa uno: lo decide primero su categoría y,
 * si la categoría es genérica («Ropa»), palabras del título y las etiquetas. Es código puro y
 * determinista (P2): la IA nunca decide qué es cada prenda.
 */
export const OUTFIT_SLOTS = [
  "top",
  "bottom",
  "dress",
  "outerwear",
  "shoes",
  "bag",
  "accessory",
] as const;

export type OutfitSlot = (typeof OUTFIT_SLOTS)[number];

export const SLOT_LABELS: Record<OutfitSlot, string> = {
  top: "Parte de arriba",
  bottom: "Parte de abajo",
  dress: "Vestido o conjunto",
  outerwear: "Abrigo o saco",
  shoes: "Calzado",
  bag: "Bolsa o mochila",
  accessory: "Accesorio",
};

/** Raíz de categorías de moda (`prisma/seed/categories.ts`). */
export const FASHION_ROOT_SLUG = "moda";

/** Subcategorías de moda de la semilla: para saber si un producto es de moda sin consultar el árbol. */
export const FASHION_CATEGORY_SLUGS: ReadonlySet<string> = new Set([
  FASHION_ROOT_SLUG,
  "camisas-y-blusas",
  "pantalones-y-faldas",
  "vestidos",
  "chamarras-y-sacos",
  "ropa",
  "tenis",
  "bolsas",
  "relojes-y-joyeria",
  "accesorios-moda",
]);

/** Hueco de un producto conociendo solo el slug de su categoría (la ficha pública). */
export function slotForPublicProduct(input: {
  categorySlug: string;
  title: string;
  tags: readonly string[];
}): OutfitSlot | null {
  if (!FASHION_CATEGORY_SLUGS.has(input.categorySlug)) return null;
  return classifySlot({
    categorySlug: input.categorySlug,
    parentSlug: input.categorySlug === FASHION_ROOT_SLUG ? null : FASHION_ROOT_SLUG,
    title: input.title,
    tags: input.tags,
  });
}

/** Categorías que ya dicen el hueco. */
const CATEGORY_SLOTS: Record<string, OutfitSlot> = {
  "camisas-y-blusas": "top",
  "pantalones-y-faldas": "bottom",
  vestidos: "dress",
  "chamarras-y-sacos": "outerwear",
  tenis: "shoes",
  bolsas: "bag",
  "accesorios-moda": "accessory",
  "relojes-y-joyeria": "accessory",
};

/**
 * Palabras por hueco, en orden de prioridad: «vestido» gana a «top» («vestido con top de encaje»)
 * y «chamarra» a «camisa» («chamarra tipo camisa»). Sin acentos: se comparan textos plegados.
 */
const KEYWORDS: readonly [OutfitSlot, RegExp][] = [
  ["dress", /(?<![\p{L}])(vestido|jumpsuit|enterizo|overol|mono)(?![\p{L}])/u],
  [
    "outerwear",
    /(?<![\p{L}])(chamarra|chaqueta|saco|blazer|abrigo|gabardina|sudadera|hoodie|sueter|cardigan|chaleco|rompevientos|parka)(?![\p{L}])/u,
  ],
  ["bag", /(?<![\p{L}])(bolsa|bolso|mochila|cartera|clutch|backpack|morral|rinonera)(?![\p{L}])/u],
  [
    "shoes",
    /(?<![\p{L}])(tenis|zapatos?|botas?|botines?|sandalias?|tacones?|mocasines?|huaraches?|sneakers?|loafers?|zapatillas?|flats|plataformas?)(?![\p{L}])/u,
  ],
  [
    "accessory",
    /(?<![\p{L}])(reloj|cinturon|cinto|gorra|sombrero|lentes|gafas|aretes|collar|pulsera|anillo|bufanda|corbata|panuelo|mascada|cadena|brazalete|calcetines|calcetas|medias)(?![\p{L}])/u,
  ],
  [
    "bottom",
    /(?<![\p{L}])(pantalon|pantalones|jeans?|mezclilla|falda|shorts?|bermuda|leggings?|joggers?|chinos?|palazzo|licra)(?![\p{L}])/u,
  ],
  [
    "top",
    /(?<![\p{L}])(camisa|blusa|playera|camiseta|polo|top|crop|body|guayabera|jersey|manga)(?![\p{L}])/u,
  ],
];

/** Texto plegado: minúsculas, sin acentos ni ñ (la ñ se lee como n para comparar). */
export function foldForSlot(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Hueco por palabras del texto (título y etiquetas), o `null`. */
export function slotFromText(text: string): OutfitSlot | null {
  const folded = foldForSlot(text);
  for (const [slot, pattern] of KEYWORDS) if (pattern.test(folded)) return slot;
  return null;
}

export type SlotInput = {
  categorySlug: string;
  /** Slug de la categoría padre (raíz), si la hay. */
  parentSlug: string | null;
  title: string;
  tags: readonly string[];
};

/**
 * Hueco de un producto. Categoría explícita → ese hueco; categoría de moda genérica («ropa») o
 * cualquier otra de moda → por palabras; fuera de moda → `null` (no entra en un look).
 */
export function classifySlot(input: SlotInput): OutfitSlot | null {
  const explicit = CATEGORY_SLOTS[input.categorySlug];
  if (explicit) return explicit;
  const root = input.parentSlug ?? input.categorySlug;
  if (root !== FASHION_ROOT_SLUG) return null;
  return slotFromText(`${input.title} ${input.tags.join(" ")}`);
}

/** ¿Este hueco es de prenda principal (la que se «prueba» en una simulación)? */
export function isGarmentSlot(slot: OutfitSlot) {
  return slot === "top" || slot === "bottom" || slot === "dress" || slot === "outerwear";
}
