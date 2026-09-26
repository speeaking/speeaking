/**
 * Reevalúa las revisiones de autenticidad hechas con otra versión de las reglas (`RULES_VERSION` en
 * `src/modules/trust/rules.ts`, P14). Córrelo después de cambiar pesos, umbrales o reglas.
 *
 * Usa el mismo `refreshAuthenticityCheck` que el alta, la edición y los reportes: serializado por
 * producto. Un «Comprobante revisado» con el mismo riesgo o menor se conserva; si las reglas nuevas
 * suben su puntaje, vuelve a la cola como en cualquier reevaluación (sale en «Cambios de estado»; la
 * simulación lo anticipa). Idempotente: se puede volver a correr; lo ya reevaluado no se toca.
 *
 * Uso: `pnpm trust:reevaluate [--dry-run] [--batch-size=50] [--include-unchecked]`
 *   (= `tsx --conditions=react-server scripts/trust-reevaluate.ts`; la condición `react-server` hace
 *   que los módulos de servidor (`server-only`) carguen fuera de Next).
 *   --dry-run            calcula lo mismo sin escribir: dice qué cambiaría.
 *   --batch-size=N       revisiones por tanda (1–500; por omisión 50).
 *   --include-unchecked  evalúa también los productos que nunca tuvieron revisión (sin la opción,
 *                        solo se cuentan).
 */
import "dotenv/config";

function parseArgs(argv: readonly string[]) {
  let dryRun = false;
  let includeUnchecked = false;
  let batchSize: number | undefined;
  for (const arg of argv) {
    if (arg === "--dry-run") dryRun = true;
    else if (arg === "--include-unchecked") includeUnchecked = true;
    else if (arg.startsWith("--batch-size=")) batchSize = Number(arg.slice("--batch-size=".length));
    else throw new Error(`Opción desconocida: ${arg}`);
  }
  return { dryRun, includeUnchecked, batchSize };
}

function formatCounts(counts: Record<string, number>) {
  const entries = Object.entries(counts);
  return entries.length === 0
    ? "ninguno"
    : entries.map(([key, count]) => `${key}: ${count}`).join(", ");
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const { reevaluateOutdatedChecks } = await import("../src/modules/trust/reevaluate");
  const { db } = await import("../src/server/db");
  try {
    const summary = await reevaluateOutdatedChecks(options);
    const header = summary.dryRun
      ? "Simulación (no se escribió nada; lo de abajo es lo que cambiaría)"
      : "Reevaluación";
    console.warn(`${header} con las reglas ${summary.rulesVersion}:`);
    console.warn(
      `  Revisiones con otra versión: ${summary.outdated} (${formatCounts(summary.byVersion)})`,
    );
    console.warn(`  ✓ Reevaluadas: ${summary.reevaluated}`);
    console.warn(`  Comprobante revisado que se conserva: ${summary.frozen}`);
    console.warn(
      options.includeUnchecked
        ? `  Productos sin revisión: ${summary.withoutCheck} (evaluados por primera vez: ${summary.firstEvaluated})`
        : `  Productos sin revisión (no se tocan; --include-unchecked los evalúa): ${summary.withoutCheck}`,
    );
    console.warn(`  Productos que ya no existen: ${summary.missing}`);
    console.warn(`  Cambios de estado: ${formatCounts(summary.statusChanges)}`);
    console.warn(`  Cambios de riesgo: ${formatCounts(summary.levelChanges)}`);
    if (summary.failed.length > 0) {
      console.error(`  ✗ Fallaron ${summary.failed.length}:`, summary.failed);
      process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
