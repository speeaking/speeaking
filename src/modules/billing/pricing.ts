/**
 * Precio comunitario de «Pruébatelo» (ADR-044, docs/modelo-de-ingresos.md §3). Todo lo calcula el
 * código (P2): el nivel sale del volumen de pruebas de toda la plataforma en el mes anterior, el
 * precio de la tabla aprobada, y un piso de seguridad impide vender por debajo del costo aunque un
 * proveedor suba su precio. Cambiar la tabla es una decisión de riesgo ALTO (código + ADR).
 */

export const PRICING_VERSION = "2026-09-29";

/** Pruebas gratis al mes por cuenta con perfil terminado. */
export const FREE_TRY_ONS_PER_MONTH = 3;

/** El precio nunca baja de este múltiplo del costo unitario de la tabla de costos. */
export const PRICE_FLOOR_MULTIPLIER = 1.5;

export type TryOnTier = {
  level: 1 | 2 | 3 | 4;
  /** Pruebas al mes en toda la plataforma (gratis y pagadas) desde las que aplica. */
  minMonthlyTryOns: number;
  priceCents: number;
};

export const TRY_ON_TIERS: readonly TryOnTier[] = [
  { level: 1, minMonthlyTryOns: 0, priceCents: 350 },
  { level: 2, minMonthlyTryOns: 5_000, priceCents: 300 },
  { level: 3, minMonthlyTryOns: 50_000, priceCents: 250 },
  { level: 4, minMonthlyTryOns: 500_000, priceCents: 200 },
];

/** Nivel que corresponde a un volumen mensual. */
export function communityTier(monthlyTryOns: number): TryOnTier {
  const volume = Math.max(0, Math.floor(monthlyTryOns));
  let current = TRY_ON_TIERS[0]!;
  for (const tier of TRY_ON_TIERS) if (volume >= tier.minMonthlyTryOns) current = tier;
  return current;
}

/** El siguiente nivel (más barato), o `null` en el último. */
export function nextTier(tier: TryOnTier): TryOnTier | null {
  return TRY_ON_TIERS.find((candidate) => candidate.level === tier.level + 1) ?? null;
}

export type TryOnPrice = {
  version: string;
  level: TryOnTier["level"];
  levels: number;
  priceCents: number;
  /** Piso = costo unitario × multiplicador, en centavos MXN. */
  floorCents: number;
  /** true si el piso quedó por encima de la tabla: se cobra el piso y el equipo debe revisar. */
  floored: boolean;
  /** Volumen mensual que baja el precio al siguiente nivel, y ese precio; `null` en el último. */
  nextLevelAt: number | null;
  nextPriceCents: number | null;
  monthlyTryOns: number;
};

/**
 * Micro-dólares → centavos MXN, redondeando hacia arriba (el costo nunca se subestima). Se opera
 * sobre enteros grandes y se limpia el ruido de punto flotante antes de redondear: 70,000 × 18 son
 * 126 centavos exactos, no 126.00000000000001 → 127.
 */
export function microsUsdToMxnCents(micros: number, mxnPerUsd: number): number {
  const cents = (micros * mxnPerUsd) / 10_000;
  return Math.ceil(Math.round(cents * 1_000_000) / 1_000_000);
}

/**
 * Precio vigente por prueba. `unitCostMicrosUsd` es el costo de una imagen con el modelo enrutado
 * (tabla de costos); `mxnPerUsd`, el tipo de cambio del ajuste `ai.budget`.
 */
export function tryOnPrice({
  monthlyTryOns,
  unitCostMicrosUsd,
  mxnPerUsd,
}: {
  monthlyTryOns: number;
  unitCostMicrosUsd: number;
  mxnPerUsd: number;
}): TryOnPrice {
  const tier = communityTier(monthlyTryOns);
  const next = nextTier(tier);
  const floorCents = Math.ceil(
    microsUsdToMxnCents(Math.max(0, unitCostMicrosUsd), mxnPerUsd) * PRICE_FLOOR_MULTIPLIER,
  );
  const floored = floorCents > tier.priceCents;
  return {
    version: PRICING_VERSION,
    level: tier.level,
    levels: TRY_ON_TIERS.length,
    priceCents: floored ? floorCents : tier.priceCents,
    floorCents,
    floored,
    nextLevelAt: next?.minMonthlyTryOns ?? null,
    nextPriceCents: next ? Math.max(next.priceCents, floorCents) : null,
    monthlyTryOns: Math.max(0, Math.floor(monthlyTryOns)),
  };
}

export type TopUpPack = {
  id: string;
  amountCents: number;
  /** Bono de saldo (no es ingreso; se registra como PROMO). */
  bonusCents: number;
};

/** Recargas disponibles (docs/modelo-de-ingresos.md §3.3). El id es estable: va en la base. */
export const TOPUP_PACKS: readonly TopUpPack[] = [
  { id: "recarga-39", amountCents: 3_900, bonusCents: 0 },
  { id: "recarga-99", amountCents: 9_900, bonusCents: 495 },
  { id: "recarga-199", amountCents: 19_900, bonusCents: 1_990 },
];

export function topUpPack(id: string): TopUpPack | null {
  return TOPUP_PACKS.find((pack) => pack.id === id) ?? null;
}

/** Tope diario mínimo para patrocinar pruebas (centavos MXN). */
export const MIN_SPONSOR_DAILY_CAP_CENTS = 2_000;
export const MAX_SPONSOR_DAILY_CAP_CENTS = 500_000;

/** Cuántas pruebas compra un saldo al precio vigente (para mostrarlo; nunca para cobrar). */
export function tryOnsAffordable(balanceCents: number, priceCents: number): number {
  if (priceCents <= 0) return 0;
  return Math.max(0, Math.floor(balanceCents / priceCents));
}
