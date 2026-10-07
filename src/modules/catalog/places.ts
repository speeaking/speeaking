/**
 * Estados de México para las páginas «Comprar en …» (SEO nacional). El vendedor escribe el estado
 * como quiera («CDMX», «Ciudad de México», «D.F.»): aquí se lee como uno de los 32 canónicos. Lo que
 * no se reconoce no se adivina (ni «México», que puede ser el país o el estado, ni una ciudad suelta):
 * ese producto simplemente no aparece en una página de estado.
 */

export type MexicanState = { slug: string; name: string; aliases: readonly string[] };

/** Una página de estado (o de categoría en un estado) existe solo con al menos estos productos. */
export const MIN_PRODUCTS_FOR_PLACE_PAGE = 6;

export const MEXICAN_STATES: readonly MexicanState[] = [
  { slug: "aguascalientes", name: "Aguascalientes", aliases: ["ags"] },
  { slug: "baja-california", name: "Baja California", aliases: ["bc"] },
  { slug: "baja-california-sur", name: "Baja California Sur", aliases: ["bcs"] },
  { slug: "campeche", name: "Campeche", aliases: ["camp"] },
  { slug: "chiapas", name: "Chiapas", aliases: ["chis"] },
  { slug: "chihuahua", name: "Chihuahua", aliases: ["chih"] },
  {
    slug: "ciudad-de-mexico",
    name: "Ciudad de México",
    aliases: ["cdmx", "cd de mexico", "cd mexico", "df", "distrito federal", "mexico df"],
  },
  { slug: "coahuila", name: "Coahuila", aliases: ["coahuila de zaragoza", "coah"] },
  { slug: "colima", name: "Colima", aliases: ["col"] },
  { slug: "durango", name: "Durango", aliases: ["dgo"] },
  {
    slug: "estado-de-mexico",
    name: "Estado de México",
    aliases: ["edomex", "edo mex", "edo de mexico", "edo mexico", "estado de mex", "edo de mex"],
  },
  { slug: "guanajuato", name: "Guanajuato", aliases: ["gto"] },
  { slug: "guerrero", name: "Guerrero", aliases: ["gro"] },
  { slug: "hidalgo", name: "Hidalgo", aliases: ["hgo"] },
  { slug: "jalisco", name: "Jalisco", aliases: ["jal"] },
  { slug: "michoacan", name: "Michoacán", aliases: ["michoacan de ocampo", "mich"] },
  { slug: "morelos", name: "Morelos", aliases: ["mor"] },
  { slug: "nayarit", name: "Nayarit", aliases: ["nay"] },
  { slug: "nuevo-leon", name: "Nuevo León", aliases: ["nl"] },
  { slug: "oaxaca", name: "Oaxaca", aliases: ["oax"] },
  { slug: "puebla", name: "Puebla", aliases: ["pue"] },
  { slug: "queretaro", name: "Querétaro", aliases: ["queretaro de arteaga", "qro"] },
  { slug: "quintana-roo", name: "Quintana Roo", aliases: ["q roo", "qroo"] },
  { slug: "san-luis-potosi", name: "San Luis Potosí", aliases: ["slp"] },
  { slug: "sinaloa", name: "Sinaloa", aliases: ["sin"] },
  { slug: "sonora", name: "Sonora", aliases: ["son"] },
  { slug: "tabasco", name: "Tabasco", aliases: ["tab"] },
  { slug: "tamaulipas", name: "Tamaulipas", aliases: ["tamps"] },
  { slug: "tlaxcala", name: "Tlaxcala", aliases: ["tlax"] },
  { slug: "veracruz", name: "Veracruz", aliases: ["veracruz de ignacio de la llave", "ver"] },
  { slug: "yucatan", name: "Yucatán", aliases: ["yuc"] },
  { slug: "zacatecas", name: "Zacatecas", aliases: ["zac"] },
];

/** «Edo. Méx.» → «edo mex»: sin acentos, puntos ni mayúsculas, con un espacio entre palabras. */
function key(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const BY_KEY = new Map<string, MexicanState>();
for (const state of MEXICAN_STATES) {
  for (const alias of [state.name, state.slug, ...state.aliases]) BY_KEY.set(key(alias), state);
}
const BY_SLUG = new Map(MEXICAN_STATES.map((state) => [state.slug, state]));

/** Ruta de «Comprar en …»: por estado o por categoría en un estado. */
export function placePath(stateSlug: string, categorySlug?: string) {
  return categorySlug ? `/comprar/${categorySlug}/en/${stateSlug}` : `/comprar/en/${stateSlug}`;
}

export function stateFromText(text: string): MexicanState | null {
  return BY_KEY.get(key(text)) ?? null;
}

export function stateBySlug(slug: string): MexicanState | null {
  return BY_SLUG.get(slug) ?? null;
}

export type PlaceCount = { state: MexicanState; count: number; values: string[] };

/**
 * Productos por estado canónico a partir de los conteos por texto escrito (`groupBy` de la base):
 * suma las variantes y guarda cómo venían escritas, para filtrar después con `state IN (…)`.
 */
export function aggregatePlaces(rows: readonly { state: string; count: number }[]) {
  const places = new Map<string, PlaceCount>();
  for (const row of rows) {
    const state = stateFromText(row.state);
    if (!state) continue;
    const place = places.get(state.slug) ?? { state, count: 0, values: [] };
    place.count += row.count;
    place.values.push(row.state);
    places.set(state.slug, place);
  }
  return places;
}

/** Los estados que ya tienen página (al menos 6 productos), en orden alfabético en español. */
export function placesWithPage(places: ReadonlyMap<string, PlaceCount>) {
  return [...places.values()]
    .filter((place) => place.count >= MIN_PRODUCTS_FOR_PLACE_PAGE)
    .sort((a, b) => a.state.name.localeCompare(b.state.name, "es-MX"));
}

/**
 * Productos por «categoría/estado» (`decoracion/jalisco`) a partir de los conteos por categoría y
 * texto escrito. Como en la página de categoría, la categoría padre suma las de sus hijas.
 */
export function aggregateCategoryPlaces(
  rows: readonly {
    state: string;
    categorySlug: string;
    parentSlug: string | null;
    count: number;
  }[],
) {
  const counts = new Map<string, number>();
  for (const row of rows) {
    const state = stateFromText(row.state);
    if (!state) continue;
    for (const category of [row.categorySlug, row.parentSlug]) {
      if (!category) continue;
      const placeKey = `${category}/${state.slug}`;
      counts.set(placeKey, (counts.get(placeKey) ?? 0) + row.count);
    }
  }
  return counts;
}
