import "server-only";
import { recordedCost } from "@/modules/ai/cost";
import { AIError } from "@/modules/ai/errors";
import { reserveAiRequest } from "@/modules/ai/reservation";
import { env } from "@/server/env";
import { getAIProvider } from "@/server/providers/ai";
import { AIProviderError } from "@/server/providers/ai/errors";
import type { AIProvider } from "@/server/providers/ai/types";
import { type AiSignalOutput, authenticityTextTask, type ListingText } from "./ai-signal";
import { recordAiFailure, recordAiSuccess } from "./queries";

/**
 * Corre la tarea `authenticity_text` con el guardián de presupuesto (ADR-031): reserva ANTES de
 * llamar como tarea del sistema (`userId: null`: no gasta la cuota de «Sube y vende» del vendedor,
 * sí el presupuesto global), valida la salida con su esquema y registra uso, costo y latencia en
 * `AIRequest`/`AIResponse`. Cualquier falla devuelve `null`: la señal es opcional y la revisión
 * sigue con las reglas.
 */
export type AiSignalRun = {
  output: AiSignalOutput;
  provider: string;
  model: string;
  promptVersion: string;
  requestId: string;
};

/** Proveedor y modelo de la tarea según `ai.routing` y las variables de entorno (runner común). */
export function authenticityProvider(): Promise<AIProvider> {
  return getAIProvider("authenticity_text");
}

export async function runAuthenticityTask(
  { productId, fingerprint, text }: { productId: string; fingerprint: string; text: ListingText },
  provider?: AIProvider,
): Promise<AiSignalRun | null> {
  const target = provider ?? (await authenticityProvider());
  const promptVersion = authenticityTextTask.promptVersion;
  // El simulado es una expresión regular, no un modelo: en producción no puede sumar riesgo (subiría
  // un producto a riesgo alto con una «IA» que no existe). Sin servidor de IA, no hay señal.
  if (target.id === "mock" && env.NODE_ENV === "production") {
    console.warn("[trust] señal de IA omitida: no hay servidor de IA configurado");
    return null;
  }

  let requestId: string;
  try {
    ({ requestId } = await reserveAiRequest({
      userId: null,
      feature: "AUTHENTICITY_REVIEW",
      provider: { id: target.id, model: target.model, promptVersion },
      // Solo referencias: el texto del vendedor no se copia al registro.
      input: { productId, fingerprint },
    }));
  } catch (error) {
    if (error instanceof AIError) {
      console.warn(`[trust] señal de IA omitida: ${error.code}`);
      return null;
    }
    throw error;
  }

  const started = Date.now();
  try {
    const result = await target.generate(authenticityTextTask, text);
    await recordAiSuccess(requestId, {
      output: result.output,
      inputTokens: result.usage.inputTokens,
      outputTokens: result.usage.outputTokens,
      costMicrosUsd: recordedCost(target.model, result.usage).micros,
      latencyMs: Date.now() - started,
    });
    return {
      output: result.output,
      provider: target.id,
      model: target.model,
      promptVersion,
      requestId,
    };
  } catch (error) {
    const invalid = error instanceof AIProviderError && error.kind === "invalid_output";
    await recordAiFailure(
      requestId,
      invalid ? "INVALID_OUTPUT" : "PROVIDER_ERROR",
      Date.now() - started,
    );
    console.warn(
      `[trust] la señal de IA falló: ${error instanceof AIProviderError ? error.kind : "error"}`,
    );
    return null;
  }
}
