import { findPersonalData } from "@/modules/ai/personal-data";

/**
 * Limpieza del texto que redacta la IA antes de guardarlo como borrador (ADR-066). Código puro: el
 * modelo escribe, el código decide qué se queda (P2). Lo que no pasa se quita por oraciones; si no
 * queda nada útil, no hay borrador.
 */

/** Largo de una publicación editorial: corta, para leerse de un vistazo en el feed. */
export const DRAFT_MAX_CHARS = 600;
export const DRAFT_MIN_CHARS = 30;

/** Montos y porcentajes: la IA no tiene datos que citar, así que una cifra así es inventada (P4). */
const FIGURES = /\$\s?\d|\d[\d.,]*\s?(?:%|por ciento|pesos|mxn|usd|d[oó]lares)/iu;

/** Comillas que envuelven todo el texto («…», "…", “…”). */
const WRAPPING_QUOTES = /^["«“']([\s\S]*)["»”']$/u;

function sentences(paragraph: string): string[] {
  return paragraph
    .split(/(?<=[.!?…])\s+/u)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

/**
 * Deja el texto como una publicación de la red: sin Markdown, sin hashtags, sin ligas ni datos de
 * contacto, sin cifras de dinero o porcentajes y dentro del largo. Vacío si queda demasiado corto.
 */
export function cleanDraftBody(raw: string): string {
  const plain = raw
    .replace(/\r\n?/g, "\n")
    .trim()
    .replace(WRAPPING_QUOTES, "$1")
    .replace(/[*_]{2,}/g, "")
    .replace(/^\s{0,3}#{1,6}\s+/gmu, "")
    .replace(/^\s*[-*•]\s+/gmu, "")
    .replace(/(^|\s)#[\p{L}\p{N}_]+/gu, "$1")
    .replace(/[ \t]+/g, " ");

  const paragraphs = plain
    .split(/\n+/)
    .map((paragraph) =>
      sentences(paragraph).filter(
        (sentence) => findPersonalData(sentence).length === 0 && !FIGURES.test(sentence),
      ),
    )
    .filter((kept) => kept.length > 0);

  const join = (body: string, paragraph: string) => (body ? `${body}\n\n${paragraph}` : paragraph);
  let body = "";
  // Oración por oración hasta el largo máximo: nunca se corta una a la mitad.
  fill: for (const kept of paragraphs) {
    let paragraph = "";
    for (const sentence of kept) {
      const candidate = paragraph ? `${paragraph} ${sentence}` : sentence;
      if (join(body, candidate).length > DRAFT_MAX_CHARS) {
        if (paragraph) body = join(body, paragraph);
        break fill;
      }
      paragraph = candidate;
    }
    body = join(body, paragraph);
  }
  return body.length >= DRAFT_MIN_CHARS ? body : "";
}

/** Forma para comparar dos textos sin fijarse en mayúsculas, acentos, signos ni emojis. */
export function comparableText(text: string): string {
  return text
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}
