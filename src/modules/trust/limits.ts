import "server-only";
import { headers } from "next/headers";
import { clientIp } from "@/server/client-ip";
import {
  limitOrError,
  rateLimitKey,
  rateLimitMany,
  type RateLimitSubject,
} from "@/server/rate-limit";

/**
 * Límites de frecuencia de las acciones de confianza y moderación (SEC-15): cada intento cuenta,
 * permitido o no, con el limitador atómico de la base. Las reglas por IP van primero y se omiten si
 * no hay IP confiable; las de cuenta siempre aplican.
 */
type Rule = {
  scope: string;
  subject: Extract<RateLimitSubject, "ip" | "user">;
  limit: number;
  windowSeconds: number;
};

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const TRUST_LIMITS = {
  // Reportar es barato para quien reporta y caro para el equipo: acotado por hora y por día.
  report: [
    { scope: "report", subject: "ip", limit: 30, windowSeconds: HOUR },
    { scope: "report", subject: "user", limit: 10, windowSeconds: HOUR },
    { scope: "report.day", subject: "user", limit: 30, windowSeconds: DAY },
  ],
  proof: [{ scope: "trust.proof", subject: "user", limit: 20, windowSeconds: HOUR }],
  generic: [{ scope: "trust.generic", subject: "user", limit: 30, windowSeconds: HOUR }],
  // Equipo: scope `admin.<acción>` → llave `admin.<acción>:user:<uuid>` (el scope no admite `:`;
  // architecture.md → Administración). Holgado, pero con tope.
  moderation: [{ scope: "admin.moderation", subject: "user", limit: 300, windowSeconds: HOUR }],
  proofImage: [{ scope: "admin.proof", subject: "user", limit: 600, windowSeconds: HOUR }],
} as const satisfies Record<string, readonly Rule[]>;

export type TrustLimitedAction = keyof typeof TRUST_LIMITS;

/** Suma un intento; devuelve el mensaje para la interfaz si se pasó del límite, o `null`. */
export async function checkTrustLimit(
  action: TrustLimitedAction,
  userId: string,
): Promise<string | null> {
  const ip = clientIp(await headers());
  const result = await rateLimitMany(
    TRUST_LIMITS[action].map(({ scope, subject, limit, windowSeconds }) => ({
      key: rateLimitKey(scope, subject, subject === "ip" ? ip : userId),
      limit,
      windowSeconds,
    })),
  );
  return limitOrError(result);
}
