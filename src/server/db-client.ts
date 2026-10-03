import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

/**
 * Fábrica del cliente de Prisma (sin `server-only` para poder usarla en scripts como el seed).
 *
 * La sesión siempre va en UTC: el adaptador envía y lee las fechas sin zona horaria, así que con una
 * base en otra zona (p. ej. America/Mexico_City) cada fecha quedaba desfasada frente a `now()` en SQL
 * (ADR-028).
 */
export function createPrismaClient(connectionString: string) {
  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    // El error nativo de URL incluye la entrada, que aquí contiene la contraseña de la base.
    throw new Error("La cadena de conexión de PostgreSQL no es válida.");
  }
  // pg-connection-string 2.x trata estos modos como verify-full. Hacerlo explícito conserva
  // la verificación del certificado y elimina la advertencia sobre su futuro cambio de significado.
  // Una configuración explícita de compatibilidad libpq conserva la política que haya elegido.
  const tlsMode = url.searchParams.get("sslmode");
  if (
    url.searchParams.get("uselibpqcompat") !== "true" &&
    ["prefer", "require", "verify-ca"].includes(tlsMode ?? "")
  ) {
    url.searchParams.set("sslmode", "verify-full");
    connectionString = url.href;
  }
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString, options: "-c TimeZone=UTC" }),
    // Margen para transacciones interactivas: con el servidor ocupado (Turbopack compila rutas en
    // el mismo proceso; arranques fríos) los 5 s por omisión vencían a media transacción y las
    // sentencias siguientes corrían fuera de ella (P2003 en `product_costs` al publicar).
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });
}

export type Database = ReturnType<typeof createPrismaClient>;
