import "server-only";
import { clientIp } from "@/server/client-ip";
import {
  limitOrError,
  rateLimitKey,
  rateLimitMany,
  type RateLimitSubject,
} from "@/server/rate-limit";

/**
 * Límites de los formularios de derechos (SEC-15), con el limitador atómico de la base. El aviso es
 * público (sin cuenta): por IP (se omite sin IP confiable, `server/client-ip.ts`) y por correo de
 * quien avisa, holgados para quien corrige su aviso varias veces. El contra-aviso y las acciones del
 * equipo, por cuenta (`admin.<acción>`, architecture.md → Administración).
 */
type Rule = {
  scope: string;
  subject: Extract<RateLimitSubject, "ip" | "user" | "email">;
  limit: number;
  windowSeconds: number;
};

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const RIGHTS_LIMITS = {
  noticeIp: [
    { scope: "rights.notice", subject: "ip", limit: 10, windowSeconds: HOUR },
    { scope: "rights.notice.day", subject: "ip", limit: 30, windowSeconds: DAY },
  ],
  noticeEmail: [{ scope: "rights.notice", subject: "email", limit: 10, windowSeconds: DAY }],
  counterNotice: [{ scope: "rights.counter", subject: "user", limit: 10, windowSeconds: HOUR }],
  admin: [{ scope: "admin.rights", subject: "user", limit: 300, windowSeconds: HOUR }],
} as const satisfies Record<string, readonly Rule[]>;

/**
 * Suma un intento; devuelve el mensaje para la interfaz si se pasó del límite, o `null`. `value` es
 * la cuenta o el correo según la regla; las de IP la leen de las cabeceras.
 */
export async function checkRightsLimit(
  action: keyof typeof RIGHTS_LIMITS,
  requestHeaders: Headers,
  value?: string,
): Promise<string | null> {
  const ip = clientIp(requestHeaders);
  const rules: readonly Rule[] = RIGHTS_LIMITS[action];
  const result = await rateLimitMany(
    rules.map(({ scope, subject, limit, windowSeconds }) => ({
      key: rateLimitKey(scope, subject, subject === "ip" ? ip : value),
      limit,
      windowSeconds,
    })),
  );
  return limitOrError(result);
}
