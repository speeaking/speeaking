import "server-only";
import { recordedCost } from "@/modules/ai/cost";
import { reserveAiRequest } from "@/modules/ai/reservation";
import { providerFailure, SERVICE_TIMEOUT_MS, withTimeout } from "@/modules/ai/service";
import { db } from "@/server/db";
import type { AIProvider } from "@/server/providers/ai/types";
import { cleanSummary, contextTask, splitContextText } from "./post-context";

/** Todas las partes y la síntesis final consumen los mismos presupuestos diario y mensual. */
export const CONTEXT_DAILY_CAP_USD = 0.5;
const CONTEXT_TOTAL_TIMEOUT_MS = 180_000;
const CONTEXT_CONCURRENCY = 3;
type GeneratedContext = { summary: string; requestId: string };

/** Una llamada acotada y reservada: también los pasos intermedios quedan contabilizados. */
async function summarizePart({
  provider,
  postId,
  text,
  merging,
  part,
  deadline,
}: {
  provider: AIProvider;
  postId: string;
  text: string;
  merging: boolean;
  part: number;
  deadline: number;
}): Promise<GeneratedContext> {
  if (Date.now() >= deadline) throw new Error("ContextDeadlineExceeded");
  const { requestId } = await reserveAiRequest({
    userId: null,
    feature: "POST_CONTEXT",
    provider: { id: provider.id, model: provider.model, promptVersion: contextTask.promptVersion },
    // Nunca registrar el original ni los datos de contacto.
    input: { postId, part, merging },
    featureDailyCapMicros: Math.round(CONTEXT_DAILY_CAP_USD * 1_000_000),
  });
  const started = Date.now();
  try {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("ContextDeadlineExceeded");
    const result = await withTimeout(
      provider.generate(contextTask, { text, merging }),
      Math.min(SERVICE_TIMEOUT_MS, remaining),
    );
    const summary = cleanSummary(result.output.summary);
    if (!summary) throw new Error("EmptyContextSummary");
    const cost = recordedCost(provider.model, result.usage);
    await db.$transaction([
      db.aIResponse.create({
        data: {
          requestId,
          output: { summary },
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costMicrosUsd: cost.micros,
        },
      }),
      db.aIRequest.update({
        where: { id: requestId },
        data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
      }),
    ]);
    return { summary, requestId };
  } catch (error) {
    await db.aIRequest
      .update({
        where: { id: requestId },
        data: {
          status: "FAILED",
          errorCode: providerFailure(error),
          latencyMs: Date.now() - started,
        },
      })
      .catch(() => undefined);
    throw error;
  }
}

/** Lee todas las partes, en orden, y combina sus resúmenes. Un fallo no produce contexto parcial. */
export async function generateFullContext(
  provider: AIProvider,
  postId: string,
  redactedText: string,
): Promise<GeneratedContext> {
  const deadline = Date.now() + CONTEXT_TOTAL_TIMEOUT_MS;
  let text = redactedText;
  let merging = false;
  let part = 0;

  while (true) {
    const parts = splitContextText(text);
    if (parts.length === 0) throw new Error("EmptyContextInput");
    const results: GeneratedContext[] = [];
    for (let offset = 0; offset < parts.length; offset += CONTEXT_CONCURRENCY) {
      const settled = await Promise.allSettled(
        parts
          .slice(offset, offset + CONTEXT_CONCURRENCY)
          .map((text) =>
            summarizePart({ provider, postId, text, merging, part: part++, deadline }),
          ),
      );
      // Todas las llamadas iniciadas terminan y se contabilizan antes de devolver un fallo.
      for (const result of settled) {
        if (result.status === "rejected") throw result.reason;
        results.push(result.value);
      }
    }
    if (results.length === 1) return results[0]!;
    // Todos los fragmentos entran en orden. Si aún son muchos, se reduce otra ronda.
    text = results.map((result) => result.summary).join("\n\n");
    merging = true;
  }
}
