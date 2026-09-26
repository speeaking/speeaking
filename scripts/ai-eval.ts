/**
 * Evalúa un modelo en una tarea de IA con casos ficticios (ADR-033 #9, ADR-034) y guarda el
 * resultado en `AIEvalRun` y un reporte en `.data/evals/`. Cada llamada pasa por el presupuesto
 * global de IA (función MODEL_EVALUATION) y queda registrada con su costo.
 *
 * Uso:
 *   pnpm ai:eval --task sale_proposal                    con AI_PROVIDER / AI_DEFAULT_MODEL del .env
 *   pnpm ai:eval --task ad_copy --model qwen/qwen3.5-9b --confirm-spend
 *   pnpm ai:eval --task ad_copy --provider mock          sin red ni costo
 *   ... --limit 5                                        solo los primeros N casos (no concluyente)
 *
 * El modelo corre en un servidor EXTERNO de pago por uso (AI_BASE_URL); nada se instala en la PC.
 * Con un proveedor de pago hay que pasar --confirm-spend: el script dice antes el costo máximo.
 * Sale con 0 si el modelo aprueba, 2 si no aprueba y 1 si hubo un error.
 */
import "dotenv/config";
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { parseEnv } from "../src/lib/env/parse-env";
import { readAiBudget, reserveBudget } from "../src/modules/ai/budget-ledger";
import { maxCallCostMicrosUsd, recordedCost } from "../src/modules/ai/cost";
import {
  adCopyCaseSchema,
  parseCases,
  saleProposalCaseSchema,
} from "../src/modules/ai/evals/cases";
import { formatUsdMicros, evalReport } from "../src/modules/ai/evals/report";
import { EVAL_TASK_FEATURE, type EvalTask, runEval } from "../src/modules/ai/evals/runner";
import { adCopyTask } from "../src/modules/ai/tasks/ad-copy";
import { saleProposalTask } from "../src/modules/ai/tasks/sale-proposal";
import { createPrismaClient } from "../src/server/db-client";
import { aiProviderConfig, serverEnvSchema } from "../src/server/env-schema";
import { MockAIProvider } from "../src/server/providers/ai/mock";
import { OpenAICompatibleProvider } from "../src/server/providers/ai/openai-compatible";
import type { AIProvider } from "../src/server/providers/ai/types";

class UsageError extends Error {}

const TASKS: Record<EvalTask, { file: string; promptVersion: string }> = {
  sale_proposal: {
    file: "evals/sale-proposal.jsonl",
    promptVersion: saleProposalTask.promptVersion,
  },
  ad_copy: { file: "evals/ad-copy.jsonl", promptVersion: adCopyTask.promptVersion },
};

function parseArgs(argv: string[]) {
  const args: {
    task?: EvalTask;
    model?: string;
    provider?: string;
    limit?: number;
    confirm: boolean;
  } = {
    confirm: false,
  };
  for (let index = 0; index < argv.length; index++) {
    const flag = argv[index];
    const value = () => {
      const next = argv[++index];
      if (!next || next.startsWith("--")) throw new UsageError(`Falta el valor de ${flag}.`);
      return next;
    };
    switch (flag) {
      case "--task": {
        const task = value();
        if (!(task in TASKS))
          throw new UsageError(`--task debe ser: ${Object.keys(TASKS).join(", ")}.`);
        args.task = task as EvalTask;
        break;
      }
      case "--model":
        args.model = value();
        break;
      case "--provider":
        args.provider = value();
        break;
      case "--limit":
        args.limit = Number(value());
        if (!Number.isInteger(args.limit) || args.limit < 1)
          throw new UsageError("--limit debe ser ≥ 1.");
        break;
      case "--confirm-spend":
        args.confirm = true;
        break;
      default:
        throw new UsageError(`Opción desconocida: ${flag}`);
    }
  }
  if (!args.task) throw new UsageError("Falta --task (sale_proposal o ad_copy).");
  return args as typeof args & { task: EvalTask };
}

function buildProvider(
  args: ReturnType<typeof parseArgs>,
  env: ReturnType<typeof loadEnv>,
): AIProvider {
  const config = aiProviderConfig(env);
  const wanted = args.provider ?? config.provider;
  if (wanted === "mock") return new MockAIProvider();
  if (wanted !== "openai_compatible")
    throw new UsageError("--provider debe ser mock u openai_compatible.");
  if (config.provider !== "openai_compatible") {
    throw new UsageError(
      "Para evaluar un modelo real configura AI_PROVIDER=openai_compatible, AI_BASE_URL y AI_API_KEY.",
    );
  }
  return new OpenAICompatibleProvider({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    model: args.model ?? config.model,
  });
}

function loadEnv() {
  return parseEnv(serverEnvSchema, process.env);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const env = loadEnv();
  const provider = buildProvider(args, env);
  const { file, promptVersion } = TASKS[args.task];
  const jsonl = readFileSync(path.resolve(file), "utf8");
  const all =
    args.task === "sale_proposal"
      ? parseCases(jsonl, saleProposalCaseSchema)
      : parseCases(jsonl, adCopyCaseSchema);
  const cases = args.limit ? all.slice(0, args.limit) : all;
  // Con qué casos se evaluó: una corrida parcial queda NO APROBADA (no sirve como evidencia).
  const suite = { total: all.length, sha256: createHash("sha256").update(jsonl).digest("hex") };
  if (cases.length < all.length) {
    console.warn(`Corrida parcial (${cases.length} de ${all.length}): no concluyente, no aprueba.`);
  }

  const perCall = maxCallCostMicrosUsd(provider.model);
  if (perCall === null) {
    throw new UsageError(
      `El modelo ${provider.model} no tiene precio: agrégalo en src/modules/ai/cost.ts (sin precio no se llama).`,
    );
  }
  const maxCost = perCall * cases.length;
  console.warn(
    `→ ${args.task} · ${provider.id} · ${provider.model} · ${cases.length} casos · costo máximo ${formatUsdMicros(maxCost)}`,
  );
  if (provider.id !== "mock" && !args.confirm) {
    throw new UsageError(
      "Esto llama a un modelo de pago. Repite con --confirm-spend para continuar.",
    );
  }

  const db = createPrismaClient(env.DATABASE_URL);
  try {
    const [budget, categories] = await Promise.all([
      readAiBudget(db),
      db.category.findMany({
        orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
        select: { slug: true, name: true },
      }),
    ]);
    const startedAt = new Date();
    const { results, metrics } = await runEval(
      args.task,
      cases,
      {
        provider,
        categories,
        beforeCall: async (caseId) => {
          const reserved = await reserveBudget(db, {
            userId: null,
            feature: "MODEL_EVALUATION",
            target: { id: provider.id, model: provider.model, promptVersion },
            input: { kind: "eval", task: args.task, caseId },
            budget,
          });
          if (!reserved.ok)
            throw new UsageError("Se acabó el presupuesto de IA del mes; la corrida se detuvo.");
          return reserved.requestId;
        },
        afterCall: async (requestId, outcome) => {
          if (!requestId) return;
          const status = outcome.ok ? "SUCCEEDED" : "FAILED";
          await db.$transaction([
            ...(outcome.ok && outcome.usage
              ? [
                  db.aIResponse.create({
                    data: {
                      requestId,
                      output: { kind: "eval", task: args.task },
                      inputTokens: outcome.usage.inputTokens,
                      outputTokens: outcome.usage.outputTokens,
                      costMicrosUsd: recordedCost(provider.model, outcome.usage).micros,
                    },
                  }),
                ]
              : []),
            db.aIRequest.update({
              where: { id: requestId },
              data: { status, errorCode: outcome.errorCode ?? null, latencyMs: outcome.latencyMs },
            }),
          ]);
        },
      },
      suite,
    );

    await db.aIEvalRun.create({
      data: {
        provider: provider.id,
        model: provider.model,
        promptVersion,
        task: EVAL_TASK_FEATURE[args.task],
        cases: metrics.cases,
        passed: metrics.passed,
        metrics,
        costMicrosUsd: metrics.costMicros,
      },
    });

    const folder = path.resolve(".data/evals");
    mkdirSync(folder, { recursive: true });
    const stamp = startedAt.toISOString().replace(/[:.]/g, "-");
    const report = path.join(
      folder,
      `${args.task}-${provider.model.replace(/[^a-z0-9.-]+/gi, "_")}-${stamp}.md`,
    );
    writeFileSync(
      report,
      evalReport({
        metrics,
        results,
        provider: provider.id,
        model: provider.model,
        promptVersion,
        startedAt,
        casesFile: file,
      }),
    );

    console.warn(
      `${metrics.gate.approved ? "✓ APROBADO" : "✗ NO APROBADO"} · ${metrics.passed}/${metrics.cases} casos · ${formatUsdMicros(metrics.costMicros)}`,
    );
    for (const reason of metrics.gate.reasons) console.warn(`  - ${reason}`);
    console.warn(`Reporte: ${path.relative(process.cwd(), report)}`);
    process.exitCode = metrics.gate.approved ? 0 : 2;
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof UsageError ? error.message : error);
  process.exitCode = 1;
});
