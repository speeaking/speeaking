/**
 * Direcciones de un aviso de derechos (ADR-076). Quien avisa pega una por renglón; se guardan tal
 * como las escribió (`RightsNotice.urls`) y las que apuntan a speeaking se resuelven a su contenido
 * (`RightsNoticeTarget`). Código puro: la base solo busca lo que este archivo reconoce.
 */
export const MAX_NOTICE_URLS = 20;
export const MAX_URL_LENGTH = 2000;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SLUG = /^[a-z0-9][a-z0-9-]{0,190}$/i;
const USERNAME = /^[a-z0-9](?:[a-z0-9._]{1,28}[a-z0-9])$/;
const STORAGE_KEY = /^[A-Za-z0-9_-][A-Za-z0-9._/-]{0,400}$/;

/** Contenido de speeaking al que apunta una dirección (todavía sin buscarlo en la base). */
export type SiteRef =
  | { kind: "POST"; postId: string }
  | { kind: "PRODUCT"; slug: string }
  | { kind: "USER"; username: string }
  /** Una foto o video (`/media/<clave>`): cuenta lo que la usa (publicación, producto o perfil). */
  | { kind: "MEDIA"; storageKey: string };

/** Separa los renglones, quita espacios, vacíos y repetidos (sin validar). */
export function splitUrlLines(text: string): string[] {
  return [
    ...new Set(
      text
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean),
    ),
  ];
}

/** Dirección escrita a mano: sin esquema se asume https. `null` si no es http(s) o no se entiende. */
export function normalizeUrl(raw: string): URL | null {
  const value = raw.trim();
  if (!value || value.length > MAX_URL_LENGTH || /\s/.test(value)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(value) ? value : `https://${value}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") && url.hostname !== "localhost") return null;
    return url;
  } catch {
    return null;
  }
}

/** Dominios que cuentan como speeaking (con y sin `www.`) a partir de sus orígenes. */
export function siteHosts(origins: readonly string[]): string[] {
  const hosts = new Set<string>();
  for (const origin of origins) {
    try {
      const host = new URL(origin).host.toLowerCase();
      hosts.add(host);
      hosts.add(host.startsWith("www.") ? host.slice(4) : `www.${host}`);
    } catch {
      // Un origen mal escrito no agrega nada.
    }
  }
  return [...hosts];
}

/**
 * Dirección para prellenar el aviso cuando se llega desde «Reportar» (`?url=`): solo si es de
 * speeaking, para no prellenarlo con enlaces ajenos. `undefined` si falta, es de otro sitio o no se
 * entiende.
 */
export function sameSiteUrl(
  raw: string | undefined,
  origins: readonly string[],
): string | undefined {
  if (!raw) return undefined;
  const url = normalizeUrl(raw);
  return url && siteHosts(origins).includes(url.host.toLowerCase()) ? url.href : undefined;
}

function decodeSegment(segment: string): string | null {
  try {
    return decodeURIComponent(segment);
  } catch {
    return null;
  }
}

/** A qué contenido de speeaking apunta `url`; `null` si es de otro sitio o de otra página. */
export function siteRefFromUrl(url: URL, hosts: readonly string[]): SiteRef | null {
  if (!hosts.includes(url.host.toLowerCase())) return null;
  const segments = url.pathname.split("/").filter(Boolean);
  const [section, first, ...rest] = segments;
  if (!section || !first) return null;
  const value = decodeSegment(first);
  if (value === null) return null;
  switch (section) {
    case "p":
      return UUID.test(value) ? { kind: "POST", postId: value.toLowerCase() } : null;
    case "producto":
      return SLUG.test(value) ? { kind: "PRODUCT", slug: value.toLowerCase() } : null;
    case "u": {
      const username = value.replace(/^@/, "").toLowerCase();
      return USERNAME.test(username) ? { kind: "USER", username } : null;
    }
    case "media": {
      const parts = [value, ...rest.map(decodeSegment)];
      if (parts.some((part) => part === null || part === "." || part === "..")) return null;
      const storageKey = parts.join("/");
      return STORAGE_KEY.test(storageKey) ? { kind: "MEDIA", storageKey } : null;
    }
    default:
      return null;
  }
}
