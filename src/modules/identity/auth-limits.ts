import "server-only";
import { clientIp } from "@/server/client-ip";
import { db } from "@/server/db";
import { limitOrError, rateLimitKey, rateLimitMany } from "@/server/rate-limit";

/**
 * Límites de intentos del registro y el inicio de sesión (SEC-02). Corren en las Server Actions ANTES
 * de `auth.api.*`: el `rateLimit` de Better Auth solo cubre su router HTTP, que está cerrado
 * (`app/api/auth/[...all]/route.ts`).
 *
 * - Inicio de sesión: 10 intentos fallidos por IP y 5 por correo cada 15 minutos. El de correo no
 *   depende de la IP (frena ataques distribuidos) y aplica igual exista o no la cuenta, así que no
 *   revela nada. Un inicio correcto devuelve lo que sumó (`forgiveSignIn`): solo cuentan los fallidos,
 *   para no bloquear a quien comparte IP (redes móviles con CGNAT) ni a quien entra desde varios
 *   dispositivos.
 * - Registro: 3 por IP por minuto (cuentas masivas) y 5 por correo por hora (acota las mediciones de
 *   tiempo contra un mismo correo, SEC-11). Aquí todo intento cuenta.
 *
 * Sin IP confiable (`TRUSTED_PROXY_HOPS=0`, el valor en desarrollo) la regla por IP se omite y quedan
 * las de correo (ver `server/client-ip.ts`). La IP va primero: una IP bloqueada no gasta el cupo del
 * correo de su víctima.
 */

const MINUTE = 60;

export const AUTH_LIMITS = {
  signInIp: { limit: 10, windowSeconds: 15 * MINUTE },
  signInEmail: { limit: 5, windowSeconds: 15 * MINUTE },
  signUpIp: { limit: 3, windowSeconds: MINUTE },
  signUpEmail: { limit: 5, windowSeconds: 60 * MINUTE },
  recoveryIp: { limit: 10, windowSeconds: 15 * MINUTE },
  recoveryEmail: { limit: 3, windowSeconds: 60 * MINUTE },
  resetIp: { limit: 10, windowSeconds: 15 * MINUTE },
  resetToken: { limit: 5, windowSeconds: 15 * MINUTE },
} as const;

/** Mensaje para la interfaz si se pasó del límite (`null` si no) y las llaves que sumaron. */
export type AuthLimitCheck = { error: string | null; keys: string[] };

/** Cuenta un intento de inicio de sesión para `email` (ya normalizado). */
export function limitSignIn(requestHeaders: Headers, email: string) {
  const ip = clientIp(requestHeaders);
  return check([
    { key: rateLimitKey("signin", "ip", ip), ...AUTH_LIMITS.signInIp },
    { key: rateLimitKey("signin", "email", email), ...AUTH_LIMITS.signInEmail },
  ]);
}

/** Cuenta un intento de registro para `email` (ya normalizado). */
export function limitSignUp(requestHeaders: Headers, email: string) {
  const ip = clientIp(requestHeaders);
  return check([
    { key: rateLimitKey("signup", "ip", ip), ...AUTH_LIMITS.signUpIp },
    { key: rateLimitKey("signup", "email", email), ...AUTH_LIMITS.signUpEmail },
  ]);
}

export function limitPasswordRecovery(requestHeaders: Headers, email: string) {
  return check([
    {
      key: rateLimitKey("password-recovery", "ip", clientIp(requestHeaders)),
      ...AUTH_LIMITS.recoveryIp,
    },
    { key: rateLimitKey("password-recovery", "email", email), ...AUTH_LIMITS.recoveryEmail },
  ]);
}

export function limitPasswordReset(requestHeaders: Headers, token: string) {
  return check([
    { key: rateLimitKey("password-reset", "ip", clientIp(requestHeaders)), ...AUTH_LIMITS.resetIp },
    { key: rateLimitKey("password-reset", "token", token), ...AUTH_LIMITS.resetToken },
  ]);
}

/**
 * Un inicio de sesión correcto no es un intento fallido: le resta a sus cubetas lo que sumó. Nunca
 * rompe el inicio de sesión (la cookie ya se escribió); si falla, solo queda en el log.
 */
export async function forgiveSignIn(keys: readonly string[]) {
  if (keys.length === 0) return;
  try {
    await db.rateLimitBucket.updateMany({
      where: { key: { in: [...keys] }, count: { gt: 0 } },
      data: { count: { decrement: 1 } },
    });
  } catch (error) {
    console.error("[auth-limits] no se pudo descontar un inicio de sesión correcto", error);
  }
}

async function check(
  rules: { key: string | null; limit: number; windowSeconds: number }[],
): Promise<AuthLimitCheck> {
  const error = limitOrError(await rateLimitMany(rules));
  return { error, keys: rules.flatMap(({ key }) => (key === null ? [] : [key])) };
}
