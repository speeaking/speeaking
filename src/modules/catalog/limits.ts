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
 * Límites de frecuencia del catálogo (SEC-15): crear productos es barato para un script y caro para
 * la plataforma (cada alta revisa autenticidad, crea publicación y desplaza el feed de Comprar).
 * Holgado para una tienda real que sube su inventario a mano; acotado para una granja de cuentas.
 * Cada intento cuenta, permitido o no, con el limitador atómico de la base. Las reglas por IP van
 * primero y se omiten si no hay IP confiable; las de cuenta siempre aplican.
 */
type Rule = {
  scope: string;
  subject: Extract<RateLimitSubject, "ip" | "user">;
  limit: number;
  windowSeconds: number;
};

const HOUR = 60 * 60;
const DAY = 24 * HOUR;

export const CATALOG_LIMITS = {
  create: [
    { scope: "product.create", subject: "ip", limit: 60, windowSeconds: HOUR },
    { scope: "product.create", subject: "user", limit: 30, windowSeconds: HOUR },
    { scope: "product.create.day", subject: "user", limit: 150, windowSeconds: DAY },
  ],
} as const satisfies Record<string, readonly Rule[]>;

export type CatalogLimitedAction = keyof typeof CATALOG_LIMITS;

/** Suma un intento; devuelve el mensaje para la interfaz si se pasó del límite, o `null`. */
export async function checkCatalogLimit(
  action: CatalogLimitedAction,
  userId: string,
): Promise<string | null> {
  const ip = clientIp(await headers());
  const result = await rateLimitMany(
    CATALOG_LIMITS[action].map(({ scope, subject, limit, windowSeconds }) => ({
      key: rateLimitKey(scope, subject, subject === "ip" ? ip : userId),
      limit,
      windowSeconds,
    })),
  );
  return limitOrError(result);
}
