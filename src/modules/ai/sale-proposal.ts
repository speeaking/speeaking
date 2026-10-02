import { z } from "zod";
import { parsePesosToCents } from "@/modules/catalog/pricing";
import { redactionMarkerIndex, redactionMarkersIn, redactPersonalData } from "./personal-data";
import { MAX_PROPOSAL_CENTS } from "./proposal-numbers";

/**
 * Contrato de "Sube y vende". Cualquier proveedor (simulado o real) debe devolver exactamente
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
 *
 * La marca `[costo]` sirve para ubicar el costo; al modelo nunca le llega (ver `sellerTextForModel`).
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

/**
 * Cláusulas del texto: terminan en «.», «,», «;», «!», «?» o salto de línea. La coma y el punto entre
 * dígitos no cortan («$1,199», «$32.50», «1.2 litros»). Los dos puntos tampoco: en «Costo: $380»
 * separarían la palabra de su monto.
 */
const CLAUSE = /(?:[^.,;!?\n]|(?<=\d)[.,](?=\d))+(?:[.,;!?\n]+|$)/gu;

/** Lo que anuncia el costo («me salen en», «a mí me cuesta», «me costaron», «pagué»). */
const COST_LEAD = new RegExp(
  String.raw`(?<!\p{L})(?:a\s+m[ií]\s+)?(?:(?:me|nos)\s+)?(?:${COST_KEYWORDS})(?!\p{L})`,
  "giu",
);
/** Lo que anuncia un dato de contacto o de pago («mándame whats al», «escríbeme a», «deposítame a»). */
const CONTACT_LEAD = new RegExp(
  String.raw`(?<!\p{L})(?:(?:m[aá]nd|ll[aá]m|m[aá]rc|cont[aá]ct|b[uú]sc|p[aá]s|av[ií]s|env[ií])a(?:me|nos)|(?:escr[ií]b|s[ií]gu)e(?:me|nos)|dep[oó]s[ií]t\p{L}*|transf(?:e|ie|i[eé])r\p{L}*|whats(?:app)?|wa|wpp|tel(?:[eé]fono)?|cel(?:ular)?|n[uú]mero|correo|e-?mail|mail|inbox|dm|mensaje|informes|info|contacto|cuenta|clabe|liga|link|perfil|ig|instagram|facebook|fb|tiktok)(?!\p{L})`,
  "giu",
);
/** Cuánto puede haber entre esa palabra y la marca («me salen en | [costo]», «whats al | [teléfono]»). */
const LEAD_GAP = 25;
/** Lo que puede haber entre dos palabras que anuncian el mismo dato («mándame mensaje por whats al»). */
const LEAD_GLUE = /^\s*(?:(?:al|a|por|en|de|mi|un|el|la|o|y)\s+)*$/iu;
/** Conjunciones y preposiciones que quedarían colgando al cortar («…de tela y | me salen en…»). */
const DANGLING = /(?:\s+(?:y|e|o|u|pero|que|porque|pues|aunque|a|al|en|de|con|por|para))+\s*$/iu;

/**
 * La cláusula sin el dato oculto. Sin marca, tal cual. Con marca, lo que va ANTES de las palabras que
 * la anuncian, y su puntuación final: en un texto sin puntuar («…con forro de tela me salen en [costo]
 * y las vendo a $1,199») la cláusula es todo el texto y quitarla entera dejaba al modelo sin detalles.
 * Se corta en la palabra más cercana a la marca, y antes solo si la precede otra pegada («mándame
 * whats al»): «Vendo celular Samsung A15 mándame whats al…» conserva el «celular». `null` (se quita
 * entera) si ninguna palabra anuncia la marca («di [costo] por todas») o si lo de antes no dice nada
 * («A mí me sale en [costo]»).
 */
function withoutHiddenData(clause: string): string | null {
  const marker = redactionMarkerIndex(clause);
  if (marker < 0) return clause;
  const kind = redactionMarkersIn(clause)[0];
  const leads = [...clause.slice(0, marker).matchAll(kind === "costo" ? COST_LEAD : CONTACT_LEAD)];
  const endOf = (match: RegExpExecArray) => match.index + match[0].length;
  let first = leads.length - 1;
  if (first < 0 || marker - endOf(leads[first]!) > LEAD_GAP) return null;
  while (first > 0 && LEAD_GLUE.test(clause.slice(endOf(leads[first - 1]!), leads[first]!.index))) {
    first--;
  }
  const before = clause.slice(0, leads[first]!.index).replace(DANGLING, "").trimEnd();
  if ((before.match(/\p{L}{3,}/gu) ?? []).length < 2) return null;
  return before + (/[.,;!?\n]+$/u.exec(clause)?.[0] ?? "");
}

/**
 * El texto del vendedor tal como lo ve el modelo (H3, SEC-29): sin el costo ni datos de contacto, y
 * sin las marcas que los reemplazan. De una cláusula con una marca («me salen en [costo] cada una»,
 * «escríbeme al [teléfono]») se quita desde la palabra que la anuncia hasta el final de la cláusula
 * (`withoutHiddenData`): los modelos pequeños copiaban la marca al texto público y, de paso, el costo
 * en primera persona del vendedor; además, la marca avisa que había un dato oculto. Lo que se pierde
 * después de la marca (casi siempre el precio o la cantidad) ya va en los datos confirmados.
 */
export function sellerTextForModel(
  text: string,
  secret: { costCents: number; quantity: number; priceCents: number },
) {
  const marked = redactPersonalData(withoutCostMentions(text, secret));
  const kept: string[] = [];
  for (const [whole] of marked.matchAll(CLAUSE)) {
    const last = kept.length - 1;
    const clause = withoutHiddenData(whole);
    if (clause === null) {
      // Si la cláusula quitada cerraba la oración, la anterior la cierra ahora («leches, … $450.»).
      const end = /([.!?]+)\s*$/u.exec(whole)?.[1];
      if (end && last >= 0) kept[last] = kept[last]!.replace(/[,;]\s*$/u, end);
      continue;
    }
    // Tras un punto, la cláusula que sigue empieza con mayúscula («pastel. Precio $599.»).
    kept.push(
      last >= 0 && /[.!?]\s*$/u.test(kept[last]!)
        ? clause.replace(
            /^(\s*)(\p{Ll})/u,
            (_match, space: string, letter: string) =>
              `${space}${letter.toLocaleUpperCase("es-MX")}`,
          )
        : clause,
    );
  }
  return kept
    .join("")
    .replace(/[,;]\s*$/u, ".")
    .trim();
}

/** Palabras de una letra que son conjunción o preposición («hecha A mano» → «hecha a mano»). */
const SINGLE_LETTER_WORDS = new Set(["A", "E", "O", "U", "Y"]);

/**
 * ¿La palabra va en mayúscula de título («Jamaica», «Litro»)? Las siglas («JBL», «CH», «C40», «G») y
 * las mayúsculas propias («iPhone», «USB-C», «WH-1000XM4») no.
 */
function isTitleCased(core: string) {
  const letters = core.match(/\p{L}/gu) ?? [];
  if (letters.length === 0 || !/\p{Lu}/u.test(letters[0]!)) return false;
  if (letters.length === 1) return !/\d/u.test(core) && SINGLE_LETTER_WORDS.has(letters[0]!);
  return letters.slice(1).every((letter) => /\p{Ll}/u.test(letter));
}

/** Antes de una letra que es nombre, no conjunción: «Vitamina E», «Tipo A». */
const LETTER_NAMERS = new Set([
  "vitamina",
  "vitaminas",
  "tipo",
  "talla",
  "clase",
  "serie",
  "letra",
  "plan",
  "grado",
  "nivel",
  "categoria",
  "modelo",
  "version",
  "linea",
]);

/**
 * Marcas conocidas, como se escriben: el vendedor las teclea como sea («tenis nike», «BOCINA JBL»).
 * Lista corta a propósito; fuera de ella manda lo que escribió el vendedor.
 */
const KNOWN_BRANDS = [
  "Acer",
  "Adidas",
  "AirPods",
  "Apple",
  "Asus",
  "Barbie",
  "Beats",
  "Bose",
  "Canon",
  "Casio",
  "Converse",
  "Crocs",
  "Dell",
  "Disney",
  "DualSense",
  "Fender",
  "Galaxy",
  "GoPro",
  "Hot Wheels",
  "HP",
  "Huawei",
  "IdeaPad",
  "iPad",
  "iPhone",
  "JBL",
  "Jordan",
  "Kindle",
  "Lego",
  "Lenovo",
  "Levi's",
  "Logitech",
  "MacBook",
  "Marvel",
  "Maybelline",
  "Motorola",
  "New Balance",
  "Nike",
  "Nikon",
  "Nintendo",
  "Nivea",
  "Oster",
  "PlayStation",
  "Pokémon",
  "PS4",
  "PS5",
  "Puma",
  "Redmi",
  "Reebok",
  "Ryzen",
  "Samsung",
  "Skechers",
  "Sony",
  "Stanley",
  "ThinkPad",
  "Vans",
  "Xbox",
  "Xiaomi",
  "Yamaha",
];
/** Líneas y modelos que se escriben así solo detrás de una marca: «JBL Flip», «Nike Air Max». */
const KNOWN_LINES = [
  "Air",
  "Air Force",
  "Air Max",
  "Band",
  "Buds",
  "Charge",
  "Flip",
  "Go",
  "Lite",
  "Max",
  "Mini",
  "Plus",
  "Pro",
  "Superstar",
  "Switch",
  "Ultra",
  "Watch",
];

function spellingKey(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase("es-MX");
}

const BRAND_SPELLING = new Map(KNOWN_BRANDS.map((brand) => [spellingKey(brand), brand]));
const LINE_SPELLING = new Map(KNOWN_LINES.map((line) => [spellingKey(line), line]));

/** ¿Es una marca conocida? («Adidas» no es un plural). */
export function isKnownBrand(word: string) {
  return BRAND_SPELLING.has(spellingKey(word));
}

/**
 * La escritura de las marcas y líneas conocidas, por posición de palabra (`cores`: sin signos
 * alrededor). Una línea solo cuenta detrás de una marca, de otra línea o del número de modelo que las
 * sigue («iPhone 17 Pro Max»): la «flip» de «Funda flip» no es de JBL.
 */
function knownSpellings(cores: readonly string[]) {
  const found = new Map<number, string>();
  let afterBrand = false;
  for (let index = 0; index < cores.length;) {
    const one = spellingKey(cores[index]!);
    const two = index + 1 < cores.length ? `${one} ${spellingKey(cores[index + 1]!)}` : "";
    const brand = BRAND_SPELLING.get(two) ?? BRAND_SPELLING.get(one);
    const line = afterBrand ? (LINE_SPELLING.get(two) ?? LINE_SPELLING.get(one)) : undefined;
    const spelling = brand ?? line;
    if (spelling) {
      const parts = spelling.split(" ");
      parts.forEach((part, offset) => found.set(index + offset, part));
      index += parts.length;
      afterBrand = true;
      continue;
    }
    // Un número de modelo («17», «S24», «WH-1000XM4») no separa la marca de su línea.
    afterBrand &&= /\d/u.test(cores[index]!);
    index++;
  }
  return found;
}

/**
 * Título de publicación con mayúscula inicial y en minúsculas lo demás (cosmético y determinista,
 * P2): los modelos escribían «Agua de Jamaica de Litro». Las marcas conocidas y sus líneas van como
 * se escriben («tenis nike air max» → «Tenis Nike Air Max»). Si la primera palabra ya trae mayúsculas
 * propias («iPhone», «eBook», «JBL») se respeta tal cual. Después de ella, una palabra en mayúscula de
 * título se pasa a minúsculas, salvo que se escriba así en `sources` (el nombre confirmado y el texto
 * del vendedor: «Yamaha», «Sony») o sea una letra que es nombre («Vitamina E»); siglas y mayúsculas
 * propias se respetan. Por omisión, `sources` es el propio título: no cambia sus mayúsculas.
 */
export function listingTitle(
  name: string,
  sources: readonly (string | null | undefined)[] = [name],
) {
  const words = name.replace(/\s+/gu, " ").trim().split(" ");
  const cores = words.map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""));
  const known = knownSpellings(cores);
  const written = sources.filter(Boolean).join("\n");
  return words
    .map((word, index) => {
      const core = cores[index]!;
      const spelling = known.get(index);
      if (spelling) return word.replace(core, spelling);
      if (index === 0) {
        return /\p{Lu}/u.test(word)
          ? word
          : word.replace(/\p{L}/u, (letter) => letter.toLocaleUpperCase("es-MX"));
      }
      if (!isTitleCased(core)) return word;
      const letterName =
        core.length === 1 &&
        (index === words.length - 1 || LETTER_NAMERS.has(spellingKey(cores[index - 1]!)));
      if (letterName) return word;
      const escaped = core.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const asWritten = new RegExp(String.raw`(?<![\p{L}\p{N}])${escaped}(?![\p{L}\p{N}])`, "u");
      return asWritten.test(written) ? word : word.toLocaleLowerCase("es-MX");
    })
    .join(" ")
    .trim();
}

/** Montos que siguen a una palabra clave, en orden. `end`: dónde termina el monto en el texto. */
function* amountsAfter(text: string, keywords: string) {
  for (const match of text.matchAll(new RegExp(`(?:${keywords})[^\\d$]{0,25}${AMOUNT}`, "gi"))) {
    yield {
      cents: parsePesosToCents(`${match[1]}${match[2] ? `.${match[2]}` : ""}`),
      end: match.index + match[0].length,
    };
  }
}

/**
 * Lo que anuncia el precio de venta. «precio» puede ir algo lejos de su monto («precio por pieza:
 * $120»). Un verbo de venta («las doy a», «la dejo en», «venderlos a»), no: el monto va justo después,
 * porque «Vendo en Guadalajara 15 playeras», «Doy a 2 cuadras» o «Las dejo en 2 días» no dicen precio.
 */
const PRICE_LEAD = String.raw`precio[^\d$]{0,25}|(?<!\p{L})(?:venderl[oa]s?|vender|vendo|doy|dejo)\s+(?:a|en)\s+`;
/** «a $» solo como palabra suelta («los paso a $450»): dentro de «me cuest|a $180» es el costo. */
const LOOSE_PRICE = String.raw`(?<![a-záéíóúüñ])a \$`;
/**
 * Tras un verbo de venta, un número sin «$» ni «pesos» solo es el precio si cierra la frase («las doy
 * a 350, me salen…», «la dejo en 900 c/u»): en «Vendo en 3 colores» o «Doy a 2 cuadras» le sigue
 * otra palabra.
 */
const PRICE_ENDS = /^\s*(?:[.,;:!?)]|c\/u|(?:cada|y|pero)(?!\p{L})|$)/iu;

/**
 * El precio: primero el que anuncia una palabra clave («precio $120», «la dejo en $1,900») y, si no
 * hay, un «a $» suelto. Nunca el monto que ya se tomó como costo: en «Me salen a $45 c/u, precio
 * $120» el «a $45» es el costo.
 */
function priceAfter(text: string, costEnd: number | undefined) {
  const announced = new RegExp(`(?:${PRICE_LEAD})${AMOUNT}`, "giu");
  for (const match of text.matchAll(announced)) {
    const end = match.index + match[0].length;
    const marked = /^precio|\$|pesos|mxn/iu.test(match[0]) || PRICE_ENDS.test(text.slice(end));
    if (marked && end !== costEnd) {
      return parsePesosToCents(`${match[1]}${match[2] ? `.${match[2]}` : ""}`);
    }
  }
  for (const amount of amountsAfter(text, LOOSE_PRICE)) {
    if (amount.end !== costEnd) return amount.cents;
  }
  return null;
}

/**
 * Las cantidades con letra («ocho cojines», «Solo quedan tres»), como fragmentos de expresión
 * regular (con o sin acento). Las usan el lector del texto y el guardián (`output-guard.ts`).
 */
export const NUMBER_WORDS: Readonly<Record<number, string>> = {
  2: "dos",
  3: "tres",
  4: "cuatro",
  5: "cinco",
  6: "seis",
  7: "siete",
  8: "ocho",
  9: "nueve",
  10: "diez",
  11: "once",
  12: "doce",
  13: "trece",
  14: "catorce",
  15: "quince",
  16: "diecis[eé]is",
  17: "diecisiete",
  18: "dieciocho",
  19: "diecinueve",
  20: "veinte",
  21: "veinti[uú]n[oa]?",
  22: "veintid[oó]s",
  23: "veintitr[eé]s",
  24: "veinticuatro",
  25: "veinticinco",
  26: "veintis[eé]is",
  27: "veintisiete",
  28: "veintiocho",
  29: "veintinueve",
  30: "treinta",
  40: "cuarenta",
  50: "cincuenta",
  100: "cien",
};

/**
 * Una cantidad en cifra o con letra, como palabra suelta. «Tres leches» y «cuatro quesos» son el
 * nombre del producto, no cuántos hay.
 */
const COUNT = String.raw`(?:\d{1,5}|${Object.values(NUMBER_WORDS).join("|")})(?![\p{L}\p{N}])(?!\s+(?:leches|quesos)(?!\p{L}))`;

/** El número de una cantidad en cifra o con letra («16», «dieciséis»). */
function countValue(raw: string) {
  if (/^\d+$/u.test(raw)) return Number(raw);
  const entry = Object.entries(NUMBER_WORDS).find(([, word]) =>
    new RegExp(`^(?:${word})$`, "iu").test(raw),
  );
  return entry ? Number(entry[0]) : null;
}

/**
 * Extrae nombre, cantidad, costo y precio del texto libre del vendedor, SIN IA (determinista).
 * Si un número no aparece, devuelve null: nunca lo inventa. El vendedor confirma todo.
 */
export function parseSellerText(text: string): ParsedSellerText {
  const clean = text.replace(/\s+/g, " ").trim();
  const quantityMatch = new RegExp(
    String.raw`(?<!\p{L})(?:tengo|vendo|son|hay)\s+(${COUNT})\s+`,
    "iu",
  ).exec(clean);
  const quantity = quantityMatch ? countValue(quantityMatch[1]!) : null;

  const [cost] = amountsAfter(clean, COST_KEYWORDS);
  const costCents = cost?.cents ?? null;
  const priceCents = priceAfter(clean, cost?.end);

  // Nombre: lo que sigue a "tengo 50 / vendo ocho / quiero vender" (sin la cantidad, en cifra o con
  // letra) hasta el primer signo o número.
  const nameMatch = new RegExp(
    String.raw`(?:tengo|vendo|quiero vender|voy a vender)\s+(?:${COUNT}\s+)?([^.,;$\n]+?)(?=\s*(?:[.,;]|\s(?:me|y|a|en|por|que|costo|precio)\s|$))`,
    "iu",
  ).exec(clean);
  const productName = (nameMatch?.[1] ?? clean.split(/[.,;]/)[0] ?? "").trim().slice(0, 120);

  return { productName, quantity, costCents, priceCents };
}
