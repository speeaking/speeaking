import { formatMoney } from "@/lib/format";
import { findPersonalData, normalizeText } from "./personal-data";
import { suggestedDailyBudgetCents, suggestedPriceRange } from "./proposal-numbers";
import type { SaleProposal } from "./sale-proposal";

/**
 * Guardián de contenido de "Vende con IA" (SEC-28). El esquema solo valida la FORMA; esto valida el
 * CONTENIDO contra lo que confirmó el vendedor, antes de guardar o mostrar la propuesta:
 *
 * - `contact` / `payment`: correos, teléfonos, ligas, usuarios, CLABE o tarjetas, e instrucciones de
 *   pago por fuera («transferencia», «depósito»…). La plataforma cobra dentro de la app.
 * - `urgency`: urgencia o escasez inventadas («últimas piezas», «solo hoy»…); principio P12.
 * - `claim`: afirmaciones que exigen un dato verificable (P4) que la propuesta no tiene: garantía,
 *   originalidad, envío gratis, devoluciones, tiempos de entrega, descuentos.
 * - `number`: montos o piezas distintos de los confirmados (P2).
 *
 * Una frase (o un elemento de lista) con cualquiera de esos hallazgos se quita entera; si un campo se
 * queda vacío, se usa un texto determinista con los datos del vendedor. Las «afirmaciones» solo se
 * revisan en lo publicable (título, descripción, anuncios, guion, llamados); en los consejos para el
 * vendedor («¿Tienen garantía?» → «Indica los días que ofreces») hablar de garantía es legítimo.
 */

export type GuardFinding = "contact" | "payment" | "urgency" | "claim" | "number";

/** Datos confirmados por el vendedor contra los que se revisa la salida. */
export type ProposalFacts = {
  productName: string;
  priceCents: number;
  costCents: number;
  quantity: number;
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

const CLAIM = phrases([
  "garant[ií]as?",
  "garantizad[oa]s?",
  "originale?s?",
  "aut[eé]ntic[oa]s?",
  "genuin[oa]s?",
  String.raw`env[ií]os?\s+(?:gratis|gratuitos?|sin\s+costo|incluidos?)`,
  String.raw`gratis\s+el\s+env[ií]o`,
  String.raw`entrega\s+(?:inmediata|expr[eé]ss?|al\s+d[ií]a\s+siguiente)`,
  String.raw`llega\s+(?:ma[nñ]ana|hoy|el\s+mismo\s+d[ií]a)`,
  "devoluci[oó]n(?:es)?",
  "reembolsos?",
  String.raw`entrega\s+(?:el\s+)?mismo\s+d[ií]a`,
  String.raw`en\s+(?:menos\s+de\s+)?\d+\s*(?:h|horas?|d[ií]as?(?:\s+h[aá]biles)?)`,
  "descuentos?",
  String.raw`\d+\s*%\s*(?:off|menos)`,
  // Promociones y financiamiento que la plataforma no ofrece: 2x1, meses sin intereses.
  String.raw`[23]\s*[x×]\s*[12]`,
  String.raw`meses\s+sin\s+intereses`,
  "msi",
  "factura",
  "certificad[oa]s?",
  "sellad[oa]s?",
]);

const MONEY =
  /\$\s?(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?|\b(\d{1,3}(?:,\d{3})+|\d+)(?:\.(\d{1,2}))?\s?(?:pesos|mxn)\b/giu;
const PIECES = /\b(\d{1,6})\s+(?:piezas?|unidades?|pzas?\.?|disponibles)\b/giu;
/** Montos en otra moneda: el precio del vendedor es en pesos, así que ninguno cuadra (P2). */
const FOREIGN_MONEY =
  /(?<![\p{L}\p{N}])(?:us\$|usd|eur|€)\s?\d|\d\s?(?:d[oó]lares|usd|dlls?|euros?|eur)(?![\p{L}\p{N}])/iu;

function toCents(integer: string, decimals: string | undefined) {
  return Number(integer.replace(/,/g, "")) * 100 + Number((decimals ?? "0").padEnd(2, "0"));
}

type Checks = { claims: boolean };

function withoutProductName(text: string, productName: string) {
  const name = normalizeText(productName).trim();
  if (!name) return text;
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, String.raw`\s+`);
  return text.replace(new RegExp(escaped, "giu"), " ");
}

function findingsOf(raw: string, facts: ProposalFacts, allowedCents: Set<number>, checks: Checks) {
  const found = new Set<GuardFinding>();
  const text = normalizeText(raw);
  const personal = findPersonalData(text);
  if (personal.includes("account")) found.add("payment");
  if (personal.some((kind) => kind !== "account")) found.add("contact");
  if (PAYMENT.test(text)) found.add("payment");
  if (URGENCY.test(text)) found.add("urgency");
  // Afirmaciones y cifras se revisan sin el nombre que confirmó el vendedor: repetir «Tenis
  // originales» no es una afirmación de la IA, y «AirPods Pro 2 disponibles» no son 2 piezas.
  const figures = withoutProductName(text, facts.productName);
  if (checks.claims && CLAIM.test(figures)) found.add("claim");
  for (const match of figures.matchAll(MONEY)) {
    const cents = match[1] ? toCents(match[1], match[2]) : toCents(match[3]!, match[4]);
    if (!allowedCents.has(cents)) found.add("number");
  }
  for (const match of figures.matchAll(PIECES)) {
    if (Number(match[1]) !== facts.quantity) found.add("number");
  }
  if (FOREIGN_MONEY.test(figures)) found.add("number");
  return found;
}

const SENTENCE = /(?<=[.!?…])\s+/u;

export function guardProposal(proposal: SaleProposal, facts: ProposalFacts): GuardedProposal {
  const range = suggestedPriceRange(facts.priceCents);
  const daily = suggestedDailyBudgetCents(facts);
  const allowedCents = new Set([facts.priceCents, range.minCents, range.maxCents, daily]);
  const findings = new Set<GuardFinding>();
  let removed = 0;

  const isClean = (text: string, checks: Checks) => {
    const found = findingsOf(text, facts, allowedCents, checks);
    for (const finding of found) findings.add(finding);
    return found.size === 0;
  };
  /**
   * Quita las frases con hallazgos; si lo que queda es más corto que `min` (el mínimo del esquema),
   * usa `fallback`.
   */
  const text = (value: string, fallback: string, { claims = true, min = 1 } = {}) => {
    if (!value.trim()) return value;
    const sentences = value.split(SENTENCE);
    const kept = sentences.filter((sentence) => isClean(sentence, { claims }));
    removed += sentences.length - kept.length;
    const joined = kept.join(" ").trim();
    return joined.length >= min ? joined : fallback;
  };
  /** Quita los elementos con hallazgos; si no queda ninguno, `fallback`. */
  const list = <T>(items: T[], toText: (item: T) => string, fallback: T[], checks: Checks) => {
    const kept = items.filter((item) => isClean(toText(item), checks));
    removed += items.length - kept.length;
    return kept.length > 0 ? kept : fallback;
  };

  const name = facts.productName;
  const price = formatMoney(facts.priceCents);
  const publish: Checks = { claims: true };
  const advice: Checks = { claims: false };

  const guarded: SaleProposal = {
    ...proposal,
    // El nombre es el que confirmó el vendedor, no el que devolvió la IA.
    productName: name,
    headline: text(proposal.headline, `${name} a ${price}`, { min: 5 }),
    description: text(
      proposal.description,
      `${name} disponible a ${price}. Escríbeme para más detalles.`,
      { min: 20 },
    ),
    valueProposition: text(proposal.valueProposition, `${name} a ${price}, con trato directo.`, {
      min: 10,
    }),
    tags: list(proposal.tags, (tag) => tag, [], publish),
    targetAudiences: list(
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
    contentIdeas: list(
      proposal.contentIdeas,
      (idea) => idea,
      [`Foto de ${name} en uso real, con luz natural.`],
      publish,
    ),
    adIdeas: list(
      proposal.adIdeas,
      (ad) => ad,
      [`${name} a ${price}. Escríbeme para apartarlo.`],
      publish,
    ),
    videoScript: text(
      proposal.videoScript,
      `Muestra ${name} de cerca, di para qué sirve y su precio: ${price}.`,
    ),
    suggestedPriceRange: {
      ...range,
      rationale: text(proposal.suggestedPriceRange.rationale, "", advice),
    },
    suggestedDailyBudgetCents: daily,
    budgetRationale: text(proposal.budgetRationale, "", advice),
    objections: list(
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
    ctas: list(proposal.ctas, (cta) => cta, ["Compra ahora"], publish),
    assumptions: list(
      proposal.assumptions,
      (assumption) => assumption,
      ["Usamos el precio, costo y cantidad que confirmaste."],
      advice,
    ),
  };
  return { proposal: guarded, removed, findings: [...findings] };
}
