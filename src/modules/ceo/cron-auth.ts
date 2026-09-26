import { createHash, timingSafeEqual } from "node:crypto";

/**
 * Autorización de las tareas programadas (`/api/cron/*`): `Authorization: Bearer <CRON_SECRET>`.
 * Sin secreto configurado, ninguna petición pasa. La comparación es de tiempo constante sobre los
 * SHA-256 (mismo largo siempre), así que ni el contenido ni el largo del secreto se filtran por tiempo.
 */
export function isAuthorizedCronRequest(
  authorization: string | null,
  secret: string | undefined,
): boolean {
  if (!secret || !authorization) return false;
  const match = /^Bearer (\S+)$/.exec(authorization.trim());
  if (!match) return false;
  const provided = createHash("sha256").update(match[1]!).digest();
  const expected = createHash("sha256").update(secret).digest();
  return timingSafeEqual(provided, expected);
}
