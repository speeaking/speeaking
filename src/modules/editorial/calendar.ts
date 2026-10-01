import { siteConfig } from "@/config/site";
import { addDays, buenFin, type Day, daysBetween, dayToDbDate } from "@/modules/platform/calendar";

/**
 * Fechas del calendario mexicano de las que la redacción puede hablar (ADR-066). Las fechas las
 * pone el código, nunca la IA (P2): solo las que caen siempre el mismo día o siguen una regla
 * conocida. Son fiestas que en México se celebran de forma general (tradiciones, días de convivencia
 * y el Buen Fin, cuya fecha ya lleva la operación en `platform/calendar.ts`), sin conmemoraciones
 * políticas ni de luto. Algunas tienen origen religioso (Día de Reyes, Navidad): la redacción habla
 * de la celebración y la convivencia, nunca de creencias (regla 6 del prompt, `task.ts`).
 */

export type Occasion = {
  /** Identificador con año (`dia-de-muertos-2026`): una comunidad no repite la misma fecha. */
  key: string;
  name: string;
  day: Day;
};

/** Días de anticipación con los que se puede publicar sobre una fecha. */
export const OCCASION_WINDOW_DAYS = 7;

const FIXED: readonly { slug: string; name: string; month: number; date: number }[] = [
  { slug: "ano-nuevo", name: "Año Nuevo", month: 1, date: 1 },
  { slug: "dia-de-reyes", name: "Día de Reyes", month: 1, date: 6 },
  { slug: "dia-del-amor-y-la-amistad", name: "Día del Amor y la Amistad", month: 2, date: 14 },
  { slug: "dia-del-nino", name: "Día de la Niña y el Niño", month: 4, date: 30 },
  { slug: "dia-de-las-madres", name: "Día de las Madres", month: 5, date: 10 },
  { slug: "dia-del-maestro", name: "Día de la Maestra y el Maestro", month: 5, date: 15 },
  { slug: "fiestas-patrias", name: "la noche del Grito de Independencia", month: 9, date: 15 },
  { slug: "halloween", name: "Halloween", month: 10, date: 31 },
  { slug: "dia-de-muertos", name: "Día de Muertos", month: 11, date: 2 },
  { slug: "navidad", name: "Navidad", month: 12, date: 25 },
];

function pad(value: number) {
  return String(value).padStart(2, "0");
}

/** Día del Padre en México: tercer domingo de junio. */
export function fathersDay(year: number): Day {
  const firstWeekday = new Date(Date.UTC(year, 5, 1)).getUTCDay();
  const firstSunday = 1 + ((7 - firstWeekday) % 7);
  return `${year}-06-${pad(firstSunday + 14)}`;
}

/** Las fechas de un año, en orden. */
export function occasionsOf(year: number): Occasion[] {
  const fixed = FIXED.map(({ slug, name, month, date }) => ({
    key: `${slug}-${year}`,
    name,
    day: `${year}-${pad(month)}-${pad(date)}`,
  }));
  return [
    ...fixed,
    { key: `dia-del-padre-${year}`, name: "Día del Padre", day: fathersDay(year) },
    { key: `buen-fin-${year}`, name: "el Buen Fin", day: buenFin(year).from },
  ].sort((a, b) => a.day.localeCompare(b.day));
}

/** Fechas que caen entre `day` y `withinDays` días después (ambos incluidos), la más cercana primero. */
export function upcomingOccasions(day: Day, withinDays = OCCASION_WINDOW_DAYS): Occasion[] {
  const year = Number(day.slice(0, 4));
  const until = addDays(day, withinDays);
  return [...occasionsOf(year), ...occasionsOf(year + 1)].filter(
    (occasion) => occasion.day >= day && occasion.day <= until,
  );
}

const dateFormatter = new Intl.DateTimeFormat(siteConfig.locale, {
  weekday: "long",
  day: "numeric",
  month: "long",
  timeZone: "UTC",
});

/** «lunes, 2 de noviembre»: la fecha como se le da al modelo y al equipo. */
export function occasionDateText(day: Day): string {
  return dateFormatter.format(dayToDbDate(day));
}

/** «es hoy», «es mañana» o «faltan 5 días». */
export function daysUntilText(from: Day, occasion: Occasion): string {
  const days = daysBetween(from, occasion.day);
  if (days <= 0) return "es hoy";
  if (days === 1) return "es mañana";
  return `faltan ${days} días`;
}
