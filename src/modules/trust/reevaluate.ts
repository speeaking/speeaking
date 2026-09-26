import "server-only";
import type { AuthenticityStatus, RiskLevel } from "@/generated/prisma/enums";
import * as q from "./queries";
import { RULES_VERSION } from "./rules";
import { type CheckOutcome, refreshAuthenticityCheck } from "./service";

/**
 * Reevaluación en lote de las revisiones de autenticidad hechas con otra versión de las reglas
 * (`RULES_VERSION`, P14). La corre `scripts/trust-reevaluate.ts` (`pnpm trust:reevaluate`) después de
 * cambiar pesos o reglas.
 *
 * - Usa el mismo `refreshAuthenticityCheck` que el alta, la edición y los reportes: serializado por
 *   producto, y las decisiones del equipo no se deshacen solas: un «Comprobante revisado» con el
 *   mismo riesgo o menor se conserva sin reescribirse (`frozen`); si el puntaje nuevo sube, vuelve a
 *   la cola (o a AUTO_CLEAR) como en cualquier reevaluación y se cuenta en `statusChanges`.
 * - Idempotente: lo reevaluado queda con la versión vigente y ya no aparece en la siguiente corrida;
 *   lo congelado se vuelve a revisar y vuelve a quedar igual (no escribe nada).
 * - Por tandas (paginación por llave sobre `productId`), un producto a la vez. Un error en uno no
 *   detiene el resto: se reporta.
 * - `dryRun`: calcula lo mismo sin guardar nada, así la simulación ya dice qué cambiaría (p. ej.
 *   cuántos «Comprobante revisado» volverían a la cola).
 * - `includeUnchecked`: evalúa también los productos que nunca tuvieron revisión (la evaluación falló
 *   al guardarlos o son anteriores al motor). Sin la opción solo se cuentan.
 */

export type OutdatedCheck = {
  productId: string;
  rulesVersion: string;
  status: AuthenticityStatus;
  riskLevel: RiskLevel;
};

export type ReevaluateDeps = {
  listOutdated: (
    rulesVersion: string,
    afterProductId: string | null,
    take: number,
  ) => Promise<OutdatedCheck[]>;
  /** Ids de productos sin revisión después de `afterProductId`. */
  listUnchecked: (afterProductId: string | null, take: number) => Promise<string[]>;
  refresh: (productId: string, now: Date, dryRun: boolean) => Promise<CheckOutcome | null>;
  countWithoutCheck: () => Promise<number>;
};

export type ReevaluateOptions = {
  dryRun?: boolean;
  batchSize?: number;
  now?: Date;
  rulesVersion?: string;
  includeUnchecked?: boolean;
};

export type ReevaluateSummary = {
  rulesVersion: string;
  dryRun: boolean;
  /** Revisiones con otra versión de las reglas al empezar (por versión). */
  outdated: number;
  byVersion: Record<string, number>;
  /** Guardadas con la versión vigente (con `dryRun`: las que se guardarían). */
  reevaluated: number;
  /** «Comprobante revisado» que se conserva (el equipo ya decidió; nada se reescribe). */
  frozen: number;
  /** El producto se borró mientras tanto. */
  missing: number;
  failed: { productId: string; error: string }[];
  /** Cambios de estado de la revisión («NEEDS_PROOF → AUTO_CLEAR», «sin revisión → AUTO_CLEAR»). */
  statusChanges: Record<string, number>;
  /** Cambios de nivel de riesgo («HIGH → MEDIUM», «sin revisión → LOW»). */
  levelChanges: Record<string, number>;
  /** Productos sin ninguna revisión al empezar. */
  withoutCheck: number;
  /** Productos sin revisión evaluados por primera vez (solo con `includeUnchecked`). */
  firstEvaluated: number;
};

export const DEFAULT_BATCH_SIZE = 50;
export const MAX_BATCH_SIZE = 500;
const NO_CHECK = "sin revisión";

const defaultDeps: ReevaluateDeps = {
  listOutdated: (version, after, take) => q.listOutdatedChecks(version, after, take),
  listUnchecked: (after, take) => q.listProductsWithoutCheck(after, take),
  refresh: (productId, now, dryRun) => refreshAuthenticityCheck(productId, now, { dryRun }),
  countWithoutCheck: () => q.countProductsWithoutCheck(),
};

function bump(counts: Record<string, number>, key: string) {
  counts[key] = (counts[key] ?? 0) + 1;
}

export async function reevaluateOutdatedChecks(
  {
    dryRun = false,
    batchSize = DEFAULT_BATCH_SIZE,
    now = new Date(),
    rulesVersion = RULES_VERSION,
    includeUnchecked = false,
  }: ReevaluateOptions = {},
  deps: ReevaluateDeps = defaultDeps,
): Promise<ReevaluateSummary> {
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > MAX_BATCH_SIZE) {
    throw new RangeError(`El tamaño de tanda debe ser un entero entre 1 y ${MAX_BATCH_SIZE}.`);
  }
  const summary: ReevaluateSummary = {
    rulesVersion,
    dryRun,
    outdated: 0,
    byVersion: {},
    reevaluated: 0,
    frozen: 0,
    missing: 0,
    failed: [],
    statusChanges: {},
    levelChanges: {},
    withoutCheck: await deps.countWithoutCheck(),
    firstEvaluated: 0,
  };

  /** Reevalúa un producto; `previous` es su revisión (`null` si nunca tuvo). */
  async function evaluate(
    productId: string,
    previous: Pick<OutdatedCheck, "status" | "riskLevel"> | null,
  ) {
    let outcome: CheckOutcome | null;
    try {
      outcome = await deps.refresh(productId, now, dryRun);
    } catch (error) {
      summary.failed.push({
        productId,
        error: error instanceof Error ? error.message : String(error),
      });
      return;
    }
    if (!outcome) {
      summary.missing += 1;
      return;
    }
    if (!previous) {
      summary.firstEvaluated += 1;
      bump(summary.statusChanges, `${NO_CHECK} → ${outcome.status}`);
      bump(summary.levelChanges, `${NO_CHECK} → ${outcome.level}`);
      return;
    }
    // Sin congelar, un «Comprobante revisado» nunca sigue igual (`nextCheckStatus`): si sigue, el
    // equipo ya decidió y no se reescribió nada.
    if (previous.status === "VERIFIED_BY_ADMIN" && outcome.status === "VERIFIED_BY_ADMIN") {
      summary.frozen += 1;
      return;
    }
    summary.reevaluated += 1;
    if (outcome.status !== previous.status) {
      bump(summary.statusChanges, `${previous.status} → ${outcome.status}`);
    }
    if (outcome.level !== previous.riskLevel) {
      bump(summary.levelChanges, `${previous.riskLevel} → ${outcome.level}`);
    }
  }

  let after: string | null = null;
  for (;;) {
    const batch = await deps.listOutdated(rulesVersion, after, batchSize);
    for (const check of batch) {
      summary.outdated += 1;
      bump(summary.byVersion, check.rulesVersion);
      await evaluate(check.productId, check);
    }
    if (batch.length < batchSize) break;
    after = batch.at(-1)!.productId;
  }

  if (includeUnchecked) {
    let afterId: string | null = null;
    for (;;) {
      const ids = await deps.listUnchecked(afterId, batchSize);
      for (const productId of ids) await evaluate(productId, null);
      if (ids.length < batchSize) break;
      afterId = ids.at(-1)!;
    }
  }
  return summary;
}
