import { absoluteUrl, indexingEnabled } from "@/app/seo";
import { siteConfig } from "@/config/site";
import type { ServerEnv } from "@/server/env-schema";

/** Dónde se comprueba la llave (`keyLocation`): en la raíz, así cubre todas las URLs del sitio. */
export const INDEXNOW_KEY_PATH = "/indexnow.txt";
const ENDPOINT = "https://api.indexnow.org/indexnow";
const TIMEOUT_MS = 5_000;

/**
 * IndexNow: avisa a los buscadores que lo usan (Bing, que alimenta la búsqueda de ChatGPT y Copilot,
 * Yandex, Naver…) que una página cambió, para que la vuelvan a leer pronto. Solo con la indexación
 * activa (producción en el dominio propio) y solo URLs del propio sitio. Nunca lanza: un aviso que
 * no llega no detiene una venta. Devuelve si se mandó.
 */
export async function notifyIndexNow(
  urls: readonly string[],
  {
    env,
    fetch: send = fetch,
  }: { env: Pick<ServerEnv, "APP_URL" | "ALLOW_INDEXING">; fetch?: typeof fetch },
): Promise<boolean> {
  if (!indexingEnabled(env)) return false;
  const host = new URL(siteConfig.url).host;
  const own = urls.filter((url) => new URL(url).host === host);
  if (own.length === 0) return false;
  try {
    const response = await send(ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host,
        key: siteConfig.indexNowKey,
        keyLocation: absoluteUrl(INDEXNOW_KEY_PATH),
        urlList: own,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok;
  } catch {
    return false;
  }
}
