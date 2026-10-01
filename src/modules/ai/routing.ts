import { z } from "zod";
import type { AIFeature } from "@/generated/prisma/enums";
import { AI_PROVIDERS, type AIProviderConfig, type AIProviderId } from "@/server/env-schema";
import { AI_TASKS, type AITaskId } from "@/server/providers/ai/types";
import { maxCallCostMicrosUsd, modelPrice } from "./cost";

/** Clave del ajuste en `PlatformSetting` (ADR-034). */
export const AI_ROUTING_KEY = "ai.routing";

/**
 * Cambiar el modelo de una tarea es de riesgo MEDIO (plan-90-dias.md §2.4): la IA CEO solo lo
 * propone, con la evaluación como evidencia, y una persona ADMIN lo aplica. Lo decide el código.
 */
export const AI_ROUTING_RISK = "MEDIUM" as const;

/** Nombre de cada tarea en la interfaz y la función con que se registra y presupuesta. */
export const AI_TASK_INFO: Record<AITaskId, { label: string; feature: AIFeature }> = {
  sale_proposal: { label: "Propuesta de venta (Sube y vende)", feature: "SALE_PROPOSAL" },
  ad_copy: { label: "Kit de anuncios", feature: "CONTENT_GENERATION" },
  analyst_narrative: { label: "Analista de la plataforma", feature: "PLATFORM_ANALYSIS" },
  authenticity_text: { label: "Revisión de autenticidad", feature: "AUTHENTICITY_REVIEW" },
  shopping_intent: { label: "¿Qué necesitas? (interpretar)", feature: "SHOPPING_INTENT" },
  look_copy: { label: "Nombre y explicación del look", feature: "LOOK_COPY" },
  post_context: { label: "Contexto de publicaciones largas", feature: "POST_CONTEXT" },
  image_search: { label: "Búsqueda por foto (ve imágenes)", feature: "IMAGE_SEARCH" },
};

/**
 * Modelos que se pueden enrutar (lista blanca). Todos tienen precio en `cost.ts` (una prueba lo
 * exige) y, salvo el simulador, deben pasar su evaluación antes de usarse en una tarea. Agregar uno
 * es una decisión de código revisada, no un ajuste.
 */
export const ROUTABLE_MODELS = [
  { provider: "mock", model: "mock", label: "Simulado (sin costo; interruptor de apagado)" },
  {
    provider: "openai_compatible",
    model: "qwen/qwen3.5-9b",
    label: "Qwen3.5 9B · modelo abierto, pago por uso",
  },
  {
    provider: "openai_compatible",
    model: "anthropic/claude-haiku-4.5",
    label: "Claude Haiku 4.5 · referencia de calidad",
  },
  {
    provider: "openai_compatible",
    model: "google/gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash Lite · ve imágenes, pago por uso",
  },
] as const satisfies readonly { provider: AIProviderId; model: string; label: string }[];

export type AIRoute = { provider: AIProviderId; model: string };

export function isRoutable(route: AIRoute) {
  return ROUTABLE_MODELS.some(
    (option) => option.provider === route.provider && option.model === route.model,
  );
}

export function routeLabel(route: AIRoute) {
  return (
    ROUTABLE_MODELS.find(
      (option) => option.provider === route.provider && option.model === route.model,
    )?.label ?? route.model
  );
}

const routeSchema = z
  .object({ provider: z.enum(AI_PROVIDERS), model: z.string().min(1).max(128) })
  .strict()
  .refine(isRoutable, { message: "Modelo fuera de la lista permitida." })
  .refine((route) => maxCallCostMicrosUsd(route.model) !== null, {
    message: "Modelo sin precio configurado.",
  });

/** Ruta por tarea; una tarea sin ruta usa el proveedor y modelo de las variables de entorno. */
export const aiRoutingSchema = z
  .object({
    version: z.literal(1),
    tasks: z.partialRecord(z.enum(AI_TASKS), routeSchema),
  })
  .strict();

export type AIRouting = z.infer<typeof aiRoutingSchema>;

export const DEFAULT_AI_ROUTING: AIRouting = { version: 1, tasks: {} };

export type ResolvedRoute = AIRoute & {
  /** `routing`: la eligió `ai.routing`; `default`: variables de entorno; `fallback`: ver `reason`. */
  source: "routing" | "default" | "fallback";
  reason?: string;
};

/**
 * Proveedor y modelo de una tarea. Sin ruta, el de las variables de entorno. Una ruta a
 * `openai_compatible` sin servidor configurado (AI_PROVIDER=mock, sin llave) cae al simulador y lo
 * dice: nunca se llama a un servidor sin llave ni se inventa una configuración.
 */
export function resolveRoute(
  routing: AIRouting,
  task: AITaskId,
  config: AIProviderConfig,
): ResolvedRoute {
  const fromEnv: AIRoute =
    config.provider === "mock"
      ? { provider: "mock", model: "mock" }
      : { provider: "openai_compatible", model: config.model };
  const route = routing.tasks[task];
  if (!route) return { ...fromEnv, source: "default" };
  if (route.provider === "openai_compatible" && config.provider !== "openai_compatible") {
    return {
      provider: "mock",
      model: "mock",
      source: "fallback",
      reason: "La ruta pide un modelo de pago pero el servidor de IA no está configurado.",
    };
  }
  return { ...route, source: "routing" };
}

/** Precio por millón de tokens de una ruta (para mostrarlo), o `null` si no tiene. */
export function routePrice(route: AIRoute) {
  return modelPrice(route.model);
}

/** Valor nuevo del ajuste al cambiar la ruta de una tarea (`null` = volver a la predeterminada). */
export function withRoute(routing: AIRouting, task: AITaskId, route: AIRoute | null): AIRouting {
  const tasks = { ...routing.tasks };
  if (route) tasks[task] = route;
  else delete tasks[task];
  return { version: 1, tasks };
}

/** Lectura tolerante de un valor guardado de `ai.routing` (p. ej. el de una propuesta vieja). */
const storedRoutingSchema = z
  .object({
    tasks: z.record(
      z.string(),
      z.object({ provider: z.string(), model: z.string() }).loose().catch({
        provider: "",
        model: "",
      }),
    ),
  })
  .loose();

/**
 * Lo que propone una decisión de `ai.routing`: cada tarea que cambia entre el valor anterior y el
 * nuevo, con su ruta nueva (`null` = volver a la predeterminada). `null` si el valor nuevo no tiene
 * la forma esperada (no se puede saber qué propone).
 */
export function proposedRoutes(
  previousValue: unknown,
  newValue: unknown,
): { task: AITaskId; route: { provider: string; model: string } | null }[] | null {
  const after = storedRoutingSchema.safeParse(newValue);
  if (!after.success) return null;
  const before = storedRoutingSchema.safeParse(previousValue);
  const beforeTasks = before.success ? before.data.tasks : {};
  const key = (route: { provider: string; model: string } | undefined) =>
    route ? `${route.provider}|${route.model}` : "default";
  return AI_TASKS.flatMap((task) => {
    const next = after.data.tasks[task];
    if (key(beforeTasks[task]) === key(next)) return [];
    return [{ task, route: next ? { provider: next.provider, model: next.model } : null }];
  });
}

/**
 * ¿Una propuesta pendiente ya no cambiaría nada? Cada tarea que propone cambiar ya usa ese modelo
 * (la ruta de `ai.routing` o, sin ruta, el de las variables de entorno; una ruta que cae al
 * simulador porque falta el servidor no cuenta como «ya lo usa»). Se cierra sola (ADR-034).
 */
export function proposalIsStale(
  row: { previousValue: unknown; newValue: unknown },
  routing: AIRouting,
  config: AIProviderConfig,
): boolean {
  const changes = proposedRoutes(row.previousValue, row.newValue);
  if (!changes || changes.length === 0) return false;
  return changes.every(({ task, route }) => {
    if (route === null) return routing.tasks[task] === undefined;
    const current = resolveRoute(routing, task, config);
    return (
      current.source !== "fallback" &&
      current.provider === route.provider &&
      current.model === route.model
    );
  });
}
