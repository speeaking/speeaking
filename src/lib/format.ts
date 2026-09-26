import { siteConfig } from "@/config/site";

/** Centavos → moneda local ("$3,499", "$174.95"). El dinero siempre viaja en centavos (P2). */
export function formatMoney(cents: number, currency: string = siteConfig.currency) {
  return new Intl.NumberFormat(siteConfig.locale, {
    style: "currency",
    currency,
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60],
  ["month", 30 * 24 * 60 * 60],
  ["week", 7 * 24 * 60 * 60],
  ["day", 24 * 60 * 60],
  ["hour", 60 * 60],
  ["minute", 60],
];

const relativeFormatter = new Intl.RelativeTimeFormat(siteConfig.locale, {
  numeric: "always",
  style: "short",
});

/** "ahora", "hace 15 min", "hace 3 h", "hace 3 días"… */
export function formatRelativeTime(date: Date, now: Date = new Date()) {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000);
  if (Math.abs(seconds) < 60) return "ahora";
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return relativeFormatter.format(Math.round(seconds / size), unit).replace(/\.$/, "");
    }
  }
  return "ahora";
}

const compactFormatter = new Intl.NumberFormat(siteConfig.locale, {
  notation: "compact",
  maximumFractionDigits: 1,
});

/** 2400 → "2.4 k" */
export function formatCompactNumber(value: number) {
  return compactFormatter.format(value).replace(/ /g, " ");
}

const integerFormatter = new Intl.NumberFormat(siteConfig.locale, { maximumFractionDigits: 0 });

/** Cantidad con su sustantivo en singular o plural: "1 publicación", "1,250 publicaciones". */
export function formatCount(count: number, singular: string, plural: string) {
  return `${integerFormatter.format(count)} ${count === 1 ? singular : plural}`;
}

/** "1 miembro", "12 miembros", "1,250 miembros". */
export function formatMembers(count: number) {
  return formatCount(count, "miembro", "miembros");
}
