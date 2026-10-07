import { siteConfig } from "@/config/site";

/**
 * Días hábiles para los plazos del contra-aviso (RLFDA arts. 37 Octies y 37 Nonies, ADR-076): se
 * restaura de 10 a 15 días hábiles después de recibirlo, salvo que quien avisó acredite una acción
 * legal. Código puro (P2): el equipo ve la fecha calculada y decide.
 *
 * LIMITACIÓN: solo descuenta sábados y domingos (en hora de la Ciudad de México). Los días festivos
 * oficiales y los inhábiles del calendario federal TODAVÍA NO se consideran (qué calendario aplica es
 * una pregunta para el abogado); con un festivo en medio, la fecha queda un día antes de lo debido y
 * el equipo lo revisa antes de restaurar.
 */
export const RESTORE_AFTER_BUSINESS_DAYS = 10;

const DAY_MS = 24 * 60 * 60 * 1000;
const weekday = new Intl.DateTimeFormat("en-US", {
  timeZone: siteConfig.timeZone,
  weekday: "short",
});

export function isBusinessDay(date: Date): boolean {
  const day = weekday.format(date);
  return day !== "Sat" && day !== "Sun";
}

/**
 * `days` días hábiles después de `start`, a la misma hora. Si `start` cae en fin de semana, se cuenta
 * desde el siguiente día hábil (se recibe ese día). La Ciudad de México no cambia de horario desde
 * 2022, así que sumar 24 h conserva la hora local.
 */
export function addBusinessDays(start: Date, days: number): Date {
  let cursor = new Date(start.getTime());
  while (!isBusinessDay(cursor)) cursor = new Date(cursor.getTime() + DAY_MS);
  let added = 0;
  while (added < days) {
    cursor = new Date(cursor.getTime() + DAY_MS);
    if (isBusinessDay(cursor)) added += 1;
  }
  return cursor;
}
