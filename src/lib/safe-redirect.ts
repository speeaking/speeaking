const PLACEHOLDER_ORIGIN = "http://vendeia.local";
// Una ruta que empieza con `//` o `/\` es una referencia de red: el navegador la resuelve como
// `https://otro.com`.
const NETWORK_PATH = /^\/[/\\]/;

/**
 * Devuelve una ruta interna segura para redirigir después de iniciar sesión.
 * Bloquea redirecciones abiertas (`//otro.com`, `https://…`, `/\otro.com`, `javascript:`).
 *
 * Se valida la entrada y también la salida YA normalizada (SEC-04): `new URL` resuelve los segmentos
 * `.` y `..` (también escritos `%2e`), así que `/.//otro.com` o `/a/..//otro.com` pasan el primer
 * filtro pero se normalizan a `//otro.com`.
 */
export function safeRedirectPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || !value.startsWith("/") || NETWORK_PATH.test(value)) {
    return fallback;
  }
  try {
    const url = new URL(value, PLACEHOLDER_ORIGIN);
    const path = `${url.pathname}${url.search}`;
    if (url.origin !== PLACEHOLDER_ORIGIN || NETWORK_PATH.test(path)) return fallback;
    return path;
  } catch {
    return fallback;
  }
}
