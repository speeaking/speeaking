import { siteConfig } from "@/config/site";

/**
 * Días calendario de la operación (DailyMetric, congelamientos). Un `Day` es "YYYY-MM-DD" en
 * `America/Mexico_City` (docs/data-model.md → DailyMetric): cubre de 00:00 a 24:00 hora del centro.
 * Los límites se calculan con la zona (Intl), no con un −6 fijo, para que sigan siendo correctos si la
 * regla de horario cambia.
 */
export type Day = string;

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY_MS = 24 * 60 * 60 * 1000;

const dayFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: siteConfig.timeZone,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

const partsFormatter = new Intl.DateTimeFormat("en-US", {
  timeZone: siteConfig.timeZone,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

export function isDay(value: string): value is Day {
  const match = DAY_PATTERN.exec(value);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const date = new Date(Date.UTC(y, m - 1, d));
  return date.getUTCFullYear() === y && date.getUTCMonth() === m - 1 && date.getUTCDate() === d;
}

function parseDay(day: Day): { y: number; m: number; d: number } {
  if (!isDay(day)) throw new RangeError(`Día inválido: ${day}`);
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return { y, m, d };
}

/** Día de México al que pertenece un instante. */
export function mexicoDay(date: Date): Day {
  return dayFormatter.format(date);
}

/** Suma (o resta) días calendario. */
export function addDays(day: Day, days: number): Day {
  const { y, m, d } = parseDay(day);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** Días desde `a` hasta `b` (b − a). */
export function daysBetween(a: Day, b: Day): number {
  const pa = parseDay(a);
  const pb = parseDay(b);
  return Math.round((Date.UTC(pb.y, pb.m - 1, pb.d) - Date.UTC(pa.y, pa.m - 1, pa.d)) / DAY_MS);
}

/** Lista de días de `from` a `to`, ambos incluidos. */
export function dayRange(from: Day, to: Day): Day[] {
  const count = daysBetween(from, to);
  return Array.from({ length: Math.max(0, count + 1) }, (_, index) => addDays(from, index));
}

/** Diferencia (ms) entre la hora de pared de la zona y UTC en un instante. */
function zoneOffsetMs(instant: number): number {
  const parts = Object.fromEntries(
    partsFormatter.formatToParts(new Date(instant)).map((part) => [part.type, part.value]),
  );
  const wall = Date.UTC(
    Number(parts.year),
    Number(parts.month) - 1,
    Number(parts.day),
    Number(parts.hour),
    Number(parts.minute),
    Number(parts.second),
  );
  return wall - Math.floor(instant / 1000) * 1000;
}

/** Instante (UTC) en que empieza el día en la Ciudad de México. */
export function dayStart(day: Day): Date {
  const { y, m, d } = parseDay(day);
  const guess = Date.UTC(y, m - 1, d);
  // Dos pasadas: la segunda corrige si la primera cayó del otro lado de un cambio de horario.
  let instant = guess - zoneOffsetMs(guess);
  instant = guess - zoneOffsetMs(instant);
  return new Date(instant);
}

/** Instante (UTC) en que termina el día (= inicio del siguiente). */
export function dayEnd(day: Day): Date {
  return dayStart(addDays(day, 1));
}

/** El día como valor de una columna `@db.Date` (medianoche UTC de esa fecha). */
export function dayToDbDate(day: Day): Date {
  parseDay(day);
  return new Date(`${day}T00:00:00.000Z`);
}

/** Una columna `@db.Date` leída por Prisma → `Day`. */
export function dbDateToDay(date: Date): Day {
  return date.toISOString().slice(0, 10);
}

// ─────────────────────────── Congelamientos (plan-90-dias.md §2.4) ───────────────────────────

export type FreezePeriod = { name: string; from: Day; to: Day };

/**
 * Fechas del Buen Fin confirmadas. Para los años sin fecha publicada se usa la regla de abajo (de
 * viernes a martes alrededor del tercer lunes de noviembre), que reproduce 2026 y cubre de más en
 * los años en que el Buen Fin terminó el lunes.
 */
const BUEN_FIN_DATES: Record<number, { from: Day; to: Day }> = {
  2026: { from: "2026-11-13", to: "2026-11-17" },
};

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Buen Fin del año: fecha confirmada o, si no hay, viernes a martes del tercer lunes de noviembre. */
export function buenFin(year: number): FreezePeriod {
  const known = BUEN_FIN_DATES[year];
  if (known) return { name: "Buen Fin", ...known };
  const firstWeekday = new Date(Date.UTC(year, 10, 1)).getUTCDay();
  const firstMonday = 1 + ((8 - firstWeekday) % 7);
  const thirdMonday: Day = `${year}-11-${pad(firstMonday + 14)}`;
  return { name: "Buen Fin", from: addDays(thirdMonday, -3), to: addDays(thirdMonday, 1) };
}

/** Periodos de congelamiento del año: Buen Fin y del 12 al 25 de diciembre. */
export function freezePeriods(year: number): FreezePeriod[] {
  return [
    buenFin(year),
    { name: "temporada del 12 al 25 de diciembre", from: `${year}-12-12`, to: `${year}-12-25` },
  ];
}

/** Periodo de congelamiento que contiene el día, o `null`. En él nada cambia solo. */
export function freezePeriodFor(day: Day): FreezePeriod | null {
  const { y } = parseDay(day);
  return freezePeriods(y).find((period) => day >= period.from && day <= period.to) ?? null;
}

export function isFrozenDay(day: Day): boolean {
  return freezePeriodFor(day) !== null;
}

/** Siguiente congelamiento que empieza en `day` o después (para avisar en el resumen). */
export function nextFreezePeriod(day: Day): FreezePeriod {
  const { y } = parseDay(day);
  const candidates = [...freezePeriods(y), ...freezePeriods(y + 1)];
  return candidates.find((period) => period.to >= day)!;
}
