import { foldText } from "@/modules/search/normalize";

/**
 * Texto normalizado para las reglas de autenticidad: minúsculas, sin acentos (la misma tabla que la
 * búsqueda) y solo letras, números y los signos que forman términos («1:1», «aaa+», «p/»). Las
 * palabras quedan separadas por un espacio y el texto va rodeado de espacios, así una frase se busca
 * completa con `includes(" frase ")` y nunca dentro de otra palabra («clonar» no es «clon»).
 */
export function normalizeForRules(text: string): string {
  const words = foldText(text)
    .replace(/[^a-z0-9:+/]+/g, " ")
    .trim();
  return words ? ` ${words} ` : " ";
}

/** ¿Aparece la frase (ya normalizada) como palabras completas? */
export function hasPhrase(normalized: string, phrase: string): boolean {
  return normalized.includes(` ${phrase} `);
}

/** Posiciones (en palabras) donde empieza la frase. */
export function phrasePositions(words: readonly string[], phrase: readonly string[]): number[] {
  const positions: number[] = [];
  if (phrase.length === 0) return positions;
  for (let index = 0; index + phrase.length <= words.length; index += 1) {
    if (phrase.every((word, offset) => words[index + offset] === word)) positions.push(index);
  }
  return positions;
}

/** Palabras del texto normalizado. */
export function wordsOf(normalized: string): string[] {
  const trimmed = normalized.trim();
  return trimmed ? trimmed.split(" ") : [];
}
