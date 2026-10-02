/**
 * Detección de datos de contacto y de pago en texto libre (SEC-28, SEC-29): correos, teléfonos,
 * cuentas (CLABE de 18 dígitos, tarjetas de 15–16), ligas y usuarios de redes. Sin IA: expresiones
 * regulares deterministas y probadas.
 */

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}.-]+\.[\p{L}]{2,}/giu;
/** Resto de una liga, sin la puntuación que la cierra («…/oferta.» o «…/oferta,»). */
const URL_TAIL = String.raw`(?:\S*[^\s.,;:!?)"'»])?`;
/** Ligas: con esquema, `www.`, acortadores y `wa.me`, o un dominio con TLD común. */
const URL = new RegExp(
  String.raw`\b(?:https?:\/\/|www\.)${URL_TAIL}|\b(?:wa\.me|bit\.ly|t\.me|m\.me)\/${URL_TAIL}|\b[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:com|mx|net|org|me|ly|link|shop|store|app|io)(?:\.mx)?(?:\/${URL_TAIL})?\b`,
  "giu",
);
/** «@usuario» suelto (no un correo: ese ya se detecta antes); no termina en punto. */
const HANDLE = /(?<![\p{L}\p{N}._%+-])@[a-z0-9_](?:[a-z0-9_.]{1,28}[a-z0-9_])?/giu;
/**
 * Corridas de dígitos con separadores de teléfono o cuenta (espacios, guiones, puntos, paréntesis y
 * `+`). Los montos con comas ($3,499) no forman corridas largas: la coma no es separador aquí.
 */
const DIGIT_RUN = /\+?\(?\d[\d\s().-]*\d/g;

/** Dígitos a partir de los cuales una corrida es un teléfono (8: fijo local sin lada). */
const PHONE_MIN_DIGITS = 8;
/** 15 (Amex) a 18 (CLABE) dígitos: tarjeta o cuenta bancaria. */
const ACCOUNT_MIN_DIGITS = 15;

export type PersonalDataKind = "email" | "url" | "handle" | "phone" | "account";

/**
 * Forma canónica antes de revisar: dígitos y letras de ancho completo a los normales (NFKC; «５５»
 * no es `\d`) y sin caracteres invisibles que partirían un teléfono, una CLABE o una palabra.
 */
export function normalizeText(text: string) {
  return text.normalize("NFKC").replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/gu, "");
}

function digitCount(text: string) {
  return text.replace(/\D/g, "").length;
}

/** Tipos de datos de contacto o pago que aparecen en el texto (sin repetir). */
export function findPersonalData(raw: string): PersonalDataKind[] {
  const found = new Set<PersonalDataKind>();
  const text = normalizeText(raw);
  const withoutEmails = text.replace(EMAIL, () => {
    found.add("email");
    return " ";
  });
  const withoutUrls = withoutEmails.replace(URL, () => {
    found.add("url");
    return " ";
  });
  if (HANDLE.test(withoutUrls)) found.add("handle");
  HANDLE.lastIndex = 0;
  for (const [run] of withoutUrls.matchAll(DIGIT_RUN)) {
    const digits = digitCount(run);
    if (digits >= ACCOUNT_MIN_DIGITS) found.add("account");
    else if (digits >= PHONE_MIN_DIGITS) found.add("phone");
  }
  return [...found];
}

/** Marcas con que se redacta el texto libre: las de aquí y la del costo (`withoutCostMentions`). */
export type RedactionMarker = "costo" | "correo" | "liga" | "usuario" | "cuenta" | "teléfono";

/**
 * Una marca de redacción, aunque el modelo la copie con otras mayúsculas, sin acento o con algo más
 * dentro («[Telefono]», «[ costo por pieza ]»). No incluye el «[PRECIO]» del kit de anuncios.
 */
const MARKER = /\[\s*(costo|correo|liga|usuario|cuenta|tel[eé]fono)[^\]\n]{0,20}\]/giu;

/**
 * Marcas de redacción que aparecen en un texto (sin repetir, en orden de aparición). Ningún texto que
 * se publique o se muestre puede llevarlas: delatan que había un dato oculto (SEC-28, H3).
 */
export function redactionMarkersIn(text: string): RedactionMarker[] {
  const found = new Set<RedactionMarker>();
  for (const match of normalizeText(text).matchAll(MARKER)) {
    const word = match[1]!.toLowerCase();
    found.add(word.startsWith("tel") ? "teléfono" : (word as RedactionMarker));
  }
  return [...found];
}

/** Dónde empieza la primera marca de redacción de un texto ya normalizado (−1 si no hay). */
export function redactionMarkerIndex(text: string): number {
  return text.search(MARKER);
}

/**
 * Reemplaza correos, ligas, usuarios, teléfonos y cuentas por una marca («[correo]», «[teléfono]»…).
 * Para guardar texto libre sin datos personales (registro de IA, SEC-29). Lo que va al modelo además
 * quita las cláusulas marcadas (`sellerTextForModel`): una marca a la vista invita a copiarla.
 */
export function redactPersonalData(text: string): string {
  return normalizeText(text)
    .replace(EMAIL, "[correo]")
    .replace(URL, "[liga]")
    .replace(HANDLE, "[usuario]")
    .replace(DIGIT_RUN, (run) => {
      const digits = digitCount(run);
      if (digits >= ACCOUNT_MIN_DIGITS) return "[cuenta]";
      if (digits >= PHONE_MIN_DIGITS) return "[teléfono]";
      return run;
    });
}
