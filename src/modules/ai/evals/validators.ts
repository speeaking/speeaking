import {
  type ClaimKind,
  claimsIn,
  hasPaymentInstructions,
  hasUrgency,
  withoutProductName,
} from "../output-guard";
import { findPersonalData, normalizeText } from "../personal-data";

/**
 * Validadores de las evaluaciones de modelos (ADR-033 #9, ADR-034). Revisan la salida CRUDA del
 * modelo, antes del guardián: el guardián la limpia en producción, pero para elegir modelo importa
 * cuánto se equivoca el modelo por sí solo. Todos son deterministas (sin IA).
 */

/** Cifra escrita en un texto: «3,499», «89.50», «15» (sin separadores de miles). */
const NUMBER = /(?<![\p{L}\p{N}])\d{1,3}(?:,\d{3})+(?:\.\d+)?|\d+(?:\.\d+)?/gu;
/** Duraciones del guion de video («0–3 s», «12 seg»): estructura, no una cifra del negocio. */
const SECONDS_AFTER = /^\s*(?:[–-]\s*\d+\s*)?(?:s|seg|segs|segundos?)(?![\p{L}])/u;

function canonical(raw: string) {
  const value = Number(raw.replace(/,/g, ""));
  return Number.isFinite(value) ? String(value) : raw;
}

/** Cifras de un texto en forma canónica («3,499.00» → «3499»). */
export function numbersIn(text: string): string[] {
  return [...normalizeText(text).matchAll(NUMBER)].map((match) => canonical(match[0]));
}

/** Conjunto de cifras permitidas: las de los datos y las que escribió el vendedor. */
export function allowedNumbers(sources: (string | number | null | undefined)[]): Set<string> {
  const allowed = new Set<string>();
  for (const source of sources) {
    if (source === null || source === undefined) continue;
    if (typeof source === "number") allowed.add(canonical(String(source)));
    else for (const value of numbersIn(source)) allowed.add(value);
  }
  return allowed;
}

/** Centavos → las formas en pesos en que puede aparecer («3499», «89.5»). */
export function pesos(cents: number) {
  return canonical((cents / 100).toFixed(2));
}

/**
 * P2: cifras que el modelo escribió y que NO están en los datos calculados por el código ni en lo
 * que escribió el vendedor. Se ignoran las del nombre del producto y las duraciones del guion.
 */
export function inventedNumbers(text: string, allowed: ReadonlySet<string>, productName: string) {
  const clean = withoutProductName(normalizeText(text), productName);
  const invented: string[] = [];
  for (const match of clean.matchAll(NUMBER)) {
    const after = clean.slice((match.index ?? 0) + match[0].length);
    if (SECONDS_AFTER.test(after)) continue;
    const value = canonical(match[0]);
    if (!allowed.has(value) && !invented.includes(value)) invented.push(value);
  }
  return invented;
}

/** P4: afirmaciones que exigen un dato verificable que el producto no tiene. */
export function unsupportedClaims(
  text: string,
  productName: string,
  allowed: ReadonlySet<ClaimKind> = new Set(),
  kinds?: readonly ClaimKind[],
): ClaimKind[] {
  const figures = withoutProductName(normalizeText(text), productName);
  return claimsIn(figures, kinds).filter((kind) => !allowed.has(kind));
}

/** Urgencia o escasez inventada (P12, sin patrones oscuros). */
export function hasDarkPattern(text: string) {
  return hasUrgency(text);
}

/** Datos de contacto o de pago por fuera. */
export function hasContactOrPayment(text: string) {
  return findPersonalData(text).length > 0 || hasPaymentInstructions(text);
}

const SPANISH = new Set(
  "de la que el en y a los se del las un por con no una su para es al lo como más tu te tus muy sin sobre este esta ya o si le porque cuando también hay para".split(
    " ",
  ),
);
const ENGLISH = new Set(
  "the and of to is for with your you this it are be that on as at from our we can will".split(" "),
);

/**
 * ¿Está en español? Heurística por palabras funcionales: al menos 3 en español y el doble que en
 * inglés. Los nombres de marca en inglés («oversize», «hoodie») no la engañan.
 */
export function isSpanish(text: string) {
  const words = normalizeText(text)
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter(Boolean);
  let spanish = 0;
  let english = 0;
  for (const word of words) {
    if (SPANISH.has(word)) spanish++;
    else if (ENGLISH.has(word)) english++;
  }
  return spanish >= 3 && spanish >= english * 2;
}
