import { createHash } from "node:crypto";

/**
 * Producto destacado (ADR-046): reglas puras. La rotación es determinista por hora para que todos
 * los destacados vigentes se repartan los lugares sin favorecer a nadie ni depender del azar del
 * servidor (P2: lo calcula el código y se puede probar).
 */
const DAY_MS = 24 * 60 * 60 * 1000;

/** Nueva fecha de fin: se suma a la vigente si aún corre, o a ahora si ya venció. */
export function featuredUntilAfter(current: Date | null, now: Date, days: number): Date {
  const base = current && current.getTime() > now.getTime() ? current : now;
  return new Date(base.getTime() + days * DAY_MS);
}

/** Llave de rotación: cambia cada hora (UTC). */
export function rotationKey(now: Date): string {
  return `${now.getUTCFullYear()}-${now.getUTCMonth()}-${now.getUTCDate()}-${now.getUTCHours()}`;
}

/** Orden de esta hora para un conjunto de destacados: estable dentro de la hora, distinto entre horas. */
export function rotateFeatured<T extends { id: string }>(items: readonly T[], now: Date): T[] {
  const key = rotationKey(now);
  const score = (id: string) =>
    createHash("sha256").update(`${id}|${key}`).digest("hex").slice(0, 12);
  return [...items].sort((a, b) => score(a.id).localeCompare(score(b.id)));
}

/** Días completos que le quedan a un destacado (0 si venció o no existe). */
export function featuredDaysLeft(until: Date | null, now: Date): number {
  if (!until || until.getTime() <= now.getTime()) return 0;
  return Math.ceil((until.getTime() - now.getTime()) / DAY_MS);
}
