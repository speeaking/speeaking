import "server-only";
import { createHash } from "node:crypto";
import { ipNetwork } from "./client-ip";
import { db } from "./db";

/**
 * Límite de frecuencia propio de la app (SEC-02, SEC-12, SEC-15), para Server Actions y route
 * handlers. El `rateLimit` de Better Auth solo cubre el router HTTP `/api/auth/*`; las llamadas
 * directas a `auth.api.*` no pasan por él.
 *
 * API:
 * - `rateLimit({ key, limit, windowSeconds })` → `{ ok: true }` o `{ ok: false, retryAfterSeconds }`.
 * - `rateLimitMany(rules)`: revisa las reglas EN ORDEN y se detiene en la primera que falla; las reglas
 *   con `key: null` (p. ej. sin IP confiable) se omiten. Pon primero la más amplia (IP): así una IP
 *   bloqueada no sigue gastando el cupo por cuenta de sus víctimas.
 * - `rateLimitKey(scope, subject, value)`: llave con espacio de nombres, p. ej. "signin:ip:1.2.3.4",
 *   "post:user:<uuid>", "signin:email:<sha256>". Los correos se guardan como hash: la tabla no guarda
 *   datos personales en claro. IPv6 se agrupa por /64. Devuelve `null` si no hay valor (o la IP no es
 *   válida), para pasarlo directo a `rateLimitMany`.
 * - `limitOrError(result)`: mensaje para la interfaz ("Demasiados intentos. Intenta de nuevo en 5
 *   minutos.") o `null` si se permite.
 * - `cleanupExpiredRateLimits()`: borra cubetas vencidas; `rateLimit` la llama sola a lo más una vez
 *   por minuto por proceso.
 *
 * Ejemplo en una Server Action:
 *   const ip = clientIp(await headers());
 *   const error = limitOrError(await rateLimitMany([
 *     { key: rateLimitKey("signin", "ip", ip), limit: 10, windowSeconds: 15 * 60 },
 *     { key: rateLimitKey("signin", "email", email), limit: 5, windowSeconds: 15 * 60 },
 *   ]));
 *   if (error) return { error };
 *
 * Ventana fija por llave que empieza en el primer intento: cada intento (permitido o no) suma, y al
 * vencer la ventana el conteo vuelve a 1. El conteo y la decisión son una sola sentencia
 * (`INSERT … ON CONFLICT … DO UPDATE … RETURNING`) con el reloj de la base: exacto con peticiones
 * concurrentes y con varias instancias. Una llave se usa siempre con el mismo límite y ventana (la
 * ventana en curso manda). Si la base falla, el error se propaga: sin base tampoco hay login.
 */

export type RateLimitRule = { key: string; limit: number; windowSeconds: number };
export type RateLimitResult = { ok: true } | { ok: false; retryAfterSeconds: number };
/** Qué identifica la llave: IP (agrupada), id de usuario (UUID) o correo (se guarda como hash). */
export type RateLimitSubject = "ip" | "user" | "email";

// Minúsculas, dígitos y `._:/-`: cabe una IP, un UUID o un hash, pero no un correo en claro.
const KEY_PATTERN = /^[a-z0-9][a-z0-9._:/-]*$/;
const MAX_KEY_LENGTH = 200;
const SCOPE_PATTERN = /^[a-z][a-z0-9._-]{0,79}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_WINDOW_SECONDS = 7 * 24 * 60 * 60;
const CLEANUP_INTERVAL_MS = 60_000;
const CLEANUP_BATCH_SIZE = 500;

let nextCleanupAt = 0;

/** Suma un intento a `key` y decide si se permite. */
export async function rateLimit(rule: RateLimitRule): Promise<RateLimitResult> {
  assertValidRule(rule);
  const { key, limit, windowSeconds } = rule;
  // En el UPDATE, `b.*` es la fila anterior: ambas ramas deciden con el `expiresAt` previo. El conteo
  // se satura antes del máximo de `int4` para que una ventana larga bajo ataque no desborde.
  const rows = await db.$queryRaw<{ count: number; retryAfterSeconds: number }[]>`
    INSERT INTO "rate_limit_buckets" AS b ("key", "count", "expiresAt")
    VALUES (${key}, 1, now() + ${windowSeconds}::int * interval '1 second')
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE WHEN b."expiresAt" <= now() THEN 1 ELSE LEAST(b."count", 2147483646) + 1 END,
      "expiresAt" = CASE WHEN b."expiresAt" <= now() THEN EXCLUDED."expiresAt" ELSE b."expiresAt" END
    RETURNING
      "count",
      GREATEST(1, CEIL(EXTRACT(EPOCH FROM ("expiresAt" - now()))))::int AS "retryAfterSeconds"`;
  await maybeCleanup();

  const row = rows[0];
  if (!row) throw new Error("[rate-limit] la base no devolvió la cubeta.");
  return row.count <= limit
    ? { ok: true }
    : { ok: false, retryAfterSeconds: row.retryAfterSeconds };
}

/** Revisa varias reglas en orden; falla con la primera que falle. Omite las de `key: null`. */
export async function rateLimitMany(
  rules: ReadonlyArray<Omit<RateLimitRule, "key"> & { key: string | null }>,
): Promise<RateLimitResult> {
  for (const { key, limit, windowSeconds } of rules) {
    if (key === null) continue;
    const result = await rateLimit({ key, limit, windowSeconds });
    if (!result.ok) return result;
  }
  return { ok: true };
}

/**
 * Llave con espacio de nombres (`<scope>:<subject>:<valor>`), sin datos personales en claro.
 * `null` si no hay valor o la IP no es válida (la regla se omite en `rateLimitMany`).
 */
export function rateLimitKey(
  scope: string,
  subject: RateLimitSubject,
  value: string | null | undefined,
): string | null {
  if (!SCOPE_PATTERN.test(scope)) {
    throw new TypeError("[rate-limit] el scope debe ser minúsculas, dígitos o ._- (máx. 80).");
  }
  const trimmed = value?.trim();
  if (!trimmed) return null;
  switch (subject) {
    case "ip": {
      const network = ipNetwork(trimmed);
      return network === null ? null : `${scope}:ip:${network}`;
    }
    case "user": {
      if (!UUID_PATTERN.test(trimmed)) {
        throw new TypeError("[rate-limit] el id de usuario no es un UUID.");
      }
      return `${scope}:user:${trimmed.toLowerCase()}`;
    }
    case "email":
      return `${scope}:email:${sha256(trimmed.toLowerCase())}`;
  }
}

/** Mensaje para la interfaz si alguna regla falló (se reporta la espera más larga); `null` si no. */
export function limitOrError(result: RateLimitResult | readonly RateLimitResult[]): string | null {
  const results: readonly RateLimitResult[] = "ok" in result ? [result] : result;
  let seconds = 0;
  for (const item of results) {
    if (!item.ok) seconds = Math.max(seconds, item.retryAfterSeconds, 1);
  }
  if (seconds === 0) return null;
  return `Demasiados intentos. Intenta de nuevo en ${formatWait(seconds)}.`;
}

/** Borra hasta `batchSize` cubetas vencidas (equivalen a no tener fila). Devuelve cuántas borró. */
export async function cleanupExpiredRateLimits(batchSize = CLEANUP_BATCH_SIZE): Promise<number> {
  // El `expiresAt < now()` de afuera se vuelve a evaluar si otra petición reinició la cubeta mientras
  // tanto: una ventana nueva no se borra.
  return db.$executeRaw`
    DELETE FROM "rate_limit_buckets"
    WHERE "expiresAt" < now()
      AND "key" IN (
        SELECT "key" FROM "rate_limit_buckets"
        WHERE "expiresAt" < now()
        ORDER BY "expiresAt"
        LIMIT ${batchSize}::int
      )`;
}

/** Espera redondeada hacia arriba: minutos hasta 90, luego horas hasta 48, luego días. */
function formatWait(seconds: number): string {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  if (minutes <= 90) return plural(minutes, "minuto", "minutos");
  const hours = Math.ceil(seconds / 3600);
  if (hours <= 48) return plural(hours, "hora", "horas");
  return plural(Math.ceil(seconds / 86_400), "día", "días");
}

function plural(count: number, one: string, many: string) {
  return `${count} ${count === 1 ? one : many}`;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assertValidRule({ key, limit, windowSeconds }: RateLimitRule) {
  if (key.length > MAX_KEY_LENGTH || !KEY_PATTERN.test(key) || !key.includes(":")) {
    throw new TypeError("[rate-limit] llave inválida: constrúyela con rateLimitKey().");
  }
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("[rate-limit] el límite debe ser un entero ≥ 1.");
  }
  if (!Number.isInteger(windowSeconds) || windowSeconds < 1 || windowSeconds > MAX_WINDOW_SECONDS) {
    throw new RangeError("[rate-limit] la ventana debe ser un entero de 1 s a 7 días.");
  }
}

/** Limpieza oportunista: a lo más una vez por minuto por proceso; nunca rompe la petición. */
async function maybeCleanup() {
  const now = Date.now();
  if (now < nextCleanupAt) return;
  nextCleanupAt = now + CLEANUP_INTERVAL_MS;
  try {
    await cleanupExpiredRateLimits();
  } catch (error) {
    console.error("[rate-limit] no se pudieron borrar cubetas vencidas", error);
  }
}
