/**
 * Texto explicativo de una propuesta del analista. Por omisión es una plantilla determinista. Si se
 * inyecta un `Narrator` (un modelo de lenguaje detrás del guardián de presupuesto de IA, ADR-031), la
 * IA solo REDACTA: recibe las cifras ya calculadas por código y no puede agregar otras. Si su texto
 * trae un número que no está en los datos, trae una liga o no llega, se usa la plantilla (P2).
 */

export type NarrativeFacts = {
  title: string;
  hypothesis: string;
  expectedImpact: string;
  /** Cifras calculadas por código que el texto puede citar. */
  numbers: Record<string, number>;
};

export type Narrative = { source: "template" | "ai"; text: string; model?: string };

/**
 * Punto de integración con el proveedor de IA (`AIFeature.PLATFORM_ANALYSIS`). Debe reservar
 * presupuesto antes de llamar (guardián de IA) y devolver solo texto; `null` si no hay IA disponible.
 */
export type Narrator = (facts: NarrativeFacts) => Promise<{ text: string; model?: string } | null>;

const MAX_LENGTH = 1_200;
const NUMBER_PATTERN = /\d+(?:[.,]\d+)*/g;

export function templateNarrative(facts: NarrativeFacts): string {
  return `${facts.hypothesis} ${facts.expectedImpact}`.trim();
}

/** Formas aceptables de citar una cifra: tal cual, redondeada y como porcentaje. */
function allowedNumbers(numbers: Record<string, number>): Set<string> {
  const allowed = new Set<string>();
  for (const value of Object.values(numbers)) {
    if (!Number.isFinite(value)) continue;
    for (const candidate of [value, value * 100, Math.abs(value), Math.abs(value) * 100]) {
      for (const decimals of [0, 1, 2]) {
        allowed.add(String(Number(candidate.toFixed(decimals))));
      }
    }
  }
  return allowed;
}

function normalizeNumber(raw: string): string {
  // "1,250" → "1250"; "2,4" (coma decimal) → "2.4".
  const thousands = /^\d{1,3}(,\d{3})+$/.test(raw);
  const normalized = thousands ? raw.replace(/,/g, "") : raw.replace(",", ".");
  return String(Number(normalized));
}

/**
 * Cifras escritas con letra («veinte por ciento», «el doble», «la mitad») o en otros sistemas de
 * dígitos: la comprobación de abajo solo reconoce dígitos ASCII, así que estas se rechazan de entrada
 * (P2: la IA no puede colar una cifra que el código no calculó). «un», «una» y «uno» quedan fuera
 * porque son artículos, y «por mil» porque es la unidad de las métricas («0.8 por mil»).
 */
const SPELLED_NUMBER =
  /(?<![\p{L}\p{N}])(?:dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieci\p{L}*|veint\p{L}*|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien|ciento|\p{L}*cientos|\p{L}*cientas|quinient\p{L}*|(?<!\bpor\s+)mil|miles|mill[oó]n|millones|doble|duplic\p{L}*|triple|tripl\p{L}*|cu[aá]druple|mitad|tercio|porcentaje|por\s+ciento)(?![\p{L}\p{N}])/iu;
const NON_ASCII_DIGIT = /(?![0-9])\p{Nd}/u;
/** Promesas que el código no puede respaldar: el texto describe una hipótesis, no un resultado. */
const GUARANTEE = /garantiz|asegura(?:mos|rá|n)?(?![\p{L}\p{N}])|sin\s+duda|seguro\s+que/iu;

/** ¿El texto cita solo cifras que están en los datos, sin ligas, promesas ni caracteres de control? */
export function isGroundedNarrative(text: string, facts: NarrativeFacts): boolean {
  if (text.length === 0 || text.length > MAX_LENGTH) return false;
  if (/https?:\/\/|www\./i.test(text)) return false;
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(text)) return false;
  if (NON_ASCII_DIGIT.test(text) || SPELLED_NUMBER.test(text) || GUARANTEE.test(text)) return false;
  const allowed = allowedNumbers(facts.numbers);
  const cited = text.match(NUMBER_PATTERN) ?? [];
  return cited.every((raw) => allowed.has(normalizeNumber(raw)));
}

export async function writeNarrative(
  facts: NarrativeFacts,
  narrator?: Narrator,
): Promise<Narrative> {
  if (narrator) {
    try {
      const result = await narrator(facts);
      const text = result?.text.normalize("NFKC").trim() ?? "";
      if (result && isGroundedNarrative(text, facts)) {
        return { source: "ai", text, ...(result.model ? { model: result.model } : {}) };
      }
    } catch (error) {
      console.error("[ceo] la narrativa de IA falló; se usa la plantilla", error);
    }
  }
  return { source: "template", text: templateNarrative(facts) };
}
