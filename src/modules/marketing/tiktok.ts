import {
  type AdConsent,
  AD_CONSENT_COOKIE,
  adConsentCookie,
  parseAdConsent,
  pixelAllowedOn,
} from "./ad-pixel";
import { installNavigationGuard } from "./navigation-guard";

/**
 * Pixel de TikTok en el navegador (ADR-072). Es el código base de TikTok escrito en TypeScript: crea
 * la cola `window.ttq` y agrega su script. Como lo agrega nuestro propio código, el CSP lo autoriza
 * por `strict-dynamic`, sin scripts en línea. Usa el modo de consentimiento de TikTok
 * (`holdConsent` / `grantConsent` / `revokeConsent`). Antes de agregar su script se instala el
 * guardián de navegación (`navigation-guard.ts`): con TikTok cargado, ir a una página donde el pixel
 * no va es siempre una carga completa, así TikTok nunca ve una página privada.
 */

const EVENTS_URL = "https://analytics.tiktok.com/i18n/pixel/events.js";
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
/** El registro ya se midió en este navegador. */
const REGISTRATION_SENT = "speeaking_registro_medido";

type Method = (typeof METHODS)[number];
type TikTokQueue = unknown[] & { [method in Method]: (...args: unknown[]) => void } & {
  methods: readonly string[];
  _i?: Record<string, unknown[] & { _u?: string }>;
  _t?: Record<string, number>;
  _o?: Record<string, unknown>;
  instance: (id: string) => unknown[];
  load: (id: string) => void;
};

declare global {
  interface Window {
    ttq?: TikTokQueue;
    TiktokAnalyticsObject?: string;
  }
}

/** ¿Tiene permiso el pixel ahora mismo (página pública con «sí»)? */
let granted = false;
/** La sesión de la página actual (la bienvenida cuenta como sesión): la usa el guardián. */
let signedIn = false;
/** Se registró una cuenta antes de que el pixel tuviera permiso (aceptó en la bienvenida). */
let registrationPending = false;

function defer(target: unknown[], method: string) {
  (target as unknown as Record<string, unknown>)[method] = (...args: unknown[]) => {
    target.push([method, ...args]);
  };
}

/** El código base de TikTok: la cola y su script, una sola vez por página. */
function install(pixelId: string): TikTokQueue {
  const existing = window.ttq;
  if (existing?._i?.[pixelId]) return existing;
  window.TiktokAnalyticsObject = "ttq";
  const queue = (existing ?? []) as TikTokQueue;
  window.ttq = queue;
  queue.methods = METHODS;
  for (const method of METHODS) defer(queue, method);
  queue.instance = (id: string) => {
    const instance = queue._i?.[id] ?? [];
    for (const method of METHODS) defer(instance, method);
    return instance;
  };
  queue.load = (id: string) => {
    queue._i = queue._i ?? {};
    queue._i[id] = Object.assign([], { _u: EVENTS_URL });
    queue._t = { ...queue._t, [id]: Date.now() };
    queue._o = { ...queue._o, [id]: {} };
    const script = document.createElement("script");
    script.async = true;
    script.src = `${EVENTS_URL}?sdkid=${encodeURIComponent(id)}&lib=ttq`;
    const first = document.getElementsByTagName("script")[0];
    if (first?.parentNode) first.parentNode.insertBefore(script, first);
    else document.head.append(script);
  };
  granted = false;
  installNavigationGuard({
    allowed: (pathname) => pixelAllowedOn(pathname, { signedIn }),
    navigate: (url, how) => {
      if (how === "reload") window.location.reload();
      else window.location.assign(url);
    },
  });
  queue.holdConsent();
  queue.load(pixelId);
  return queue;
}

/**
 * En una página pública con permiso: carga (si hace falta), da el permiso y cuenta la página.
 * `withSession`: hay sesión en esta página (en la bienvenida siempre la hay).
 */
export function activateTikTokPixel(pixelId: string, { withSession }: { withSession: boolean }) {
  signedIn = withSession;
  const queue = install(pixelId);
  if (!granted) {
    queue.grantConsent();
    granted = true;
  }
  queue.page();
  if (registrationPending) sendRegistration(queue);
}

/** Fuera de las páginas públicas o sin permiso: si ya estaba cargado, se retira el permiso. */
export function deactivateTikTokPixel() {
  if (granted && window.ttq) window.ttq.revokeConsent();
  granted = false;
}

function sendRegistration(queue: TikTokQueue) {
  registrationPending = false;
  queue.track("CompleteRegistration");
  try {
    localStorage.setItem(REGISTRATION_SENT, "1");
  } catch {
    // Sin almacenamiento local: puede repetirse en otra visita, nunca en esta.
  }
}

/** El registro completo, una vez por navegador. Sin permiso todavía, espera a que lo dé. */
export function trackRegistrationOnce() {
  try {
    if (localStorage.getItem(REGISTRATION_SENT)) return;
  } catch {
    // Sin almacenamiento local se manda igual.
  }
  if (granted && window.ttq) sendRegistration(window.ttq);
  else registrationPending = true;
}

/** Cookies que deja el pixel en nuestro dominio (`_ttp`, `ttcsid`…): se borran al decir «no». */
function clearTikTokCookies() {
  const names = document.cookie
    .split(";")
    .map((cookie) => cookie.split("=")[0]?.trim() ?? "")
    .filter((name) => name.startsWith("_tt") || name.startsWith("ttcsid"));
  const host = location.hostname;
  const domains = ["", host, `.${host.split(".").slice(-2).join(".")}`];
  for (const name of names) {
    for (const domain of domains) {
      document.cookie = `${name}=; Max-Age=0; Path=/${domain ? `; Domain=${domain}` : ""}`;
    }
  }
}

const listeners = new Set<() => void>();

export function readAdConsent(): AdConsent | null {
  const value = document.cookie
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${AD_CONSENT_COOKIE}=`))
    ?.slice(AD_CONSENT_COOKIE.length + 1);
  return parseAdConsent(value);
}

/** Guarda la decisión (cookie propia de un año) y avisa a los componentes que la leen. */
export function saveAdConsent(grantedByVisitor: boolean) {
  document.cookie = adConsentCookie(grantedByVisitor, { https: location.protocol === "https:" });
  if (!grantedByVisitor) {
    deactivateTikTokPixel();
    clearTikTokCookies();
  }
  for (const listener of listeners) listener();
}

export function subscribeAdConsent(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
