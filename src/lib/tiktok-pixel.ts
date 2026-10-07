/**
 * Pixel de TikTok Ads: mide registros de las campañas. Solo se carga si `TIKTOK_PIXEL_ID` está
 * configurado (producción); la CSP lo autoriza con la misma variable (`src/lib/csp.ts`).
 *
 * Es el código base que entrega TikTok Events Manager, escrito como módulo en vez de `<script>` en
 * línea: lo ejecuta el bundle de Next (que ya lleva el nonce) y `strict-dynamic` extiende esa
 * confianza al SDK que inserta. Así no hace falta un script en línea con nonce propio.
 */

const SDK_URL = "https://analytics.tiktok.com/i18n/pixel/events.js";

/** Métodos que el SDK acepta antes de terminar de cargar: se guardan en cola y él los reproduce. */
const METHODS = [
  "page",
  "track",
  "identify",
  "instances",
  "debug",
  "on",
  "off",
  "once",
  "ready",
  "alias",
  "group",
  "enableCookie",
  "disableCookie",
  "holdConsent",
  "revokeConsent",
  "grantConsent",
] as const;

/** La cola `ttq`: un arreglo de llamadas pendientes con los métodos y el estado que lee el SDK. */
type TikTokQueue = unknown[][] & Record<string, unknown>;

declare global {
  interface Window {
    TiktokAnalyticsObject?: string;
    ttq?: TikTokQueue;
  }
}

function newQueue(): TikTokQueue {
  return [] as unknown as TikTokQueue;
}

function setAndDefer(target: TikTokQueue, method: string) {
  target[method] = (...args: unknown[]) => {
    target.push([method, ...args]);
  };
}

/** Deja lista la cola `ttq` e inserta el SDK. Llamarla más de una vez no hace nada. */
export function loadTikTokPixel(pixelId: string) {
  if (window.ttq) return;

  const ttq = newQueue();
  const instances: Record<string, TikTokQueue> = {};
  const loadedAt: Record<string, number> = {};
  const options: Record<string, unknown> = {};

  window.TiktokAnalyticsObject = "ttq";
  window.ttq = ttq;
  ttq.methods = METHODS;
  ttq.setAndDefer = setAndDefer;
  for (const method of METHODS) setAndDefer(ttq, method);
  ttq.instance = (id: string) => {
    const instance = instances[id] ?? newQueue();
    for (const method of METHODS) setAndDefer(instance, method);
    return instance;
  };
  ttq._i = instances;
  ttq._t = loadedAt;
  ttq._o = options;
  ttq.load = (id: string, loadOptions?: Record<string, unknown>) => {
    const instance = newQueue();
    instance._u = SDK_URL;
    instances[id] = instance;
    loadedAt[id] = Date.now();
    options[id] = loadOptions ?? {};

    const script = document.createElement("script");
    script.async = true;
    script.src = `${SDK_URL}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
    document.head.appendChild(script);
  };

  callTikTok("load", pixelId);
}

function callTikTok(method: string, ...args: unknown[]) {
  const queue = window.ttq;
  const fn = queue?.[method];
  if (typeof fn === "function") (fn as (...values: unknown[]) => void).apply(queue, args);
}

/** Vista de página: en la carga inicial y en cada navegación dentro de la app. */
export function trackTikTokPage() {
  callTikTok("page");
}

/** Evento estándar de TikTok (p. ej. `CompleteRegistration`). Sin pixel cargado no hace nada. */
export function trackTikTokEvent(event: string) {
  callTikTok("track", event);
}
