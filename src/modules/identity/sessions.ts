import "server-only";
import { userAgentFromString } from "next/server";
import { db } from "@/server/db";

/** Lo que la persona ve de cada sesión abierta (SEC-10). Nunca el token ni la IP. */
export type OpenSessionDTO = {
  id: string;
  device: string;
  lastActiveAt: Date;
  current: boolean;
};

const MAX_LISTED = 20;

/** Sesiones vigentes de `userId`, la actual primero y luego la más reciente. */
export async function listOpenSessions(
  userId: string,
  currentSessionId: string,
): Promise<OpenSessionDTO[]> {
  const rows = await db.session.findMany({
    where: { userId, expiresAt: { gt: new Date() } },
    orderBy: { updatedAt: "desc" },
    take: MAX_LISTED,
    select: { id: true, userAgent: true, updatedAt: true },
  });
  return rows
    .map((row) => ({
      id: row.id,
      device: describeDevice(row.userAgent),
      // Better Auth renueva la sesión a lo más una vez al día (`updateAge`): precisión de días.
      lastActiveAt: row.updatedAt,
      current: row.id === currentSessionId,
    }))
    .sort((a, b) => Number(b.current) - Number(a.current));
}

/** «Chrome en Android», «Safari en iOS»… a partir del user agent guardado con la sesión. */
export function describeDevice(userAgent: string | null): string {
  const { browser, os } = userAgentFromString(userAgent ?? undefined);
  const name = browser.name ?? "Navegador desconocido";
  return os.name ? `${name} en ${os.name}` : name;
}
