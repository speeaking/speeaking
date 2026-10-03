/**
 * Content-Security-Policy de las páginas HTML (SEC-06, ADR-029). La aplica `src/proxy.ts` con un
 * nonce por petición; Next lee el nonce de la cabecera CSP de la PETICIÓN y lo pone en sus propios
 * scripts, y el layout raíz lo lee de `NONCE_HEADER` para el script del tema y los de Base UI.
 */

/** Cabecera interna con el nonce de la petición. La escribe solo el proxy (pisa la del cliente). */
export const NONCE_HEADER = "x-nonce";

/**
 * Origen del bucket de videos para la CSP (ADR-062): el de `S3_ENDPOINT` con `STORAGE_DRIVER=s3`;
 * `null` con el disco local (todo pasa por la app) o si el valor no es una URL web.
 */
export function storageOrigin(driver: string | undefined, endpoint: string | undefined) {
  if (driver !== "s3" || !endpoint) return null;
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" || url.protocol === "http:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** 128 bits aleatorios en base64: impredecible y distinto en cada petición. */
export function createNonce(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return btoa(String.fromCharCode(...bytes));
}

/**
 * La política.
 *
 * - `script-src`: solo scripts con el nonce y los que ellos carguen (`strict-dynamic`); `'self'`
 *   queda de respaldo para navegadores sin CSP 3. Nunca `unsafe-inline`. En desarrollo React
 *   necesita `unsafe-eval` para reconstruir las pilas de error del servidor.
 * - `style-src 'unsafe-inline'`: el HTML trae atributos `style` (el `--hue` de cada comunidad, las
 *   proporciones de las fotos, el desenfoque de carga) y sonner inyecta su `<style>` sin nonce. Un
 *   nonce aquí apagaría `unsafe-inline` y rompería todo eso. Riesgo aceptado (ADR-029): el CSS
 *   inyectado no ejecuta código.
 * - Imágenes, fuentes y conexiones solo del propio origen: `/media` sirve las fotos, `next/font`
 *   aloja las fuentes y no hay servicios de terceros. Agregar uno (pagos, analítica) es cambiar
 *   esta función y su prueba.
 * - Videos (ADR-062): con el bucket, el navegador sube el archivo directo a él (`connect-src`) y lo
 *   reproduce desde una URL firmada a la que `/media` redirige (`media-src`). Solo ese origen;
 *   `blob:` es la vista previa local del video elegido.
 */
export function contentSecurityPolicy(
  nonce: string,
  {
    isDev,
    isHttps,
    storageOrigin = null,
    googleOAuthEnabled = false,
  }: {
    isDev: boolean;
    isHttps: boolean;
    storageOrigin?: string | null;
    googleOAuthEnabled?: boolean;
  },
): string {
  const storage = storageOrigin ? ` ${storageOrigin}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    `media-src 'self' blob:${storage}`,
    "font-src 'self'",
    `connect-src 'self'${storage}`,
    "object-src 'none'",
    "base-uri 'none'",
    // Chrome aplica form-action también a la redirección del formulario de OAuth.
    // Se autoriza únicamente el origen de Google y solo cuando el proveedor está configurado.
    `form-action 'self'${googleOAuthEnabled ? " https://accounts.google.com" : ""}`,
    "frame-ancestors 'none'",
    // Solo si el sitio se sirve por https: en http (desarrollo, `next start` de las pruebas en CI)
    // subiría las peticiones a https y nada cargaría.
    ...(isHttps ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
}
