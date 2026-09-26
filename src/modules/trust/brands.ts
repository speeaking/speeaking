import { phrasePositions, wordsOf } from "./text";

/**
 * Marcas que se falsifican con frecuencia en México (lista curada, se amplía a mano). Los alias van
 * normalizados (`normalizeForRules`: minúsculas, sin acentos ni signos) y cuentan solo como palabras
 * completas. Se omiten a propósito nombres ambiguos en español («coach», «supreme», «beats» solo)
 * para no marcar productos que no tienen que ver con la marca.
 */
export type Brand = { id: string; name: string; aliases: readonly string[] };

export const BRANDS: readonly Brand[] = [
  {
    id: "apple",
    name: "Apple",
    aliases: ["apple", "iphone", "ipad", "airpods", "airpod", "macbook", "imac", "apple watch"],
  },
  {
    id: "samsung",
    name: "Samsung",
    aliases: ["samsung", "galaxy buds", "galaxy watch", "galaxy tab", "galaxy z"],
  },
  {
    id: "sony",
    name: "Sony",
    aliases: ["sony", "playstation", "ps5", "ps4", "dualsense", "dualshock"],
  },
  { id: "xbox", name: "Xbox", aliases: ["xbox"] },
  { id: "nintendo", name: "Nintendo", aliases: ["nintendo"] },
  { id: "bose", name: "Bose", aliases: ["bose"] },
  { id: "jbl", name: "JBL", aliases: ["jbl"] },
  {
    id: "beats",
    name: "Beats",
    aliases: ["beats by dre", "beats studio", "beats solo", "powerbeats"],
  },
  { id: "gopro", name: "GoPro", aliases: ["gopro"] },
  { id: "dyson", name: "Dyson", aliases: ["dyson"] },
  { id: "garmin", name: "Garmin", aliases: ["garmin"] },
  {
    id: "nike",
    name: "Nike",
    aliases: ["nike", "air jordan", "jordan 1", "air force 1", "air force one", "air max"],
  },
  { id: "adidas", name: "Adidas", aliases: ["adidas", "yeezy"] },
  { id: "puma", name: "Puma", aliases: ["puma"] },
  { id: "new-balance", name: "New Balance", aliases: ["new balance"] },
  { id: "converse", name: "Converse", aliases: ["converse"] },
  { id: "vans", name: "Vans", aliases: ["vans"] },
  { id: "under-armour", name: "Under Armour", aliases: ["under armour"] },
  { id: "the-north-face", name: "The North Face", aliases: ["north face"] },
  { id: "lacoste", name: "Lacoste", aliases: ["lacoste"] },
  { id: "tommy-hilfiger", name: "Tommy Hilfiger", aliases: ["tommy hilfiger"] },
  { id: "calvin-klein", name: "Calvin Klein", aliases: ["calvin klein"] },
  { id: "levis", name: "Levi's", aliases: ["levis", "levi s"] },
  { id: "louis-vuitton", name: "Louis Vuitton", aliases: ["louis vuitton", "vuitton"] },
  { id: "gucci", name: "Gucci", aliases: ["gucci"] },
  { id: "chanel", name: "Chanel", aliases: ["chanel"] },
  { id: "dior", name: "Dior", aliases: ["dior"] },
  { id: "prada", name: "Prada", aliases: ["prada"] },
  { id: "versace", name: "Versace", aliases: ["versace"] },
  { id: "fendi", name: "Fendi", aliases: ["fendi"] },
  { id: "balenciaga", name: "Balenciaga", aliases: ["balenciaga"] },
  { id: "hermes", name: "Hermès", aliases: ["hermes"] },
  { id: "saint-laurent", name: "Saint Laurent", aliases: ["saint laurent", "ysl"] },
  { id: "michael-kors", name: "Michael Kors", aliases: ["michael kors"] },
  { id: "cartier", name: "Cartier", aliases: ["cartier"] },
  { id: "rolex", name: "Rolex", aliases: ["rolex"] },
  { id: "pandora", name: "Pandora", aliases: ["pandora"] },
  { id: "swarovski", name: "Swarovski", aliases: ["swarovski"] },
  { id: "ray-ban", name: "Ray-Ban", aliases: ["ray ban", "rayban"] },
  { id: "oakley", name: "Oakley", aliases: ["oakley"] },
  { id: "stanley", name: "Stanley", aliases: ["stanley"] },
];

const BY_ID = new Map(BRANDS.map((brand) => [brand.id, brand]));

export function brandById(id: string): Brand | undefined {
  return BY_ID.get(id);
}

/**
 * Palabras que, justo antes de la marca, dicen que el producto es PARA ella y no DE ella: «funda
 * para iPhone», «cargador compatible con AirPods». Nombrar la marca así es legítimo y no cuenta como
 * la marca del producto.
 */
const ACCESSORY_CUES = new Set([
  "para",
  "p/",
  "compatible",
  "compatibles",
  "funda",
  "fundas",
  "case",
  "mica",
  "micas",
  "protector",
  "protectores",
  "correa",
  "correas",
  "cable",
  "cables",
  "cargador",
  "cargadores",
  "estuche",
  "estuches",
  "repuesto",
  "repuestos",
  "refaccion",
  "refacciones",
  "adaptador",
  "adaptadores",
  "soporte",
  "base",
  "skin",
]);
/** Cuántas palabras antes de la marca se revisan buscando una de esas señales. */
const ACCESSORY_WINDOW = 3;
/** «tipo AirPods», «estilo Nike»: se describe un producto por parecido a la marca. */
const RESEMBLANCE_CUES = new Set(["tipo", "estilo"]);

export type BrandMentions = {
  /** Marcas que el texto presenta como la del producto, en orden de aparición. */
  item: string[];
  /** Marcas nombradas por parecido («tipo AirPods»). */
  resemblance: string[];
  /** Marcas nombradas como compatibilidad («para iPhone»). */
  accessory: string[];
};

/** Clasifica cada mención de marca del texto normalizado. */
export function detectBrands(normalized: string): BrandMentions {
  const words = wordsOf(normalized);
  const found: { brandId: string; position: number; kind: keyof BrandMentions }[] = [];
  for (const brand of BRANDS) {
    for (const alias of brand.aliases) {
      for (const position of phrasePositions(words, alias.split(" "))) {
        const previous = words[position - 1];
        const window = words.slice(Math.max(0, position - ACCESSORY_WINDOW), position);
        const kind: keyof BrandMentions =
          previous !== undefined && RESEMBLANCE_CUES.has(previous)
            ? "resemblance"
            : window.some((word) => ACCESSORY_CUES.has(word))
              ? "accessory"
              : "item";
        found.push({ brandId: brand.id, position, kind });
      }
    }
  }
  found.sort((a, b) => a.position - b.position);
  const mentions: BrandMentions = { item: [], resemblance: [], accessory: [] };
  for (const { brandId, kind } of found) {
    if (!mentions[kind].includes(brandId)) mentions[kind].push(brandId);
  }
  return mentions;
}
