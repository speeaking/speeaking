import type { CaseResult, EvalMetrics } from "./runner";

/** Micro-dólares → «US$0.0005» (sin redondear a 0 lo que costó algo). */
export function formatUsdMicros(micros: number) {
  const usd = micros / 1_000_000;
  if (micros === 0) return "US$0";
  if (usd >= 0.01) {
    return `US$${usd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return `US$${Number(usd.toPrecision(2)).toLocaleString("en-US", { maximumFractionDigits: 8 })}`;
}

function percent(part: number, total: number) {
  return total === 0 ? "—" : `${Math.round((part / total) * 100)} %`;
}

/**
 * Intervalo de Wilson al 95 % de una proporción (código, P2). Con muestras de ~30 casos el
 * intervalo es ancho: el reporte lo dice en lugar de presentar el porcentaje como exacto.
 */
export function wilsonInterval(successes: number, total: number, z = 1.96) {
  if (total === 0) return null;
  const p = successes / total;
  const z2 = z * z;
  const center = (p + z2 / (2 * total)) / (1 + z2 / total);
  const margin =
    (z * Math.sqrt((p * (1 - p)) / total + z2 / (4 * total * total))) / (1 + z2 / total);
  return { low: Math.max(0, center - margin), high: Math.min(1, center + margin) };
}

function interval(successes: number, total: number) {
  const bounds = wilsonInterval(successes, total);
  if (!bounds) return "";
  return `; IC 95 %: ${Math.floor(bounds.low * 100)}–${Math.ceil(bounds.high * 100)} %`;
}

/** Reporte en Markdown de una corrida (se guarda en `.data/evals/`). */
export function evalReport({
  metrics,
  results,
  provider,
  model,
  promptVersion,
  startedAt,
  casesFile,
}: {
  metrics: EvalMetrics;
  results: CaseResult[];
  provider: string;
  model: string;
  promptVersion: string;
  startedAt: Date;
  casesFile: string;
}) {
  const perCase = metrics.called ? Math.ceil(metrics.costMicros / metrics.called) : 0;
  const answered = metrics.called - metrics.providerErrors;
  const lines = [
    `# Evaluación de IA · ${metrics.task}`,
    "",
    `- Fecha: ${startedAt.toISOString()}`,
    `- Proveedor: \`${provider}\` · modelo: \`${model}\` · prompt: \`${promptVersion}\``,
    `- Casos: \`${casesFile}\` (ficticios, sin datos de personas reales): ${metrics.cases} de ${metrics.suite.total}${metrics.suite.sha256 ? ` · sha256 \`${metrics.suite.sha256.slice(0, 16)}\`` : ""}`,
    `- Veredicto: **${metrics.gate.approved ? "APROBADO" : "NO APROBADO"}**`,
    ...metrics.gate.reasons.map((reason) => `  - ${reason}`),
    "",
    "| Métrica | Resultado |",
    "| --- | --- |",
    `| Casos aprobados | ${metrics.passed} de ${metrics.cases} (${percent(metrics.passed, metrics.cases)}) |`,
    `| Llamadas al modelo | ${metrics.called} (errores del proveedor: ${metrics.providerErrors}) |`,
    `| JSON válido | ${metrics.jsonValid} de ${metrics.called - metrics.providerErrors} |`,
    `| Cifras inventadas (P2) | ${metrics.inventedNumbersCases} casos |`,
    `| Afirmaciones sin respaldo (P4) | ${metrics.unsupportedClaimsCases} casos |`,
    `| Urgencia inventada | ${metrics.urgencyCases} casos |`,
    `| Contacto o pago por fuera | ${metrics.contactCases} casos |`,
    `| Fuera de español | ${metrics.nonSpanishCases} casos |`,
    `| ${metrics.task === "sale_proposal" ? "Categoría correcta" : "Habla del producto"} | ${metrics.category.correct} de ${metrics.category.checked} (${percent(metrics.category.correct, metrics.category.checked)}${interval(metrics.category.correct, metrics.category.checked)}) |`,
    `| Política de productos | ${metrics.policy.correct} de ${metrics.policy.checked} |`,
    `| Frases que quitó el guardián | ${metrics.guardRemoved} |`,
    `| Latencia (mediana / máxima) | ${metrics.latencyMs.p50 ?? "—"} ms / ${metrics.latencyMs.max ?? "—"} ms |`,
    `| Tokens (entrada / salida) | ${metrics.tokens.input} / ${metrics.tokens.output}${metrics.tokens.estimated ? " (algunos estimados)" : ""} |`,
    `| Costo total | ${formatUsdMicros(metrics.costMicros)}${metrics.costKnown ? "" : " (cota: modelo sin precio)"} |`,
    `| Costo por llamada | ${formatUsdMicros(perCase)} |`,
    "",
    "## Casos que no pasaron",
    "",
  ];
  const failed = results.filter((result) => !result.passed);
  if (failed.length === 0) lines.push("Ninguno.");
  for (const result of failed) {
    lines.push(`- **${result.id}**: ${result.failures.join(" ")}`);
  }
  lines.push(
    "",
    "## Cómo leer estas cifras",
    "",
    answered > 0
      ? `- «0 casos» en un criterio no prueba que el modelo nunca falle: con ${answered} respuestas, la tasa real de ese error puede llegar a ≈ ${Math.ceil((3 / answered) * 100)} % (regla de tres, 95 %).`
      : "- El modelo no respondió ningún caso: no hay nada que medir.",
    "- El porcentaje de categoría es una estimación con su intervalo de confianza; con ~30 casos no distingue un 85 % de un 95 %.",
    "- Para enrutar un modelo cuentan TODAS sus corridas completas de los últimos 30 días con este prompt: basta una reprobada para no aprobarlo. Repetir la corrida hasta que salga aprobada no sirve.",
    "",
    "_Las cifras de este reporte las calcula el código. El guardián limpia en producción lo que el modelo escribe mal; esta evaluación mide al modelo ANTES del guardián._",
    "",
  );
  return lines.join("\n");
}
