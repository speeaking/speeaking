/**
 * Medición de anuncios (pixel de TikTok, ADR-072). Reglas puras, sin navegador ni servidor:
 *
 * - Solo con permiso de quien visita (cookie propia `speeaking_anuncios`): sin decidir o con «no»,
 *   no se carga nada.
 * - Solo en páginas públicas, el registro y la bienvenida. Con sesión, únicamente la bienvenida
 *   (ahí se mide el registro recién hecho): nunca el feed, mensajes, pedidos ni perfiles.
 */

export const AD_CONSENT_COOKIE = "speeaking_anuncios";
const ONE_YEAR_SECONDS = 365 * 24 * 60 * 60;

/** Páginas públicas con pixel (exactas o con subrutas: `/comprar/decoracion`, `/producto/x`). */
const PUBLIC_PIXEL_PATHS = [
  "/comprar",
  "/producto",
  "/descubrir",
  "/creadores",
  "/precios",
  "/seguridad",
  "/apoya",
  "/como-funciona",
  "/preguntas-frecuentes",
  "/registro",
] as const;
/** La bienvenida: a ella llega quien acaba de crear su cuenta (con correo o con Google). */
const WELCOME_PATH = "/bienvenida";

export type AdConsent = "granted" | "denied";

export function pixelAllowedOn(pathname: string, { signedIn }: { signedIn: boolean }) {
  if (pathname === WELCOME_PATH) return true;
  if (signedIn) return false;
  if (pathname === "/") return true;
  return PUBLIC_PIXEL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function parseAdConsent(value: string | undefined | null): AdConsent | null {
  if (value === "si") return "granted";
  if (value === "no") return "denied";
  return null;
}

/** Valor para `document.cookie`: la decisión dura un año en todo el sitio. */
export function adConsentCookie(granted: boolean, { https }: { https: boolean }) {
  return `${AD_CONSENT_COOKIE}=${granted ? "si" : "no"}; Max-Age=${ONE_YEAR_SECONDS}; Path=/; SameSite=Lax${https ? "; Secure" : ""}`;
}

/** El ID del pixel con su forma (va dentro de una URL de TikTok): letras mayúsculas y cifras. */
const PIXEL_ID = /^[A-Z0-9]{10,40}$/;

/**
 * El pixel configurado (`TIKTOK_PIXEL_ID`), o `null`. Nunca en las vistas previas de Vercel: ahí
 * no hay campaña que medir y se mezclarían visitas de prueba.
 */
export function tiktokPixelId(env: {
  TIKTOK_PIXEL_ID?: string | undefined;
  VERCEL_ENV?: string | undefined;
}): string | null {
  const id = env.TIKTOK_PIXEL_ID?.trim();
  if (!id || !PIXEL_ID.test(id) || env.VERCEL_ENV === "preview") return null;
  return id;
}
