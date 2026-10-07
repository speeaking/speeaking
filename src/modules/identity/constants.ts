/** Prefijo de las cookies de sesión (lo usa también `proxy.ts`). */
export const AUTH_COOKIE_PREFIX = "speeaking";

/**
 * Versiones de los documentos legales. Al cambiar un documento, sube su versión: el consentimiento
 * queda registrado contra la versión aceptada.
 */
export const LEGAL_VERSIONS = {
  // 2026-09-26: falsificaciones, comprobante de autenticidad y reportes (ADR-036).
  // 2026-09-27: señal opcional de IA en la revisión, reportar de buena fe y ocultar o restaurar
  // publicaciones (ADR-035, ADR-036).
  // 2026-09-29: estilista, «Pruébatelo» (simulación, no garantía) y saldo (ADR-043 a ADR-045).
  // 2026-09-30: quien vende paga las simulaciones, saldo solo de tiendas y destacados «Patrocinado»
  // (ADR-046).
  // 2026-10-01: colaboraciones con tiendas (ADR-063) y cuentas editoriales con textos redactados con
  // ayuda de IA y aprobados por el equipo (ADR-066). El mismo día, antes del lanzamiento y sin
  // personas reales que la hubieran aceptado: las recargas se habilitan con un medio de pago real
  // (ADR-071).
  // 2026-10-07: la página por fin dice lo que anotó la versión 2026-09-30 (su texto no había
  // cambiado): «Pruébatelo» lo paga la tienda o la plataforma, nunca quien compra (ADR-046).
  terms: "2026-10-07",
  // 2026-09-26: proveedor externo de IA como encargado (nombre y país pendientes antes de activarlo),
  // kit de anuncios, eventos anónimos y reglas de «Gente de tus comunidades» (ADR-030, ADR-038).
  // 2026-09-27: publicaciones que ves en pantalla (ADR-037), señal opcional de IA de autenticidad,
  // comprobantes, reportes y acciones del equipo de moderación (ADR-035, ADR-036).
  // 2026-09-29: estilista («¿Qué necesitas?», looks), foto de «Pruébatelo» (30 días, privada) y
  // saldo (ADR-043, ADR-044, ADR-045).
  // 2026-09-30: saldo solo de tiendas y registro agregado de la demanda de simulaciones (ADR-046).
  // 2026-10-01: «Contexto» (ADR-060), buscar con una foto (ADR-061), videos sin ubicación (ADR-062)
  // y colaboraciones con tiendas (ADR-063).
  // 2026-10-06: medición de anuncios con el pixel de TikTok, solo con permiso (ADR-072).
  // 2026-10-07: «Entrar con Google» con Google LLC (EE. UU.) como encargado; el botón ya estaba
  // activo en producción sin nombrarlo (ADR-049, docs/deploy.md 6 bis.0).
  privacyNotice: "2026-10-07",
  personalization: "2026-09-24",
  // Texto del ajuste «Aparecer en sugerencias». 2026-09-26: con quienes se siguen mutuamente, a quién
  // sigues cuenta como señal sin decir quién (ADR-030, SEC-17; SEC-34 pedía subirla).
  discoverability: "2026-09-26",
  // Texto del consentimiento para usar la foto de la persona en «Pruébatelo» (ADR-045).
  // 2026-10-01: el nombre de la plataforma pasa a speeaking (ADR-070).
  tryOn: "2026-10-01",
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
  "/mensajes",
] as const;
