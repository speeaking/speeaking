import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import {
  findPersonalData,
  normalizeText,
  type RedactionMarker,
  redactionMarkersIn,
} from "./personal-data";
import { suggestedDailyBudgetCents, suggestedPriceRange } from "./proposal-numbers";
import { listingTitle, type SaleProposal } from "./sale-proposal";

/**
 * Guardián de contenido de la IA (SEC-28). El esquema solo valida la FORMA; esto valida el
 * CONTENIDO contra los datos que confirmó el vendedor, antes de guardar o mostrar:
 *
 * - `contact` / `payment`: correos, teléfonos, ligas, usuarios, CLABE o tarjetas, e instrucciones de
 *   pago por fuera («transferencia», «depósito»…). La plataforma cobra dentro de la app.
 * - `urgency`: urgencia o escasez inventadas («últimas piezas», «solo hoy», «quedan 5»…); P12.
 * - `claim`: afirmaciones que exigen un dato verificable (P4) que no está en los datos: garantía,
 *   originalidad, envío gratis, devoluciones, tiempos de entrega, descuentos… Y en TODO, también en
 *   los consejos para el vendedor, que la plataforma verifica, revisa, certifica o garantiza algo
 *   (`PLATFORM_CLAIM`): no lo hace.
 * - `number`: montos, piezas o días distintos de los confirmados (P2). En lo que ve quien compra,
 *   además, las piezas en existencia (en cifra o con letra) junto a un precio, aunque vaya en otra
 *   frase del campo («8 bolsas por $1,199» se lee como el precio de las 8), antes de una palabra del
 *   producto o genérica («Tengo 8 bolsas de piel», «ocho piezas») o tras «tenemos / contamos con»; el
 *   lote junto a un precio («Todas las bolsas por $1,199», «$1,199 en total») y, en descripción y
 *   propuesta de valor, la primera persona del vendedor («tengo», «tenemos», «me salen en»).
 * - Marcas de redacción («[costo]», «[teléfono]»…): delatan un dato oculto. La del costo cuenta como
 *   `number`, la de cuenta como `payment` y las demás como `contact`. Se revisan en TODO.
 *
 * Una frase (o un elemento de lista) con cualquiera de esos hallazgos se quita entera; si un campo se
 * queda vacío, se usa un texto determinista con los datos del vendedor. En la propuesta de «Vende
 * con IA» las «afirmaciones» solo se revisan en lo publicable (título, descripción, anuncios, guion,
 * llamados); en los consejos para el vendedor («¿Tienen garantía?» → «Indica los días que ofreces»)
 * hablar de garantía es legítimo. En el kit de anuncios se permiten solo las afirmaciones que
 * respaldan los datos estructurados del producto (`allowedClaims`).
 */

export type GuardFinding = "contact" | "payment" | "urgency" | "claim" | "number";

/** Datos confirmados por el vendedor contra los que se revisa la salida. */
export type ProposalFacts = {
  productName: string;
  priceCents: number;
  costCents: number;
  quantity: number;
  /** Texto que escribió el vendedor: sus porcentajes («batería al 86 %») sí se pueden repetir. */
  text?: string;
};

export type GuardedProposal = {
  proposal: SaleProposal;
  /** Frases o elementos quitados. */
  removed: number;
  findings: GuardFinding[];
};

/**
 * Frases completas (sin partir palabras): los límites `\b` de JavaScript no reconocen letras con
 * acento, así que se usan lookarounds de Unicode.
 */
function phrases(alternatives: string[]) {
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}])(?:${alternatives.join("|")})(?![\p{L}\p{N}])`,
    "iu",
  );
}

const PAYMENT = phrases([
  "clabe",
  "spei",
  // Transferencia, transferir, transfiéreme; depósito, deposita, deposítame.
  String.raw`transf(?:e|ie|i[eé])r\p{L}*`,
  String.raw`dep[oó]s[ií]t\p{L}*`,
  String.raw`cuenta\s+(?:bancaria|de\s+banco)`,
  String.raw`n[uú]mero\s+de\s+(?:cuenta|tarjeta)`,
  "paypal",
  String.raw`western\s+union`,
  String.raw`p[aá]g(?:o|a|ar|ame|arme|ale|amelo)\s+(?:por\s+fuera|directo|directamente|por\s+adelantado|antes)`,
]);

/** Las cantidades con letra («Ocho cojines por $320», «Solo quedan tres»). */
const NUMBER_WORDS: Readonly<Record<number, string>> = {
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
  30: "treinta",
  40: "cuarenta",
  50: "cincuenta",
  100: "cien",
};

const URGENCY = phrases([
  String.raw`[uú]ltim[oa]s?\s+(?:\d+\s+)?(?:piezas?|unidades?|oportunidad|d[ií]as?|horas?|disponibles?)`,
  String.raw`(?:s[oó]lo|solamente)\s+quedan`,
  // «Quedan 5 bolsas», «solo nos quedan tres»: escasez, sea o no la cifra confirmada.
  String.raw`quedan\s+(?:\d+|${Object.values(NUMBER_WORDS).join("|")})`,
  String.raw`quedan\s+(?:muy\s+)?poc[oa]s`,
  String.raw`se\s+(?:est[aá]n\s+)?acaba(?:n|ndo)?`,
  String.raw`antes\s+de\s+que\s+se\s+acaben?`,
  String.raw`por\s+tiempo\s+limitado`,
  String.raw`oferta\s+(?:termina|v[aá]lida\s+hasta|rel[aá]mpago)`,
  String.raw`(?:s[oó]lo|[uú]nicamente|nada\s+m[aá]s)\s+(?:por\s+)?hoy`,
  String.raw`hoy\s+mismo`,
  String.raw`date\s+prisa`,
  "ap[uú]rate",
  "c[oó]rrele",
  String.raw`no\s+te\s+quedes\s+sin`,
  String.raw`[uú]ltima\s+llamada`,
  "urgente",
  "agotarse",
  String.raw`se\s+(?:est[aá]n?\s+)?agot(?:a|an|e|en|ando|ar[aá]n?)`,
  String.raw`hasta\s+agotar(?:\s+(?:existencias|inventario|stock))?`,
  String.raw`no\s+esperes(?:\s+m[aá]s)?`,
  // «Stock limitado», «la variedad es limitada», «el tiempo es limitado»; no «garantía limitada».
  String.raw`(?:stock|existencias?|inventario|cupo|piezas|unidades|variedad|cantidad(?:es)?|tiempo)\s+(?:(?:es|son|est[aá]n?|muy)\s+)*limitad[oa]s?`,
  String.raw`(?:pocas|contadas|limitadas)\s+(?:piezas|unidades|existencias)`,
]);

const BRAND = siteConfig.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
/**
 * La plataforma como sujeto: «la plataforma», «speeaking», «nosotros», «nuestro equipo». Ni «la app»
 * ni «el equipo» a secas: en una descripción suelen ser el producto («la app revisa tu ritmo
 * cardiaco», «el equipo se revisó y funciona»).
 */
const PLATFORM = String.raw`(?:(?:la|esta|nuestra)\s+)?plataforma|${BRAND}|nosotros|nuestro\s+equipo|el\s+equipo\s+de\s+${BRAND}`;
/**
 * Raíces de verificar, revisar, comprobar, certificar, autenticar, garantizar, validar… Sin
 * «asegurar»: «la plataforma te asegura estabilidad» habla de unos zapatos de plataforma.
 */
const CHECK_STEM = String.raw`(?:verifi(?:c|qu)|comprueb|comprob|certifi(?:c|qu)|autenti(?:c|qu)|garanti(?:z|c)|valid|revis|aval|respald|inspeccion|audit|che(?:c|qu))`;
/** Participios: «comprobado», «verificada», «revisados»… */
const CHECKED = String.raw`(?:verificad|comprobad|certificad|autenticad|garantizad|validad|revisad|avalad|respaldad|inspeccionad|auditad|checad|aprobad)[oa]s?`;

/**
 * La plataforma verifica, revisa, certifica o garantiza algo: speeaking no comprueba materiales ni
 * calidad (el modelo escribía «la plataforma verifica estos detalles con las fotos», 2026-10-02). Se
 * revisa en todo, también en los consejos para el vendedor. No cuenta lo que hace quien compra o vende
 * («Revisa las fotos», «el vendedor puede mostrar el ticket»), lo dicho en negativo («la plataforma no
 * verifica materiales») ni «la plataforma» como lugar («dentro de la plataforma revisa la talla»).
 */
const PLATFORM_CLAIM = phrases([
  // «La plataforma verifica», «speeaking te garantiza», «la plataforma se encarga de verificar».
  String.raw`(?<!(?<!\p{L})(?:en|a|al|de|del|por|con|desde|para|sobre|hacia|entre)\s+(?:(?:la|esta|nuestra)\s+)?)(?:${PLATFORM})(?:\s+(?:se\s+encarga\s+de|puede|podr[aá]|va\s+a|suele|siempre|tambi[eé]n|ya|s[oó]lo|lo|la|los|las|le|les|te|se|nos))*\s+${CHECK_STEM}\p{L}*`,
  // «Verificamos», «lo revisamos», «hemos comprobado»; no «no verificamos».
  String.raw`(?<!(?<!\p{L})no\s+(?:(?:lo|la|los|las|le|les|te)\s+)?)${CHECK_STEM}(?:amos|aremos|[aá]bamos)`,
  String.raw`hemos\s+${CHECKED}`,
  // «Comprobado por la plataforma», «verificado por speeaking», «certificado por expertos».
  String.raw`${CHECKED}\s+(?:por|en)\s+(?:${PLATFORM})`,
  String.raw`certificad[oa]s?\s+por`,
  // «Con la garantía de speeaking», «el respaldo de la plataforma».
  String.raw`(?:verificaci[oó]n|certificaci[oó]n|garant[ií]a|respaldo|aval)\s+de\s+(?:${PLATFORM})`,
]);

/** Afirmaciones que exigen un dato verificable (P4), por tipo. */
export type ClaimKind =
  | "warranty"
  | "authenticity"
  | "free_shipping"
  | "delivery_promise"
  | "delivery_days"
  | "returns"
  | "discount"
  | "financing"
  | "invoice"
  | "sealed"
  | "national_shipping"
  | "local_delivery"
  | "pickup";

export const CLAIM_PATTERNS: Record<ClaimKind, RegExp> = {
  warranty: phrases(["garant[ií]as?", "garantizad[oa]s?"]),
  authenticity: phrases(["originale?s?", "aut[eé]ntic[oa]s?", "genuin[oa]s?"]),
  free_shipping: phrases([
    String.raw`env[ií]os?\s+(?:gratis|gratuitos?|sin\s+costo|incluidos?)`,
    String.raw`gratis\s+el\s+env[ií]o`,
  ]),
  // Promesas de entrega que ningún dato respalda (horas, «mañana», «inmediata»).
  delivery_promise: phrases([
    String.raw`entrega\s+(?:inmediata|expr[eé]ss?|al\s+d[ií]a\s+siguiente)`,
    String.raw`llega\s+(?:ma[nñ]ana|hoy|el\s+mismo\s+d[ií]a)`,
    String.raw`entrega\s+(?:el\s+)?mismo\s+d[ií]a`,
    String.raw`en\s+(?:menos\s+de\s+)?\d+\s*(?:h|horas?)`,
  ]),
  delivery_days: phrases([String.raw`en\s+(?:menos\s+de\s+)?\d+\s*d[ií]as?(?:\s+h[aá]biles)?`]),
  returns: phrases(["devoluci[oó]n(?:es)?", "reembolsos?"]),
  discount: phrases(["descuentos?", String.raw`\d+\s*%\s*(?:off|menos)`]),
  // Promociones y financiamiento que la plataforma no ofrece: 2x1, meses sin intereses.
  financing: phrases([String.raw`[23]\s*[x×]\s*[12]`, String.raw`meses\s+sin\s+intereses`, "msi"]),
  invoice: phrases(["factura"]),
  sealed: phrases(["certificad[oa]s?", "sellad[oa]s?"]),
  national_shipping: phrases([
    String.raw`env[ií](?:o|os|amos|ar)`,
    String.raw`paqueter[ií]a`,
    String.raw`(?:mandamos|mando)\s+a\s+todo`,
  ]),
  local_delivery: phrases([
    String.raw`entregas?\s+(?:locale?s?|a\s+domicilio|en\s+tu\s+(?:casa|colonia|zona))`,
    String.raw`a\s+domicilio`,
  ]),
  pickup: phrases([
    String.raw`recoger(?:lo|la|los|las)?\s+en\s+persona`,
    String.raw`(?:puedes|pasa\s+a|pasar\s+a)\s+recoger\p{L}*`,
    String.raw`punto\s+de\s+entrega`,
  ]),
};

/** Las que se revisan en la propuesta de «Sube y vende» (no conoce envíos ni entregas). */
const PROPOSAL_CLAIMS: readonly ClaimKind[] = [
  "warranty",
  "authenticity",
  "free_shipping",
  "delivery_promise",
  "delivery_days",
  "returns",
  "discount",
  "financing",
  "invoice",
  "sealed",
];

export const ALL_CLAIMS = Object.keys(CLAIM_PATTERNS) as ClaimKind[];

const MONEY =
  /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?|\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(?:pesos|mxn)\b/giu;
const PIECES = /\b(\d{1,6})\s+(?:piezas?|unidades?|pzas?\.?|disponibles)\b/giu;
const DAYS = /(?<![\p{L}\p{N}])(\d{1,4})\s*d[ií]as?(?![\p{L}\p{N}])/giu;
/** Porcentajes («40 %», «30% de descuento», «12 por ciento»): la IA no calcula márgenes (P2). */
const PERCENT = /(?<![\p{L}\p{N}.,])(\d{1,3}(?:[.,]\d{1,2})?)\s*(?:%|por\s*ciento)/giu;
/** Montos en otra moneda: el precio del vendedor es en pesos, así que ninguno cuadra (P2). */
const FOREIGN_MONEY =
  /(?<![\p{L}\p{N}])(?:us\$|usd|eur|€)\s?\d|\d\s?(?:d[oó]lares|usd|dlls?|euros?|eur)(?![\p{L}\p{N}])/iu;

function toCents(integer: string, decimals: string | undefined) {
  return Number(integer.replace(/,/g, "")) * 100 + Number((decimals ?? "0").padEnd(2, "0"));
}

function percentKey(raw: string) {
  return String(Number(raw.replace(",", ".")));
}

/** Porcentajes que aparecen en un texto (forma canónica: «86», «2.5»). */
export function percentsIn(...texts: (string | null | undefined)[]): Set<string> {
  const found = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of normalizeText(text).matchAll(PERCENT)) found.add(percentKey(match[1]!));
  }
  return found;
}

/** Montos en pesos que aparecen en el texto, en centavos. */
export function moneyAmountsCents(text: string): number[] {
  return [...normalizeText(text).matchAll(MONEY)].map((match) =>
    match[1] ? toCents(match[1], match[2]) : toCents(match[3]!, match[4]),
  );
}

/** Tipos de afirmación P4 que aparecen en el texto (entre `kinds`). */
export function claimsIn(text: string, kinds: readonly ClaimKind[] = ALL_CLAIMS): ClaimKind[] {
  const normalized = normalizeText(text);
  return kinds.filter((kind) => CLAIM_PATTERNS[kind].test(normalized));
}

/** ¿Hay urgencia o escasez inventada? */
export function hasUrgency(text: string) {
  return URGENCY.test(normalizeText(text));
}

/** ¿Hay instrucciones o datos de pago por fuera? */
export function hasPaymentInstructions(text: string) {
  return PAYMENT.test(normalizeText(text));
}

/** Reglas con que se revisa un texto. */
export type TextRules = {
  /** Nombre confirmado: repetirlo no es una afirmación ni una cifra de la IA. */
  productName: string;
  /** Montos permitidos en centavos. */
  allowedCents: ReadonlySet<number>;
  /** Piezas permitidas; `null`: ninguna cifra de piezas. */
  quantity: number | null;
  /** Afirmaciones a revisar (vacío: ninguna, p. ej. consejos para el vendedor). */
  claimKinds: readonly ClaimKind[];
  /** Afirmaciones que los datos sí respaldan. */
  allowedClaims?: ReadonlySet<ClaimKind>;
  /** Días permitidos (entrega, garantía, devoluciones). Sin él no se revisan los días. */
  allowedDays?: ReadonlySet<number>;
  /**
   * Porcentajes que escribió el vendedor (en su texto o descripción). Cualquier otro porcentaje es
   * una cifra de la IA (margen, descuento, «ahorra 30 %») y se quita (P2).
   */
  allowedPercents?: ReadonlySet<string>;
  /**
   * Piezas en existencia, en lo que ve quien compra: se quita la frase que las junta con un precio
   * («8 bolsas por $1,199»: ¿$1,199 cada una o las 8?) o que las dice («Tengo 8 bolsas de piel»:
   * cambia con cada venta). Ver `mentionsStock`. Con 1 pieza no hay lote que confundir.
   */
  stock?: number;
  /**
   * Sin la primera persona del vendedor, en singular o plural («tengo», «vendemos», «nos salen»…): la
   * descripción y la propuesta de valor hablan del producto. Las preguntas y las citas («¿Cuánto me cuesta?») son la
   * voz de quien compra y no cuentan.
   */
  noSellerVoice?: boolean;
};

/** La primera persona del vendedor, en singular o en plural: sus existencias, su costo o su venta. */
const SELLER_VOICE = phrases([
  "tengo",
  "tenemos",
  "vendo",
  "vendemos",
  "ofrezco",
  "ofrecemos",
  String.raw`(?:me|nos)\s+sal(?:e|en|ieron|i[oó])`,
  String.raw`(?:me|nos)\s+cuestan?`,
  String.raw`(?:me|nos)\s+cost(?:aron|[oó])`,
  String.raw`(?:cuento|contamos)\s+con`,
]);
/** Preguntas (con «¿» o sin él) y citas. */
const QUESTIONS_AND_QUOTES = /¿[^?]*\?|[^.!?¡¿…]*\?|«[^»]*»|“[^”]*”|"[^"]*"/gu;

const MARKER_FINDING: Record<RedactionMarker, GuardFinding> = {
  costo: "number",
  cuenta: "payment",
  correo: "contact",
  liga: "contact",
  usuario: "contact",
  teléfono: "contact",
};

/** Medidas, duraciones y rangos después del número: «3 kg», «12 meses», «8–12 s», «8 x 10». */
const MEASURE_AFTER =
  /^\s*(?:[–-]\s*\d|(?:%|×|x|kg|kilos?|g|gr|gramos?|mg|l|lts?|litros?|ml|cm|mm|m|metros?|pulgadas?|"|gb|tb|mb|mah|w|v|hz|s|seg|segs|segundos?|min|minutos?|h|hrs?|horas?|d[ií]as?|semanas?|mes|meses|años?|oz|onzas?|°|º)(?![\p{L}\p{N}]))/iu;
/**
 * Atributos antes del número: «talla 8», «rin 15», «juego de 4», «con 8 bolsillos», «8–12». «Contamos
 * con 8» no: son las existencias.
 */
const ATTRIBUTE_BEFORE =
  /(?<!\p{L})(?:talla|tallas|n[uú]mero|n[uú]m\.?|no\.|rodada|rin|modelo|serie|versi[oó]n|generaci[oó]n|edici[oó]n|calibre|tama[nñ]o|(?:paquete|juego|set|kit|caja|pack|estuche)\s+de|(?<!(?:cuento|contamos)\s+)con|incluye|trae|[–-])\s*$/iu;
/** Quien vende diciendo cuántas tiene: «tenemos 8», «contamos con ocho», «quedan 8». */
const STOCK_VERB_BEFORE = /(?<!\p{L})(?:tengo|tenemos|(?:cuento|contamos)\s+con|quedan)\s+$/iu;
/** «8 en existencia», «ocho disponibles». */
const STOCK_AFTER = /^\s+(?:en\s+(?:existencia|stock|inventario)|disponibles?)(?!\p{L})/iu;
/** La palabra que sigue al número («8 bolsas hechas a mano», «ocho piezas»). */
const NEXT_WORD = /^\s+(\p{L}+)/u;

function escapeName(name: string) {
  return normalizeText(name)
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    .replace(/\s+/g, String.raw`\s+`);
}

/**
 * Las piezas en existencia, en cifra o con letra. La palabra no cuenta si es del nombre confirmado
 * («Pastel de tres leches» con 3 piezas).
 */
function stockPattern(stock: number, productName: string) {
  const word = NUMBER_WORDS[stock];
  const inName =
    word !== undefined &&
    new RegExp(String.raw`(?<!\p{L})(?:${word})(?!\p{L})`, "iu").test(normalizeText(productName));
  const alternatives = word && !inName ? `${stock}|${word}` : String(stock);
  return new RegExp(
    String.raw`(?<![\p{L}\p{N}.,$#/])(?:${alternatives})(?![\p{L}\p{N}]|[.,]\d)`,
    "giu",
  );
}

/** Las veces que el número de piezas aparece suelto: no dentro de un monto, medida, talla o rango. */
function* stockCounts(text: string, number: RegExp) {
  const rest = text.replace(MONEY, " ");
  for (const match of rest.matchAll(number)) {
    const before = rest.slice(0, match.index);
    const after = rest.slice(match.index + match[0].length);
    if (!ATTRIBUTE_BEFORE.test(before) && !MEASURE_AFTER.test(after)) yield { before, after };
  }
}

function hasMoney(text: string) {
  return [...text.matchAll(MONEY)].length > 0;
}

/**
 * ¿La frase dice las piezas en existencia? Cuentan si van con un precio, en la frase o en otra del
 * mismo campo (`priceInField`: «Son ocho. Llévate la tuya por $1,199.»); antes de una palabra del
 * producto o genérica («Hay 8 bolsas hechas a mano», «ocho piezas», «8 en existencia»); tras un verbo
 * de existencias («Tenemos ocho hermosas bolsas»), o justo antes del nombre confirmado («Tengo 8
 * bolsas de piel café»). Precio y palabras se buscan en `figures` (sin el nombre: «AirPods Pro 2
 * disponibles» con 2 piezas no cuenta) y el nombre en el texto completo.
 */
function mentionsStock(
  text: string,
  figures: string,
  stock: number,
  productName: string,
  priceInField: boolean,
) {
  if (stock < 2) return false;
  const number = stockPattern(stock, productName);
  const withPrice = priceInField || hasMoney(figures);
  const product = new Set(productWords(productName));
  for (const { before, after } of stockCounts(figures, number)) {
    if (withPrice || STOCK_VERB_BEFORE.test(before) || STOCK_AFTER.test(after)) return true;
    const [word] = productWords(NEXT_WORD.exec(after)?.[1] ?? "");
    if (word && (product.has(word) || LOT_NOUNS.has(word))) return true;
  }
  const name = escapeName(productName);
  if (!name) return false;
  const beforeName = new RegExp(String.raw`^\s+${name}`, "iu");
  for (const { after } of stockCounts(text, number)) if (beforeName.test(after)) return true;
  return false;
}

/** El lote completo («El lote completo por $1,199», «$1,199 en total», «el paquete completo a…»). */
const LOT = phrases([
  "lote",
  String.raw`en\s+total`,
  String.raw`precio\s+total`,
  String.raw`paquete\s+completo`,
]);
/** «Todas las bolsas», «todas nuestras bolsas»: el sustantivo dice si habla del producto. */
const ALL_OF = /(?<![\p{L}\p{N}])tod[oa]s\s+(?:l[oa]s|mis|nuestr[oa]s)\s+(\p{L}+)/giu;
/** Sustantivos genéricos del lote (como los da `productWords`: sus primeros 4 caracteres). */
const LOT_NOUNS = new Set(["piez", "unid", "arti", "prod", "pare"]);

/**
 * ¿La frase habla del lote completo junto a un precio? Con 2 piezas o más, «Todas las bolsas por
 * $1,199» se lee como el precio de todas. «Todas nuestras bolsas son de piel» (sin precio) o «para
 * todos los días» (no habla del producto) no cuentan.
 */
function mentionsLot(text: string, figures: string, stock: number, productName: string) {
  if (stock < 2 || !hasMoney(figures)) return false;
  if (LOT.test(figures)) return true;
  const product = new Set(productWords(productName));
  for (const [, noun] of text.matchAll(ALL_OF)) {
    const [word] = productWords(noun!);
    if (word && (product.has(word) || LOT_NOUNS.has(word))) return true;
  }
  return false;
}

export function withoutProductName(text: string, productName: string) {
  const name = normalizeText(productName).trim();
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, String.raw`\s+`);
  return text.replace(new RegExp(escaped, "giu"), " ");
}

/** De dónde viene el texto que se revisa (lo pone `createCleaner`). */
export type TextContext = {
  /**
   * Otra frase del mismo campo trae un precio: las piezas en existencia se leen como el precio del
   * lote aunque vayan en frases distintas («Son ocho. Llévate la tuya por $1,199.»).
   */
  priceInField?: boolean;
};

/** ¿El campo completo trae un precio (sin contar las cifras del nombre confirmado)? */
function fieldHasPrice(value: string, productName: string) {
  return hasMoney(withoutProductName(normalizeText(value), productName));
}

/** Hallazgos de un texto según las reglas. */
export function textFindings(
  raw: string,
  rules: TextRules,
  context: TextContext = {},
): Set<GuardFinding> {
  const found = new Set<GuardFinding>();
  const text = normalizeText(raw);
  const personal = findPersonalData(text);
  if (personal.includes("account")) found.add("payment");
  if (personal.some((kind) => kind !== "account")) found.add("contact");
  for (const marker of redactionMarkersIn(text)) found.add(MARKER_FINDING[marker]);
  if (PAYMENT.test(text)) found.add("payment");
  if (URGENCY.test(text)) found.add("urgency");
  // Cuenta como cifra: la primera persona del vendedor trae sus datos («tengo 8», «me salen en»).
  if (rules.noSellerVoice && SELLER_VOICE.test(text.replace(QUESTIONS_AND_QUOTES, " "))) {
    found.add("number");
  }
  // Afirmaciones y cifras se revisan sin el nombre que confirmó el vendedor: repetir «Tenis
  // originales» no es una afirmación de la IA, y «AirPods Pro 2 disponibles» no son 2 piezas.
  const figures = withoutProductName(text, rules.productName);
  if (
    rules.stock !== undefined &&
    (mentionsStock(text, figures, rules.stock, rules.productName, !!context.priceInField) ||
      mentionsLot(text, figures, rules.stock, rules.productName))
  ) {
    found.add("number");
  }
  const claims = claimsIn(figures, rules.claimKinds);
  if (claims.some((kind) => !rules.allowedClaims?.has(kind))) found.add("claim");
  // Nunca respaldada por un dato, ni en los consejos para el vendedor: la plataforma no verifica.
  if (PLATFORM_CLAIM.test(figures)) found.add("claim");
  for (const match of figures.matchAll(MONEY)) {
    const cents = match[1] ? toCents(match[1], match[2]) : toCents(match[3]!, match[4]);
    if (!rules.allowedCents.has(cents)) found.add("number");
  }
  for (const match of figures.matchAll(PIECES)) {
    if (rules.quantity === null || Number(match[1]) !== rules.quantity) found.add("number");
  }
  if (rules.allowedDays) {
    for (const match of figures.matchAll(DAYS)) {
      if (!rules.allowedDays.has(Number(match[1]))) found.add("number");
    }
  }
  for (const match of figures.matchAll(PERCENT)) {
    if (!rules.allowedPercents?.has(percentKey(match[1]!))) found.add("number");
  }
  if (FOREIGN_MONEY.test(figures)) found.add("number");
  return found;
}

const SENTENCE = /(?<=[.!?…])\s+/u;

/**
 * Acumula hallazgos y cuenta lo quitado. `text` quita frases; `list` quita elementos. Si lo que
 * queda es más corto que `min`, se usa `fallback`.
 */
export function createCleaner() {
  const findings = new Set<GuardFinding>();
  let removed = 0;
  const isClean = (text: string, rules: TextRules, context?: TextContext) => {
    const found = textFindings(text, rules, context);
    for (const finding of found) findings.add(finding);
    return found.size === 0;
  };
  return {
    isClean,
    text(value: string, fallback: string, rules: TextRules, min = 1) {
      if (!value.trim()) return value;
      const context: TextContext = {
        priceInField: rules.stock !== undefined && fieldHasPrice(value, rules.productName),
      };
      // Respeta los saltos de línea (mensajes de WhatsApp o Facebook): revisa frase por frase.
      const lines = value.split(/\n/u).map((line) => {
        const sentences = line.split(SENTENCE);
        const kept = sentences.filter(
          (sentence) => !sentence.trim() || isClean(sentence, rules, context),
        );
        removed += sentences.length - kept.length;
        return kept.join(" ").trim();
      });
      const joined = lines
        .join("\n")
        .replace(/\n{3,}/gu, "\n\n")
        .trim();
      return joined.length >= min ? joined : fallback;
    },
    list<T>(items: T[], toText: (item: T) => string, fallback: T[], rules: TextRules) {
      const kept = items.filter((item) => isClean(toText(item), rules));
      removed += items.length - kept.length;
      return kept.length > 0 ? kept : fallback;
    },
    result() {
      return { removed, findings: [...findings] };
    },
  };
}

/** Palabras que no distinguen un producto de otro. */
const FILLER_WORDS = new Set(["del", "las", "los", "para", "con", "sin", "por", "una", "uno"]);

/** Palabras de un nombre de producto, sin acentos ni plurales (sus primeros 4 caracteres). */
function productWords(text: string) {
  return normalizeText(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((word) => word.length >= 3 && /\p{L}/u.test(word) && !FILLER_WORDS.has(word))
    .map((word) => word.slice(0, 4));
}

/**
 * ¿El título que redactó la IA es del producto que confirmó el vendedor? Sus cifras deben estar en el
 * nombre confirmado (ni piezas, ni precio, ni otro modelo) y comparte con él al menos una palabra.
 */
function sameProduct(title: string, confirmed: string) {
  const digits = new Set(normalizeText(confirmed).match(/\d+/gu) ?? []);
  if ((normalizeText(title).match(/\d+/gu) ?? []).some((run) => !digits.has(run))) return false;
  const words = new Set(productWords(confirmed));
  return productWords(title).some((word) => words.has(word));
}

export function guardProposal(proposal: SaleProposal, facts: ProposalFacts): GuardedProposal {
  const range = suggestedPriceRange(facts.priceCents);
  const daily = suggestedDailyBudgetCents(facts);
  const allowedCents = new Set([facts.priceCents, range.minCents, range.maxCents, daily]);
  const cleaner = createCleaner();

  const price = formatMoney(facts.priceCents);
  const base = {
    // Repetir el nombre que CONFIRMÓ el vendedor no es afirmación ni cifra de la IA (el título no).
    productName: facts.productName,
    allowedCents,
    quantity: facts.quantity,
    allowedPercents: percentsIn(facts.text, facts.productName),
  };
  const publish: TextRules = { ...base, claimKinds: PROPOSAL_CLAIMS };
  // Lo que ve quien compra: sin las piezas en existencia (cambian con cada venta y, junto al precio,
  // se leen como el precio del lote).
  const buyer: TextRules = { ...publish, quantity: null, stock: facts.quantity };
  // La descripción y la propuesta de valor hablan del producto; el post (anuncios) sí es del vendedor.
  const listing: TextRules = { ...buyer, noSellerVoice: true };
  const advice: TextRules = { ...base, claimKinds: [] };

  // El título lo redacta la IA (singular, como publicación); si trae algo que no se puede respaldar
  // o no es del mismo producto, va el nombre que confirmó el vendedor. Las mayúsculas las pone el
  // código: la inicial, y las demás solo si el vendedor las escribió así (marcas) o son siglas.
  const [aiTitle] = cleaner.list([proposal.productName], (title) => title, [], buyer);
  const name = listingTitle(
    aiTitle && sameProduct(aiTitle, facts.productName) ? aiTitle : facts.productName,
    [facts.productName, facts.text],
  );

  // Los textos de respaldo los arma el código. Con 2 piezas o más dicen que el precio es por pieza:
  // con el nombre en plural del vendedor, «Bolsas de piel café a $1,199» se lee como el precio de todas.
  const each = facts.quantity >= 2 ? `${price} por pieza` : price;

  const guarded: SaleProposal = {
    ...proposal,
    productName: name,
    headline: cleaner.text(proposal.headline, `${name} a ${each}`, buyer, 5),
    description: cleaner.text(
      proposal.description,
      `${name} a ${each}. Escríbeme para más detalles.`,
      listing,
      20,
    ),
    valueProposition: cleaner.text(
      proposal.valueProposition,
      `${name} a ${each}, con trato directo.`,
      listing,
      10,
    ),
    tags: cleaner.list(proposal.tags, (tag) => tag, [], publish),
    targetAudiences: cleaner.list(
      proposal.targetAudiences,
      (audience) => `${audience.name}. ${audience.why}`,
      [
        {
          name: "Tu comunidad cercana",
          why: "Las primeras ventas suelen llegar de gente que ya te conoce.",
        },
      ],
      advice,
    ),
    contentIdeas: cleaner.list(
      proposal.contentIdeas,
      (idea) => idea,
      [`Foto de ${name} en uso real, con luz natural.`],
      publish,
    ),
    adIdeas: cleaner.list(
      proposal.adIdeas,
      (ad) => ad,
      [`${name} a ${each}. Escríbeme para apartarlo.`],
      buyer,
    ),
    videoScript: cleaner.text(
      proposal.videoScript,
      `Muestra ${name} de cerca, di para qué sirve y su precio: ${each}.`,
      buyer,
    ),
    suggestedPriceRange: {
      ...range,
      rationale: cleaner.text(proposal.suggestedPriceRange.rationale, "", advice),
    },
    suggestedDailyBudgetCents: daily,
    budgetRationale: cleaner.text(proposal.budgetRationale, "", advice),
    objections: cleaner.list(
      proposal.objections,
      (item) => `${item.objection} ${item.answer}`,
      [
        {
          objection: "¿Cómo sé que es confiable?",
          answer: "Muestra fotos reales y responde solo con lo que puedas comprobar.",
        },
      ],
      advice,
    ),
    ctas: cleaner.list(proposal.ctas, (cta) => cta, ["Compra ahora"], buyer),
    assumptions: cleaner.list(
      proposal.assumptions,
      (assumption) => assumption,
      ["Usamos el precio, costo y cantidad que confirmaste."],
      advice,
    ),
  };
  return { proposal: guarded, ...cleaner.result() };
}
