import { siteConfig } from "@/config/site";

/** Día del calendario en la zona del mercado ("2026-09-25"): sirve para `dateTime` y comparar. */
export function localDay(date: Date, timeZone: string = siteConfig.timeZone): string {
  // en-CA da el formato ISO (AAAA-MM-DD) sin armarlo a mano.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

/** ¿Las dos fechas caen en el mismo día en la zona del mercado (America/Mexico_City)? */
export function isSameLocalDay(a: Date, b: Date, timeZone: string = siteConfig.timeZone) {
  return localDay(a, timeZone) === localDay(b, timeZone);
}

/** Fecha pequeña del encabezado «Para ti»: "viernes 25 de septiembre" (es-MX, hora de México). */
export function feedDateLabel(date: Date, timeZone: string = siteConfig.timeZone): string {
  return new Intl.DateTimeFormat(siteConfig.locale, {
    timeZone,
    weekday: "long",
    day: "numeric",
    month: "long",
  })
    .format(date)
    .replace(",", "");
}
