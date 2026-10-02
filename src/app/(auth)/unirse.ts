import { safeRedirectPath } from "@/lib/safe-redirect";

/**
 * `?unirse=<slug>` (una o varias veces): comunidades que la persona eligió antes de tener cuenta
 * («Arma tu feed», «Únete a Gaming»). Viajan de /registro a /bienvenida para llegar ya marcadas en el
 * paso 2 del onboarding. Aquí solo se valida la forma; /bienvenida comprueba que existan.
 */
export const JOIN_PARAM = "unirse";
export const MAX_JOIN_SLUGS = 5;

const SLUG = /^[a-z0-9-]{1,60}$/;

/** Slugs con forma válida, sin repetir, hasta 5 (el resto se ignora). */
export function parseJoinSlugs(value: string | string[] | undefined | null): string[] {
  const values = value === undefined || value === null ? [] : [value].flat();
  return [...new Set(values.filter((slug) => SLUG.test(slug)))].slice(0, MAX_JOIN_SLUGS);
}

/** `/bienvenida?unirse=a&unirse=b&next=/p/1` (sin parámetros vacíos). */
export function onboardingPath({ join, next }: { join: readonly string[]; next: string }) {
  const params = new URLSearchParams();
  for (const slug of join) params.append(JOIN_PARAM, slug);
  if (next) params.set("next", next);
  const query = params.toString();
  return query ? `/bienvenida?${query}` : "/bienvenida";
}

/**
 * El registro solo sabe mandar un `next` a /bienvenida. Para no perder `unirse`, /registro envuelve
 * el onboarding completo en ese `next` («/bienvenida?unirse=gaming&next=/p/1»); /bienvenida lo
 * desenvuelve aquí. `null` si `next` no apunta al onboarding.
 */
export function unwrapOnboardingNext(next: string): { join: string[]; next: string } | null {
  const safe = safeRedirectPath(next, "");
  if (!safe) return null;
  const url = new URL(safe, "http://speeaking.local");
  if (url.pathname !== "/bienvenida") return null;
  const inner = safeRedirectPath(url.searchParams.get("next"), "");
  return {
    join: parseJoinSlugs(url.searchParams.getAll(JOIN_PARAM)),
    // Nunca de vuelta al onboarding (evita ciclos).
    next: inner && new URL(inner, "http://speeaking.local").pathname !== "/bienvenida" ? inner : "",
  };
}
