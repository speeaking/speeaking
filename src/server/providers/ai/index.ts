import "server-only";
import { type AIRoute, resolveRoute, type ResolvedRoute } from "@/modules/ai/routing";
import { getAiRouting } from "@/modules/ai/routing-store";
import { env } from "@/server/env";
import { type AIProviderConfig, aiProviderConfig } from "@/server/env-schema";
import { MockAIProvider } from "./mock";
import { OpenAICompatibleProvider } from "./openai-compatible";
import type { AIProvider, AITaskId } from "./types";

const instances = new Map<string, AIProvider>();

/**
 * Instancia (reutilizada) del proveedor de una ruta. `openai_compatible` usa el servidor y la llave
 * de las variables de entorno (`AI_BASE_URL`, `AI_API_KEY`) con el modelo de la ruta.
 */
export function providerForRoute(
  route: AIRoute,
  config: AIProviderConfig = aiProviderConfig(env),
): AIProvider {
  const key = `${route.provider}:${route.model}`;
  const existing = instances.get(key);
  if (existing) return existing;
  let provider: AIProvider;
  if (route.provider === "mock") {
    provider = new MockAIProvider();
  } else if (config.provider === "openai_compatible") {
    provider = new OpenAICompatibleProvider({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      model: route.model,
    });
  } else {
    throw new Error("[ai] no hay servidor de IA configurado (AI_PROVIDER=mock).");
  }
  instances.set(key, provider);
  return provider;
}

/** Ruta vigente de una tarea: `ai.routing` o, sin ruta, las variables de entorno (ADR-034). */
export async function getAIRoute(task: AITaskId): Promise<ResolvedRoute> {
  return resolveRoute(await getAiRouting(), task, aiProviderConfig(env));
}

/**
 * Proveedor de IA para una tarea (`sale_proposal`, `ad_copy`, `analyst_narrative`,
 * `authenticity_text`). Con AI_PROVIDER=mock y sin rutas, el simulador. Uso:
 *
 *   const provider = await getAIProvider("ad_copy");
 *   await reserveAiRequest({ ..., provider: { id: provider.id, model: provider.model, promptVersion: task.promptVersion } });
 *   const { output, usage } = await provider.generate(task, input);
 */
export async function getAIProvider(task: AITaskId): Promise<AIProvider> {
  const route = await getAIRoute(task);
  if (route.source === "fallback") console.error(`[ai] ${task}: ${route.reason}`);
  return providerForRoute(route);
}

export { AIProviderError } from "./errors";
export type { AIMessages, AIProvider, AIResult, AITask, AITaskId, AIUsage } from "./types";
