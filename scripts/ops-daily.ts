/**
 * Operación diaria del motor de automejora, desde la terminal (en producción la dispara Vercel Cron
 * con `/api/cron/daily`). Corre, cada paso con su `JobRun`:
 *   métricas diarias → experimentos → salvaguardas → analista → checkouts vencidos →
 *   imágenes huérfanas → retención de entradas de IA.
 * Es idempotente: se puede volver a correr sin duplicar nada.
 *
 * Uso: `pnpm ops:daily [--engine-only]` (= `tsx --conditions=react-server scripts/ops-daily.ts`).
 * `--engine-only` corre solo el motor (métricas, experimentos, salvaguardas y analista). La condición
 * `react-server` hace que los módulos de servidor (`server-only`) carguen fuera de Next.
 */
import "dotenv/config";

async function main() {
  const { runScheduledDailyPipeline } = await import("../src/modules/ceo/scheduled");
  const { db } = await import("../src/server/db");
  try {
    const engineOnly = process.argv.includes("--engine-only");
    const summary = await runScheduledDailyPipeline({ engineOnly });
    if (summary.skipped) {
      console.warn("Ya había una ejecución en curso; esta se omitió.");
      return;
    }
    console.warn(`Operación diaria (métricas hasta el ${summary.day}):`);
    for (const [step, result] of Object.entries(summary.steps)) {
      const detail = result.ok
        ? JSON.stringify("reason" in result ? result.reason : result.summary)
        : result.error;
      console.warn(`  ${result.ok ? "✓" : "✗"} ${step}: ${detail}`);
      if (!result.ok) process.exitCode = 1;
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
