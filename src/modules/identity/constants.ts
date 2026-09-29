/** Prefijo de las cookies de sesión (lo usa también `proxy.ts`). */
export const AUTH_COOKIE_PREFIX = "vendeia";

/**
 * Versiones de los documentos legales. Al cambiar un documento, sube su versión: el consentimiento
 * queda registrado contra la versión aceptada.
 */
export const LEGAL_VERSIONS = {
  // 2026-09-26: falsificaciones, comprobante de autenticidad y reportes (ADR-036).
  // 2026-09-27: señal opcional de IA en la revisión, reportar de buena fe y ocultar o restaurar
  // publicaciones (ADR-035, ADR-036).
  // 2026-09-29: estilista, «Pruébatelo» (simulación, no garantía) y saldo (ADR-043 a ADR-045).
  terms: "2026-09-29",
  // 2026-09-26: proveedor externo de IA como encargado (nombre y país pendientes antes de activarlo),
  // kit de anuncios, eventos anónimos y reglas de «Gente de tus comunidades» (ADR-030, ADR-038).
  // 2026-09-27: publicaciones que ves en pantalla (ADR-037), señal opcional de IA de autenticidad,
  // comprobantes, reportes y acciones del equipo de moderación (ADR-035, ADR-036).
  // 2026-09-29: estilista («¿Qué necesitas?», looks), foto de «Pruébatelo» (30 días, privada) y
  // saldo (ADR-043, ADR-044, ADR-045).
  privacyNotice: "2026-09-29",
  personalization: "2026-09-24",
  // Texto del ajuste «Aparecer en sugerencias». 2026-09-26: con quienes se siguen mutuamente, a quién
  // sigues cuenta como señal sin decir quién (ADR-030, SEC-17; SEC-34 pedía subirla).
  discoverability: "2026-09-26",
  // Texto del consentimiento para usar la foto de la persona en «Pruébatelo» (ADR-045).
  tryOn: "2026-09-29",
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
