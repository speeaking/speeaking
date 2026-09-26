import { formatMoney } from "@/lib/format";
import { findPersonalData, normalizeText } from "./personal-data";
import { suggestedDailyBudgetCents, suggestedPriceRange } from "./proposal-numbers";
import type { SaleProposal } from "./sale-proposal";

/**
 * Guardián de contenido de la IA (SEC-28). El esquema solo valida la FORMA; esto valida el
 * CONTENIDO contra los datos que confirmó el vendedor, antes de guardar o mostrar:
 *
 * - `contact` / `payment`: correos, teléfonos, ligas, usuarios, CLABE o tarjetas, e instrucciones de
 *   pago por fuera («transferencia», «depósito»…). La plataforma cobra dentro de la app.
 * - `urgency`: urgencia o escasez inventadas («últimas piezas», «solo hoy»…); principio P12.
 * - `claim`: afirmaciones que exigen un dato verificable (P4) que no está en los datos: garantía,
 *   originalidad, envío gratis, devoluciones, tiempos de entrega, descuentos…
 * - `number`: montos, piezas o días distintos de los confirmados (P2).
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

const URGENCY = phrases([
  String.raw`[uú]ltim[oa]s?\s+(?:\d+\s+)?(?:piezas?|unidades?|oportunidad|d[ií]as?|horas?|disponibles?)`,
  String.raw`(?:s[oó]lo|solamente)\s+quedan`,
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
  String.raw`(?:stock|existencias|inventario|cupo|piezas|unidades)\s+limitad[oa]s?`,
  String.raw`(?:pocas|contadas|limitadas)\s+(?:piezas|unidades|existencias)`,
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

/** Las que se revisan en la propuesta de «Vende con IA» (no conoce envíos ni entregas). */
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
};

export function withoutProductName(text: string, productName: string) {
  const name = normalizeText(productName).trim();
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, String.raw`\s+`);
  return text.replace(new RegExp(escaped, "giu"), " ");
}

/** Hallazgos de un texto según las reglas. */
export function textFindings(raw: string, rules: TextRules): Set<GuardFinding> {
  const found = new Set<GuardFinding>();
  const text = normalizeText(raw);
  const personal = findPersonalData(text);
  if (personal.includes("account")) found.add("payment");
  if (personal.some((kind) => kind !== "account")) found.add("contact");
  if (PAYMENT.test(text)) found.add("payment");
  if (URGENCY.test(text)) found.add("urgency");
  // Afirmaciones y cifras se revisan sin el nombre que confirmó el vendedor: repetir «Tenis
  // originales» no es una afirmación de la IA, y «AirPods Pro 2 disponibles» no son 2 piezas.
  const figures = withoutProductName(text, rules.productName);
  const claims = claimsIn(figures, rules.claimKinds);
  if (claims.some((kind) => !rules.allowedClaims?.has(kind))) found.add("claim");
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
  const isClean = (text: string, rules: TextRules) => {
    const found = textFindings(text, rules);
    for (const finding of found) findings.add(finding);
    return found.size === 0;
  };
  return {
    isClean,
    text(value: string, fallback: string, rules: TextRules, min = 1) {
      if (!value.trim()) return value;
      // Respeta los saltos de línea (mensajes de WhatsApp o Facebook): revisa frase por frase.
      const lines = value.split(/\n/u).map((line) => {
        const sentences = line.split(SENTENCE);
        const kept = sentences.filter((sentence) => !sentence.trim() || isClean(sentence, rules));
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

export function guardProposal(proposal: SaleProposal, facts: ProposalFacts): GuardedProposal {
  const range = suggestedPriceRange(facts.priceCents);
  const daily = suggestedDailyBudgetCents(facts);
  const allowedCents = new Set([facts.priceCents, range.minCents, range.maxCents, daily]);
  const cleaner = createCleaner();

  const name = facts.productName;
  const price = formatMoney(facts.priceCents);
  const base = {
    productName: name,
    allowedCents,
    quantity: facts.quantity,
    allowedPercents: percentsIn(facts.text, facts.productName),
  };
  const publish: TextRules = { ...base, claimKinds: PROPOSAL_CLAIMS };
  const advice: TextRules = { ...base, claimKinds: [] };

  const guarded: SaleProposal = {
    ...proposal,
    // El nombre es el que confirmó el vendedor, no el que devolvió la IA.
    productName: name,
    headline: cleaner.text(proposal.headline, `${name} a ${price}`, publish, 5),
    description: cleaner.text(
      proposal.description,
      `${name} disponible a ${price}. Escríbeme para más detalles.`,
      publish,
      20,
    ),
    valueProposition: cleaner.text(
      proposal.valueProposition,
      `${name} a ${price}, con trato directo.`,
      publish,
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
      [`${name} a ${price}. Escríbeme para apartarlo.`],
      publish,
    ),
    videoScript: cleaner.text(
      proposal.videoScript,
      `Muestra ${name} de cerca, di para qué sirve y su precio: ${price}.`,
      publish,
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
    ctas: cleaner.list(proposal.ctas, (cta) => cta, ["Compra ahora"], publish),
    assumptions: cleaner.list(
      proposal.assumptions,
      (assumption) => assumption,
      ["Usamos el precio, costo y cantidad que confirmaste."],
      advice,
    ),
  };
  return { proposal: guarded, ...cleaner.result() };
}
