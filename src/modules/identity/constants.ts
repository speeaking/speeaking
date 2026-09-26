/** Prefijo de las cookies de sesión (lo usa también `proxy.ts`). */
export const AUTH_COOKIE_PREFIX = "vendeia";

/**
 * Versiones de los documentos legales. Al cambiar un documento, sube su versión: el consentimiento
 * queda registrado contra la versión aceptada.
 */
export const LEGAL_VERSIONS = {
  terms: "2026-09-24",
  // 2026-09-25: «Gente de tus comunidades» y su ajuste de privacidad.
  privacyNotice: "2026-09-25",
  personalization: "2026-09-24",
  // Texto del ajuste «Aparecer en sugerencias» (sin «me gusta» como señal).
  discoverability: "2026-09-25.2",
} as const;

/** Rutas que requieren sesión (verificación optimista en `proxy.ts`; la real, en el servidor). */
export const PROTECTED_PREFIXES = [
  "/studio",
  "/crear",
  "/bienvenida",
  "/ajustes",
  "/perfil",
  "/carrito",
  "/checkout",
  "/pedidos",
  "/guardados",
] as const;
