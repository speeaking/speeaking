/**
 * ¿La dirección no sale de la máquina? Sin dependencias: la usan el esquema de variables de entorno y
 * las políticas que distinguen un build de producción en local (`pnpm start`, E2E) de un sitio
 * público.
 */

/** `localhost`, `127.x.x.x` o `[::1]`: la conexión no sale de la máquina. */
export function isLoopback(hostname: string) {
  return hostname === "localhost" || hostname === "[::1]" || /^127(\.\d{1,3}){3}$/.test(hostname);
}

/** Una URL cuyo host es loopback; `false` si no es una URL. */
export function isLoopbackUrl(value: string) {
  return URL.canParse(value) && isLoopback(new URL(value).hostname);
}
