import type { RiskLevel } from "@/generated/prisma/enums";
import {
  DEFAULT_FEED_POLICY,
  FEED_POLICY_KEY,
  type FeedPolicy,
  feedPolicySchema,
} from "@/modules/feed/policy";

/**
 * Catálogo de lo que el motor de automejora puede mover (plan-90-dias.md §2.4, ADR-019, ADR-033).
 * El nivel de riesgo, los límites y el paso máximo son CÓDIGO: la IA nunca los decide ni los ve
 * como algo negociable. Un parámetro que no está aquí no se puede proponer con valores; los temas
 * de dinero (pagos, precios, comisiones, gasto de IA) están prohibidos incluso como propuesta.
 */

export type TunableStep =
  /** Cambio máximo relativo al valor actual (0.2 = ±20 %). */
  | { type: "relative"; max: number }
  /** Cambio máximo en unidades del parámetro. */
  | { type: "absolute"; max: number };

/** Llave de `DailyMetric` que decide un experimento del parámetro. */
export type PrimaryMetricKey = "feed.engagement.rate" | "feed.product_visits.rate";

export type Tunable = {
  /** Ruta con puntos: ajuste + campo ("feed.policy.recencyHalfLifeHours"). */
  key: string;
  /** Llave del `PlatformSetting` que lo guarda. */
  setting: typeof FEED_POLICY_KEY;
  field: Exclude<keyof FeedPolicy, "version">;
  label: string;
  /** Unidad para mostrar el valor ("h", "%", "posiciones"). */
  unit: "hours" | "share" | "positions";
  risk: Extract<RiskLevel, "LOW" | "MEDIUM">;
  min: number;
  max: number;
  step: TunableStep;
  integer: boolean;
  /** Decimales con los que se redondea un valor propuesto. */
  decimals: number;
  primaryMetric: PrimaryMetricKey;
};

export const TUNABLES = [
  {
    key: "feed.policy.recencyHalfLifeHours",
    setting: FEED_POLICY_KEY,
    field: "recencyHalfLifeHours",
    label: "Vida media de la recencia",
    unit: "hours",
    risk: "LOW",
    min: 6,
    max: 168,
    step: { type: "relative", max: 0.2 },
    integer: false,
    decimals: 1,
    primaryMetric: "feed.engagement.rate",
  },
  {
    key: "feed.policy.explorationShare",
    setting: FEED_POLICY_KEY,
    field: "explorationShare",
    label: "Contenido de exploración",
    unit: "share",
    risk: "LOW",
    min: 0,
    max: 0.5,
    step: { type: "absolute", max: 0.05 },
    integer: false,
    decimals: 2,
    primaryMetric: "feed.engagement.rate",
  },
  {
    key: "feed.policy.authorWindow",
    setting: FEED_POLICY_KEY,
    field: "authorWindow",
    label: "Ventana sin repetir autor",
    unit: "positions",
    risk: "LOW",
    min: 2,
    max: 10,
    step: { type: "absolute", max: 1 },
    integer: true,
    decimals: 0,
    primaryMetric: "feed.engagement.rate",
  },
  // Comercio en cualquier dirección es riesgo MEDIO: mostrar menos también reduce la exposición de
  // los vendedores, que es la métrica norte. Experimento al 10 % y adoptar requiere aprobación.
  {
    key: "feed.policy.commerceSlotEvery",
    setting: FEED_POLICY_KEY,
    field: "commerceSlotEvery",
    label: "Una pieza comercial cada",
    unit: "positions",
    risk: "MEDIUM",
    min: 3,
    max: 12,
    step: { type: "absolute", max: 1 },
    integer: true,
    decimals: 0,
    primaryMetric: "feed.product_visits.rate",
  },
  {
    key: "feed.policy.minGapBetweenCommerce",
    setting: FEED_POLICY_KEY,
    field: "minGapBetweenCommerce",
    label: "Separación mínima entre piezas comerciales",
    unit: "positions",
    risk: "MEDIUM",
    min: 2,
    max: 12,
    step: { type: "absolute", max: 1 },
    integer: true,
    decimals: 0,
    primaryMetric: "feed.product_visits.rate",
  },
] as const satisfies readonly Tunable[];

export type TunableKey = (typeof TUNABLES)[number]["key"];

const BY_KEY = new Map<string, Tunable>(TUNABLES.map((tunable) => [tunable.key, tunable]));

export function getTunable(key: string | null | undefined): Tunable | null {
  return key ? (BY_KEY.get(key) ?? null) : null;
}

/**
 * Temas que el motor no toca nunca, ni como propuesta (ADR-033: pagos, precios, comisiones y gasto
 * quedan fuera de su alcance). El modo de autonomía solo lo cambia una persona desde /admin.
 */
export const FORBIDDEN_SETTING_PREFIXES = [
  "commerce.",
  "payments.",
  "payment.",
  "pricing.",
  "billing.",
  "fees.",
  "ai.budget",
  // Encender o apagar funciones de IA es una decisión de producto (ADR-043): solo una persona.
  "ai.features",
  "ai.routing",
  "platform.autonomy",
] as const;

export function isForbiddenSetting(key: string): boolean {
  return FORBIDDEN_SETTING_PREFIXES.some((prefix) => key === prefix || key.startsWith(prefix));
}

/**
 * Riesgo de un cambio, decidido por código. Sin ajuste (una observación para el equipo), con un
 * ajuste desconocido o prohibido: ALTO (solo propuesta, nunca automático).
 */
export function classifyRisk(settingKey: string | null | undefined): RiskLevel {
  if (!settingKey || isForbiddenSetting(settingKey)) return "HIGH";
  return getTunable(settingKey)?.risk ?? "HIGH";
}

export type ChangeCheck = { ok: true } | { ok: false; reason: string };

const EPSILON = 1e-9;

/** ¿El valor es válido para el parámetro (límites y enteros)? */
export function checkBounds(tunable: Tunable, value: unknown): ChangeCheck {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return { ok: false, reason: "El valor no es un número." };
  }
  if (tunable.integer && !Number.isInteger(value)) {
    return { ok: false, reason: `${tunable.label}: debe ser un número entero.` };
  }
  if (value < tunable.min - EPSILON || value > tunable.max + EPSILON) {
    return {
      ok: false,
      reason: `${tunable.label}: fuera de los límites (${tunable.min} a ${tunable.max}).`,
    };
  }
  return { ok: true };
}

/** Cambio máximo permitido desde `current`. */
export function maxStep(tunable: Tunable, current: number): number {
  return tunable.step.type === "relative" ? Math.abs(current) * tunable.step.max : tunable.step.max;
}

/** Valida un cambio completo: límites, paso máximo y que de verdad cambie algo. */
export function checkChange(tunable: Tunable, current: number, next: unknown): ChangeCheck {
  const bounds = checkBounds(tunable, next);
  if (!bounds.ok) return bounds;
  const value = next as number;
  if (Math.abs(value - current) < EPSILON) {
    return { ok: false, reason: `${tunable.label}: el valor nuevo es igual al actual.` };
  }
  if (Math.abs(value - current) > maxStep(tunable, current) + EPSILON) {
    return {
      ok: false,
      reason: `${tunable.label}: el cambio supera el paso máximo permitido.`,
    };
  }
  return { ok: true };
}

/**
 * Valor propuesto: un paso máximo en la dirección pedida, redondeado HACIA el valor actual (para
 * nunca pasarse del paso) y recortado a los límites. `null` si ya está en el límite.
 */
export function stepValue(tunable: Tunable, current: number, direction: 1 | -1): number | null {
  const factor = 10 ** tunable.decimals;
  // Sin el ruido de punto flotante (0.2 − 0.05 = 0.15000000000000002) antes de redondear.
  const raw = Number((current + direction * maxStep(tunable, current)).toFixed(9));
  const scaled = Number((raw * factor).toFixed(6));
  const rounded = (direction > 0 ? Math.floor(scaled) : Math.ceil(scaled)) / factor;
  const clamped = Math.min(tunable.max, Math.max(tunable.min, rounded));
  const next = Number(clamped.toFixed(tunable.decimals));
  return checkChange(tunable, current, next).ok ? next : null;
}

/** Valor actual del parámetro dentro de la política. */
export function readTunable(policy: FeedPolicy, tunable: Tunable): number {
  return policy[tunable.field];
}

/** Política con el parámetro cambiado, validada con su esquema (o `null` si no pasa). */
export function withTunable(
  policy: FeedPolicy,
  tunable: Tunable,
  value: number,
): FeedPolicy | null {
  const parsed = feedPolicySchema.safeParse({ ...policy, [tunable.field]: value });
  return parsed.success ? parsed.data : null;
}

/** Política vigente a partir del valor guardado (el valor por defecto si falta o no es válido). */
export function parseFeedPolicy(value: unknown): FeedPolicy {
  const parsed = feedPolicySchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_FEED_POLICY;
}

/** Texto legible de un valor del parámetro ("36 h", "20 %", "4 posiciones"). */
export function formatTunableValue(tunable: Tunable, value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "—";
  const number = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 2 });
  switch (tunable.unit) {
    case "hours":
      return `${number.format(value)} h`;
    case "share":
      return `${number.format(value * 100)} %`;
    case "positions":
      return value === 1 ? "1 posición" : `${number.format(value)} posiciones`;
  }
}
