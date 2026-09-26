/**
 * Economía unitaria (regla P2 / ADR-006): todas las cifras financieras se calculan aquí, con
 * enteros en centavos. La IA solo recibe estos resultados para explicarlos.
 */

const MAX_CENTS = 1_000_000_000; // $10 M MXN por valor

function assertCents(value: number, name: string) {
  if (!Number.isInteger(value) || value < 0 || value > MAX_CENTS) {
    throw new RangeError(`${name} debe ser un entero de centavos entre 0 y ${MAX_CENTS}`);
  }
}

/** Porcentaje en puntos base (1 % = 100 bps) aplicado a centavos, redondeado al centavo. */
function applyBps(cents: number, bps: number) {
  return Math.round((cents * bps) / 10_000);
}

export type UnitEconomicsInput = {
  priceCents: number;
  unitCostCents: number;
  /** Comisión de la plataforma en puntos base. */
  platformFeeBps?: number;
  /** Comisión del procesador de pago en puntos base (estimada). */
  paymentFeeBps?: number;
};

export type UnitEconomics = {
  priceCents: number;
  unitCostCents: number;
  grossMarginCents: number;
  grossMarginPercent: number;
  platformFeeCents: number;
  paymentFeeCents: number;
  netMarginCents: number;
  netMarginPercent: number;
  isLoss: boolean;
};

export function unitEconomics({
  priceCents,
  unitCostCents,
  platformFeeBps = 0,
  paymentFeeBps = 0,
}: UnitEconomicsInput): UnitEconomics {
  assertCents(priceCents, "priceCents");
  assertCents(unitCostCents, "unitCostCents");
  const grossMarginCents = priceCents - unitCostCents;
  const platformFeeCents = applyBps(priceCents, platformFeeBps);
  const paymentFeeCents = applyBps(priceCents, paymentFeeBps);
  const netMarginCents = grossMarginCents - platformFeeCents - paymentFeeCents;
  const percentOf = (value: number) => (priceCents === 0 ? 0 : (value / priceCents) * 100);

  return {
    priceCents,
    unitCostCents,
    grossMarginCents,
    grossMarginPercent: percentOf(grossMarginCents),
    platformFeeCents,
    paymentFeeCents,
    netMarginCents,
    netMarginPercent: percentOf(netMarginCents),
    isLoss: netMarginCents < 0,
  };
}

/** Ventas necesarias para recuperar un gasto (p. ej. publicidad). `null` si no hay margen. */
export function breakEvenUnits({
  spendCents,
  netMarginCents,
}: {
  spendCents: number;
  netMarginCents: number;
}): number | null {
  if (spendCents <= 0) return 0;
  if (netMarginCents <= 0) return null;
  return Math.ceil(spendCents / netMarginCents);
}

/**
 * "$3,499.50" → 349950 centavos. Acepta comas de miles y espacios; rechaza negativos, más de 2
 * decimales y montos irreales. Devuelve null si no es válido.
 */
export function parsePesosToCents(input: string): number | null {
  const normalized = input.replace(/[\s$,]/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null;
  const [whole = "0", fraction = ""] = normalized.split(".");
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : null;
}

/** 349950 → "3499.50" y 349900 → "3499": el inverso de `parsePesosToCents` para prellenar campos. */
export function centsToPesosInput(cents: number): string {
  assertCents(cents, "cents");
  const whole = Math.floor(cents / 100);
  const fraction = cents % 100;
  return fraction === 0 ? String(whole) : `${whole}.${String(fraction).padStart(2, "0")}`;
}
