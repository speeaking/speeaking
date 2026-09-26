import { hasPhrase, phrasePositions, wordsOf } from "./text";

/**
 * Palabras que en el comercio en línea de México suelen describir imitaciones de marca. Se buscan
 * como frases completas en el texto normalizado (`normalizeForRules`).
 *
 * - `strong`: por sí solas ya sugieren imitación («réplica», «calidad original»).
 * - `weak`: solo cuentan junto a una marca, porque tienen usos legítimos («pilas AAA», «escala
 *   1:1», «inspirado en la naturaleza»).
 *
 * `label` es lo que se muestra al vendedor y al equipo (con acentos).
 */
type Term = { label: string; phrases: readonly string[] };

const STRONG_TERMS: readonly Term[] = [
  { label: "réplica", phrases: ["replica", "replicas"] },
  { label: "clon", phrases: ["clon", "clones", "clonado", "clonados", "clonada", "clonadas"] },
  { label: "calidad espejo", phrases: ["calidad espejo", "version espejo", "replica espejo"] },
  { label: "calidad original", phrases: ["calidad original"] },
  { label: "tipo original", phrases: ["tipo original", "tipo originales"] },
  {
    label: "AAA",
    phrases: ["calidad aaa", "aaa+", "clase aaa", "grado aaa", "triple a", "calidad triple a"],
  },
  { label: "copia fiel", phrases: ["copia fiel", "copia exacta", "copia identica", "copia 1:1"] },
];

const WEAK_TERMS: readonly Term[] = [
  { label: "1:1", phrases: ["1:1"] },
  { label: "AAA", phrases: ["aaa"] },
  {
    label: "inspirado en",
    phrases: ["inspirado en", "inspirada en", "inspirados en", "inspiradas en"],
  },
  // «AirPods genéricos»: el artículo lleva el nombre de la marca pero no es de ella. «Cargador
  // genérico para iPhone» no cuenta: ahí la marca es de compatibilidad (`brands.ts`).
  { label: "genérico", phrases: ["generico", "genericos", "generica", "genericas"] },
];

/** Con estas palabras, «AAA» se refiere al tamaño de las pilas. */
const BATTERY_WORDS = ["pila", "pilas", "bateria", "baterias"];

export type KeywordMatches = { strong: string[]; weak: string[] };

/**
 * Negaciones. «100 % originales, no réplica», «no es clon», «cero réplicas», «ni copia» son frases
 * MUY comunes de vendedores honestos: contarlas como imitación le quitaría la palabra «original» a
 * quien dice la verdad. Un término no cuenta si justo antes (saltando «es», «son», «una»… y otras
 * palabras de imitación) hay una negación. «No es original, es réplica» sí cuenta: la negación va
 * antes de «original», no de «réplica».
 */
const NEGATORS = new Set(["no", "ni", "cero", "sin", "nada", "tampoco", "nunca", "jamas"]);
const FILLERS = new Set([
  "es",
  "son",
  "sea",
  "sean",
  "un",
  "una",
  "unos",
  "unas",
  "de",
  "el",
  "la",
  "los",
  "las",
]);
/**
 * Palabras de los propios términos que también se saltan: en «ni copia 1:1» o «no réplica AAA» la
 * negación alcanza a todo el grupo. «original» NO se salta: en «no es original, es réplica» la
 * negación es de «original».
 */
const TERM_WORDS = new Set([
  "replica",
  "replicas",
  "clon",
  "clones",
  "clonado",
  "clonados",
  "clonada",
  "clonadas",
  "copia",
  "copias",
  "calidad",
  "espejo",
  "fiel",
  "exacta",
  "identica",
  "aaa",
  "aaa+",
  "1:1",
  "generico",
  "genericos",
  "generica",
  "genericas",
]);
const MAX_SKIPPED = 4;

function isNegated(words: readonly string[], start: number): boolean {
  let index = start - 1;
  for (let skipped = 0; index >= 0 && skipped < MAX_SKIPPED; skipped += 1) {
    const word = words[index]!;
    if (!FILLERS.has(word) && !TERM_WORDS.has(word)) break;
    index -= 1;
  }
  return index >= 0 && NEGATORS.has(words[index]!);
}

/** ¿Aparece la frase al menos una vez sin negación? */
function hasAffirmedPhrase(words: readonly string[], phrase: string): boolean {
  return phrasePositions(words, phrase.split(" ")).some((start) => !isNegated(words, start));
}

function matches(words: readonly string[], terms: readonly Term[]) {
  return terms.flatMap((term) =>
    term.phrases.some((phrase) => hasAffirmedPhrase(words, phrase)) ? [term.label] : [],
  );
}

/** Términos de imitación encontrados (sin repetir etiquetas ni contar los negados). */
export function detectCounterfeitTerms(normalized: string): KeywordMatches {
  const words = wordsOf(normalized);
  const strong = [...new Set(matches(words, STRONG_TERMS))];
  const batteries = BATTERY_WORDS.some((word) => hasPhrase(normalized, word));
  const weak = [
    ...new Set(
      matches(words, WEAK_TERMS).filter(
        (label) => !strong.includes(label) && !(label === "AAA" && batteries),
      ),
    ),
  ];
  return { strong, weak };
}
