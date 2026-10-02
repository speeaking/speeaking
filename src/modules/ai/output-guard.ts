import { siteConfig } from "@/config/site";
import { formatMoney } from "@/lib/format";
import {
  findPersonalData,
  normalizeText,
  type RedactionMarker,
  redactionMarkersIn,
} from "./personal-data";
import { suggestedDailyBudgetCents, suggestedPriceRange } from "./proposal-numbers";
import { isKnownBrand, listingTitle, NUMBER_WORDS, type SaleProposal } from "./sale-proposal";

/**
 * Guardián de contenido de la IA (SEC-28). El esquema solo valida la FORMA; esto valida el
 * CONTENIDO contra los datos que confirmó el vendedor, antes de guardar o mostrar:
 *
 * - `contact` / `payment`: correos, teléfonos, ligas, usuarios, CLABE o tarjetas, e instrucciones de
 *   pago por fuera («transferencia», «depósito»…). La plataforma cobra dentro de la app.
 * - `urgency`: urgencia o escasez inventadas («últimas piezas», «solo hoy», «quedan 5», «única pieza
 *   disponible», «solo queda una», «no te quedes con las ganas»…); P12.
 * - `claim`: afirmaciones que exigen un dato verificable (P4) que no está en los datos: garantía,
 *   originalidad, envío gratis, devoluciones, tiempos de entrega, descuentos… Y en TODO, también en
 *   los consejos para el vendedor, que la plataforma verifica, revisa, certifica o garantiza algo
 *   (`PLATFORM_CLAIM`): no lo hace; o atribuirle al vendedor lo que no escribió («El vendedor menciona
 *   que es original», `misattributes`).
 * - `number`: montos, piezas o días distintos de los confirmados (P2).
 * - `stock`: en lo que ve quien compra, las piezas en existencia (en cifra o con letra) junto a un
 *   precio, aunque vaya en otra frase del campo («8 bolsas por $1,199» se lee como el precio de las
 *   8), antes de una palabra del producto o genérica («Tengo 8 bolsas de piel», «ocho piezas») o tras
 *   «tenemos / contamos con», y el lote junto a un precio («Todas las bolsas por $1,199», «$1,199 en
 *   total», «Llévatelas por $1,199», «Todas a $1,199»). Cambian con cada venta y se leen como el
 *   precio de todas. En el título, además, el plural y el lote sin precio.
 * - `voice`: en título, descripción y propuesta de valor, la primera persona del vendedor («tengo»,
 *   «nuestras», «me salen en»): esos textos describen el producto para quien compra.
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

export const GUARD_FINDINGS = [
  "contact",
  "payment",
  "urgency",
  "claim",
  "number",
  "stock",
  "voice",
] as const;

export type GuardFinding = (typeof GUARD_FINDINGS)[number];

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

const ONLY = String.raw`(?:s[oó]lo|solamente|[uú]nicamente|nada\s+m[aá]s)`;
/**
 * Una sola pieza («solo queda una», «solo hay 1»), salvo que siga lo que no son existencias: «solo hay
 * una talla», «solo queda una cosa: elegir tu tono».
 */
const ONE = String.raw`(?:una|uno|1)(?![\p{L}\p{N}])(?!\s+(?:talla|medida|tama[nñ]o|color|tono|modelo|versi[oó]n|presentaci[oó]n|forma|manera|cosa|pregunta|duda|opci[oó]n|diferencia)(?![\p{L}\p{N}]))`;

const URGENCY = phrases([
  String.raw`[uú]ltim[oa]s?\s+(?:\d+\s+)?(?:piezas?|unidad(?:es)?|oportunidad|d[ií]as?|horas?|disponibles?)`,
  String.raw`${ONLY}\s+(?:(?:me|nos)\s+)?quedan`,
  // «Quedan 5 bolsas», «solo nos quedan tres»: escasez, sea o no la cifra confirmada.
  String.raw`quedan\s+(?:\d+|${Object.values(NUMBER_WORDS).join("|")})`,
  String.raw`quedan\s+(?:muy\s+)?(?:poc[oa]s|poquit[oa]s)`,
  // Una sola pieza: el modelo escribió «Única pieza disponible» en el titular con 8 en existencia
  // (2026-10-02). «La única pieza», «solo queda una», «me queda una sola», «solo hay 1», «la única que
  // queda». No «pieza única» ni «cada pieza es única» (irrepetible, hecha a mano) ni «cortada en una
  // única pieza de piel» (hechura), salvo que digan que está disponible.
  String.raw`(?<!(?<!\p{L})una\s+)[uú]nicas?\s+(?:piezas?|unidad(?:es)?)`,
  String.raw`[uú]nicas?\s+(?:piezas?|unidad(?:es)?)\s+disponibles?`,
  String.raw`(?:pieza|unidad)\s+[uú]nica\s+disponible`,
  String.raw`(?:la|el)\s+[uú]nic[oa]\s+que\s+(?:(?:me|nos)\s+)?(?:queda|hay|tengo|tenemos)`,
  String.raw`${ONLY}\s+(?:(?:me|nos)\s+)?queda\s+${ONE}`,
  String.raw`(?:me|nos)\s+quedan?\s+(?:${ONLY}\s+)?(?:${ONE}|poc[oa]s|poquit[oa]s)`,
  String.raw`queda\s+(?:${ONLY}\s+${ONE}|(?:una|uno|1)\s+sol[oa])`,
  String.raw`${ONLY}\s+(?:hay|tengo|tenemos|existe)\s+${ONE}`,
  String.raw`${ONLY}\s+(?:una|uno|1)\s+(?:(?:pieza|unidad)\s+)?disponible`,
  // «Es el único disponible», «único par» de tenis (2026-10-02); no «un único par de agujetas».
  String.raw`[uú]nic[oa]s?\s+(?:disponibles?|en\s+existencia)`,
  String.raw`(?<!(?<!\p{L})un[oa]?\s+)[uú]nic[oa]\s+(?:ejemplar|par)(?!\s+de\s)`,
  String.raw`se\s+(?:est[aá]n\s+)?acaba(?:n|ndo)?`,
  String.raw`antes\s+de\s+que\s+se\s+acaben?`,
  String.raw`por\s+tiempo\s+limitado`,
  String.raw`oferta\s+(?:termina|v[aá]lida\s+hasta|rel[aá]mpago)`,
  String.raw`(?:s[oó]lo|[uú]nicamente|nada\s+m[aá]s)\s+(?:por\s+)?hoy`,
  String.raw`hoy\s+mismo`,
  String.raw`date\s+prisa`,
  "ap[uú]rate",
  "c[oó]rrele",
  String.raw`no\s+te\s+quedes\s+(?:sin|con\s+las\s+ganas)`,
  // «Aprovecha mientras haya», «aprovéchalo mientras dure»; «mientras haya existencias».
  String.raw`aprov[eé]ch\p{L}*\s+(?:\p{L}+\s+){0,2}?mientras`,
  String.raw`mientras\s+(?:haya|queden?|duren?|existan?)\s+(?:existencias|piezas|unidades|stock|inventario)`,
  String.raw`mientras\s+(?:haya|queden?|duren?)(?=\s*(?:[.,;!…]|$))`,
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

const SELLER = String.raw`(?:el\s+vendedor|la\s+vendedora|quien\s+vende)`;
const SAYS = String.raw`(?:(?:mencion|indic|afirm|asegur|coment|se[nñ]al|confirm|explic|aclar|especific|declar)(?:a|[oó])|dice|dijo|escribe|escribi[oó]|describe|describi[oó])`;
/**
 * Le atribuye algo al vendedor: «el vendedor menciona que…», «la vendedora también dice…», «según el
 * vendedor», «como indica quien vende». No «el vendedor no menciona…» ni «el vendedor puede mostrar…».
 */
const ATTRIBUTION = phrases([
  String.raw`${SELLER}(?:\s+(?:te|nos|le|les|me|tambi[eé]n|ya))*\s+${SAYS}`,
  String.raw`(?:seg[uú]n|de\s+acuerdo\s+con)\s+${SELLER}`,
  String.raw`(?:seg[uú]n|como)\s+(?:lo\s+)?(?:que\s+)?${SAYS}\s+${SELLER}`,
]);
/**
 * Dónde termina lo que se le atribuye: otra frase (la pregunta de quien compra), «pero», «aunque»,
 * «, lo que…», «;» o «:» («El vendedor indica que es de piel, pero pídele la factura»).
 */
const CLAUSE_BREAK =
  /[.!?¿¡…;:()—]|\s[–-]\s|,?\s+(?:pero|aunque|sin\s+embargo|no\s+obstante|sino|as[ií]\s+que|por\s+(?:eso|lo\s+que|lo\s+tanto)|mientras\s+que|y\s+(?:te|le|les))(?![\p{L}\p{N}])|,\s*lo\s+(?:que|cual)(?![\p{L}\p{N}])/iu;
/**
 * Lo que solo se le puede atribuir si está en su texto, por concepto: los sinónimos van juntos
 * («elaborado a mano» por «hechas a mano», «cuero» por «piel»).
 */
const ATTRIBUTED_CLAIMS = [
  "originale?s?|originalidad",
  String.raw`aut[eé]ntic[oa]s?|autenticidad`,
  "genuin[oa]s?",
  String.raw`de\s+marca`,
  "sellad[oa]s?",
  String.raw`certificad[oa]s?|certificaci[oó]n`,
  String.raw`garant[ií]as?|garantizad[oa]s?`,
  "facturas?",
  "nuev[oa]s?",
  String.raw`piel(?:es)?|cuero`,
  String.raw`a\s+mano|artesanal(?:es|mente)?`,
  "naturale?s?",
  "gamuza",
  "seda",
  String.raw`algod[oó]n`,
  "lana",
  "lino",
  "mezclilla",
  "oro",
  "plata",
  "acero",
  "madera",
  String.raw`bamb[uú]`,
  String.raw`cer[aá]mica`,
  "barro",
  "vidrio",
].map((alternative) => phrases([alternative]));

/**
 * ¿Le atribuye al vendedor algo que no escribió? El modelo inventaba «El vendedor menciona que es
 * original» (2026-10-02) sin «original» en su texto. Contar fielmente lo que sí escribió («El vendedor
 * indica que es de piel») se queda.
 */
function misattributes(text: string, sellerText: string) {
  if (!ATTRIBUTION.test(text)) return false;
  const own = normalizeText(sellerText);
  return text
    .split(CLAUSE_BREAK)
    .some(
      (clause) =>
        ATTRIBUTION.test(clause) &&
        ATTRIBUTED_CLAIMS.some((claim) => claim.test(clause) && !claim.test(own)),
    );
}

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
  /**
   * Es el título de la publicación: con 2 piezas o más (`stock`) no va en plural («Aguas de jamaica»)
   * ni habla del lote, aunque no traiga precio («Bolsa de piel en total»).
   */
  title?: boolean;
  /**
   * Lo que escribió el vendedor (su texto y el nombre que confirmó). Con él, una frase que le atribuye
   * algo que no está ahí se quita («El vendedor menciona que es original»). Sin él (el kit de
   * anuncios) no se revisan las atribuciones.
   */
  sellerText?: string;
};

/**
 * La primera persona del vendedor, en singular o en plural: sus existencias, su costo, su venta,
 * quién lo hace («las hago yo misma») y lo suyo («nuestras bolsas»).
 */
const SELLER_VOICE = phrases([
  "tengo",
  "tenemos",
  "vendo",
  "vendemos",
  "ofrezco",
  "ofrecemos",
  "dejo",
  "dejamos",
  "doy",
  "damos",
  "hago",
  "hacemos",
  "elaboro",
  "elaboramos",
  "fabrico",
  "fabricamos",
  "preparo",
  "preparamos",
  "horneo",
  "horneamos",
  "cocino",
  "cocinamos",
  String.raw`nuestr[oa]s?`,
  // «Las hago yo misma»; no el juguete «yo-yo».
  String.raw`(?<!-)yo(?!-)`,
  String.raw`(?:me|nos)\s+sal(?:e|en|ieron|i[oó])`,
  String.raw`(?:me|nos)\s+cuestan?`,
  String.raw`(?:me|nos)\s+cost(?:aron|[oó])`,
  String.raw`(?:cuento|contamos)\s+con`,
]);
/**
 * «Por mí», «mi taller», «mis bolsas». Sin la bandera `i` a propósito: «Mi» antes de una mayúscula
 * es una marca («Mi Band», «Mi Fitness»).
 */
const SELLER_MY = /(?<![\p{L}\p{N}])(?:[Mm]í|[Mm]is?(?!\s+\p{Lu}))(?![\p{L}\p{N}])/u;
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
 * Un verbo de compra o de venta con el pronombre en plural: «Llévatelas», «cómpralos», «apártalas»,
 * «pídelos»; «te las dejo», «los doy». El grupo 1 o 2 dice el género («a» u «o»).
 */
const PLURAL_PRONOUN =
  /(?<!\p{L})(?:ll[eé]v|c[oó]mpr|ap[aá]rt|p[ií]d|cons[ií]gu|adqui[eé]r|estr[eé]n)(?:a|e|ate|ete)?l([ao])s(?!\p{L})|(?<!\p{L})(?:(?:te|se|me)\s+)?l([ao])s\s+(?:dejo|dejamos|doy|damos|vendo|vendemos|ofrezco|ofrecemos|pongo|paso)(?!\p{L})/giu;
/** «Todas a $1,199», «todos por solo $1,199»; «para todas a $1,199» no habla del lote. */
const ALL_AT_PRICE =
  /(?<![\p{L}\p{N}])(?<!(?:para|con|de)\s+)tod[oa]s\s+(?:a|por|en|de)\s+(?:(?:s[oó]lo|solamente)\s+)?(?=\$|\d)/iu;
/** El precio dicho por pieza: «llévatelas a $1,199 cada una» no es el precio de todas. */
const PER_PIECE = phrases([
  String.raw`cada\s+(?:un[oa]|pieza|unidad|par)`,
  String.raw`por\s+(?:pieza|unidad|par)`,
  "c/u",
]);

/**
 * Productos que se nombran en plural aunque sean uno, con su género: «Llévatelos» habla de UN par
 * de tenis; «Llévatelas» con unas bolsas, de todas.
 */
const PLURAL_NAMED: Readonly<Record<string, "a" | "o">> = {
  airpods: "o",
  anteojos: "o",
  aretes: "o",
  audifonos: "o",
  binoculares: "o",
  botines: "o",
  calcetines: "o",
  guantes: "o",
  huaraches: "o",
  jeans: "o",
  leggings: "o",
  lentes: "o",
  mocasines: "o",
  pantalones: "o",
  pants: "o",
  patines: "o",
  shorts: "o",
  tacones: "o",
  tenis: "o",
  zapatos: "o",
  bermudas: "a",
  botas: "a",
  calcetas: "a",
  chanclas: "a",
  crocs: "a",
  gafas: "a",
  mallas: "a",
  medias: "a",
  pantuflas: "a",
  pinzas: "a",
  sandalias: "a",
  tijeras: "a",
  zapatillas: "a",
};
/** Antes del nombre en plural, dice que el producto es otro: «Funda para audífonos». */
const OTHER_PRODUCT_BEFORE = new Set(["para", "de", "con", "sin", "por", "a", "en"]);

/** Palabras sin acentos y en minúsculas. */
function plainWords(text: string) {
  return normalizeText(text)
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
}

/** Género del nombre en plural de UN producto («Tenis Nike» → «o»), o `null`. */
export function pluralNamedGender(productName: string): "a" | "o" | null {
  const words = plainWords(productName);
  for (const [index, word] of words.entries()) {
    const gender = PLURAL_NAMED[word];
    if (gender && !OTHER_PRODUCT_BEFORE.has(words[index - 1] ?? "")) return gender;
  }
  return null;
}

/**
 * ¿La frase (que ya trae un precio) habla de todas con un pronombre en plural? «Llévatelas por
 * $1,199», «Te las dejo en $1,199», «Todas a $1,199». No cuenta si el precio se dice por pieza ni si
 * el pronombre es del nombre en plural de un solo producto («Tenis Nike: llévatelos por $1,199»).
 */
function pluralPronounLot(figures: string, productName: string) {
  if (PER_PIECE.test(figures)) return false;
  if (ALL_AT_PRICE.test(figures)) return true;
  const named = pluralNamedGender(productName);
  for (const match of figures.matchAll(PLURAL_PRONOUN)) {
    if ((match[1] ?? match[2])!.toLowerCase() !== named) return true;
  }
  return false;
}

/**
 * ¿La frase habla del lote completo junto a un precio? Con 2 piezas o más, «Todas las bolsas por
 * $1,199» o «Llévatelas por $1,199» se leen como el precio de todas. «Todas nuestras bolsas son de
 * piel» (sin precio) o «para todos los días» (no habla del producto) no cuentan.
 */
function mentionsLot(text: string, figures: string, stock: number, productName: string) {
  if (stock < 2 || !hasMoney(figures)) return false;
  if (LOT.test(figures)) return true;
  const product = new Set(productWords(productName));
  for (const [, noun] of text.matchAll(ALL_OF)) {
    const [word] = productWords(noun!);
    if (word && (product.has(word) || LOT_NOUNS.has(word))) return true;
  }
  return pluralPronounLot(figures, productName);
}

/** Terminan como plural y nombran una cosa: «Tres leches», «Lunes», «Cumpleaños». */
const SINGULAR_ENDING_IN_S = new Set([
  "dos",
  "tres",
  "seis",
  "mes",
  "gas",
  "tos",
  "lunes",
  "martes",
  "miércoles",
  "jueves",
  "viernes",
  "cumpleaños",
]);
/** Compuestos de verbo y sustantivo en plural, que son singulares: «Paraguas», «Cubrebocas». */
const COMPOUND_IN_S =
  /^(?:abre|corta|cubre|cuenta|guarda|lava|limpia|mata|para|pasa|pica|porta|quita|rompe|saca|salva|tapa|toca)\p{L}{3,}s$/u;
const PLURAL_ARTICLES = new Set(["los", "las", "unos", "unas"]);
const SINGULAR_ARTICLES = new Set(["el", "la", "un", "una"]);

/**
 * ¿El título está en plural? Lo dice su primera palabra, o la que sigue a «el / la / un / una»:
 * «Bolsas de piel», «Hermosas bolsas», «Las bolsas». No cuentan el nombre en plural de un solo
 * producto («Tenis Nike», «Nuevos AirPods»), los compuestos («Cubrebocas», «Paraguas»), las marcas
 * («Adidas») ni lo que termina en «s» acentuada, «-is» o «-us» («Autobús», «Análisis», «Virus»).
 */
function pluralTitle(title: string) {
  if (pluralNamedGender(title)) return false;
  const [first = "", second = ""] = normalizeText(title)
    .toLocaleLowerCase("es-MX")
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
  if (PLURAL_ARTICLES.has(first)) return true;
  const head = SINGULAR_ARTICLES.has(first) ? second : first;
  if (head.length < 4 || SINGULAR_ENDING_IN_S.has(head) || COMPOUND_IN_S.test(head)) return false;
  if (isKnownBrand(head)) return false;
  return /[aeo]s$/u.test(head);
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
  if (rules.noSellerVoice) {
    // Sin preguntas ni citas (la voz de quien compra) ni el nombre confirmado («Xiaomi Mi Band 8»).
    const said = withoutProductName(text.replace(QUESTIONS_AND_QUOTES, " "), rules.productName);
    if (SELLER_VOICE.test(said) || SELLER_MY.test(said)) found.add("voice");
  }
  // Afirmaciones y cifras se revisan sin el nombre que confirmó el vendedor: repetir «Tenis
  // originales» no es una afirmación de la IA, y «AirPods Pro 2 disponibles» no son 2 piezas.
  const figures = withoutProductName(text, rules.productName);
  if (
    rules.stock !== undefined &&
    (mentionsStock(text, figures, rules.stock, rules.productName, !!context.priceInField) ||
      mentionsLot(text, figures, rules.stock, rules.productName))
  ) {
    found.add("stock");
  }
  if (
    rules.title &&
    rules.stock !== undefined &&
    rules.stock >= 2 &&
    (LOT.test(figures) || pluralTitle(text))
  ) {
    found.add("stock");
  }
  const claims = claimsIn(figures, rules.claimKinds);
  if (claims.some((kind) => !rules.allowedClaims?.has(kind))) found.add("claim");
  // Nunca respaldada por un dato, ni en los consejos para el vendedor: la plataforma no verifica.
  if (PLATFORM_CLAIM.test(figures)) found.add("claim");
  // Tampoco se le atribuye al vendedor lo que no escribió, ni en los consejos.
  if (rules.sellerText !== undefined && misattributes(text, rules.sellerText)) found.add("claim");
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

/** ¿Es el mismo texto, sin contar mayúsculas ni espacios? */
function sameText(a: string, b: string) {
  const key = (text: string) =>
    normalizeText(text).replace(/\s+/gu, " ").trim().toLocaleLowerCase("es-MX");
  return key(a) === key(b);
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
    sellerText: [facts.text ?? "", facts.productName].join("\n"),
  };
  const publish: TextRules = { ...base, claimKinds: PROPOSAL_CLAIMS };
  // Lo que ve quien compra: sin las piezas en existencia (cambian con cada venta y, junto al precio,
  // se leen como el precio del lote).
  const buyer: TextRules = { ...publish, quantity: null, stock: facts.quantity };
  // La descripción y la propuesta de valor hablan del producto; el post (anuncios) sí es del vendedor.
  const listing: TextRules = { ...buyer, noSellerVoice: true };
  const advice: TextRules = { ...base, claimKinds: [] };

  // El título lo redacta la IA (singular, como publicación) y es lo más visible: sin la voz del
  // vendedor, sin el lote y, con 2 piezas o más, sin plural. Si trae algo que no se puede respaldar o
  // no es del mismo producto, va el nombre que confirmó el vendedor. Si la IA copió ese nombre tal
  // cual, es del vendedor (aunque vaya en plural): no se revisa como título de la IA. Las mayúsculas
  // las pone el código: la inicial, y las demás solo si el vendedor las escribió así (marcas) o son
  // siglas.
  const own = sameText(proposal.productName, facts.productName);
  const titleRules: TextRules = own ? buyer : { ...listing, title: true };
  const [aiTitle] = cleaner.list([proposal.productName], (title) => title, [], titleRules);
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
