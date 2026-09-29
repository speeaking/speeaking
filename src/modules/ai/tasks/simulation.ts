import { z } from "zod";
import { AIProviderError } from "@/server/providers/ai/errors";

/**
 * IA simulada con vendedores reales (ADR-038). El simulador (`mock`) arma plantillas deterministas
 * sin ningún modelo: en desarrollo y pruebas es lo normal, pero en producción nadie debe creer que
 * lo escribió una IA.
 *
 * - `real`: un modelo de verdad; o desarrollo y pruebas, donde el simulador es lo esperado.
 * - `simulated`: producción con el simulador y `ALLOW_SIMULATED_AI=true` (un piloto cerrado). Cada
 *   texto se marca «Texto de ejemplo (IA simulada)», nunca «Creado con ayuda de IA».
 * - `unavailable`: producción con el simulador SIN esa bandera (p. ej. una ruta de `ai.routing` al
 *   simulador como interruptor de apagado). No se entregan plantillas: la función ofrece hacerlo a
 *   mano («Por ahora escribe tu anuncio a mano» en el kit, «Por ahora publica tu producto a mano» en
 *   Sube y vende), y si aun así se llama, el simulador falla (`simulatedOutput`).
 *
 * En las métricas, una salida simulada nunca cuenta como generación de IA, en ningún entorno
 * (`countsAsAiGeneration`).
 *
 * Sin `server-only`: lo importan los componentes (tipos y textos) y las tareas.
 */

export type AiAvailability = "real" | "simulated" | "unavailable";

/** Id del proveedor simulado (`AIProvider.id`, `AIRequest.provider`). */
export const SIMULATED_PROVIDER_ID = "mock";

export const AI_OUTPUT_LABEL = "Creado con ayuda de IA";
export const SIMULATED_OUTPUT_LABEL = "Texto de ejemplo (IA simulada)";
/** Salida a mano del kit de anuncios sin IA disponible. */
export const WRITE_BY_HAND = "Por ahora escribe tu anuncio a mano";
/** Salida a mano de «Sube y vende» sin IA disponible (la misma frase que su mensaje de error). */
export const PUBLISH_BY_HAND = "Por ahora publica tu producto a mano";

export type SimulationConfig = {
  NODE_ENV: string | undefined;
  ALLOW_SIMULATED_AI: boolean;
};

/** Disponibilidad de una tarea según su proveedor (`ResolvedRoute.provider`) y el entorno. */
export function availabilityOf(provider: string, config: SimulationConfig): AiAvailability {
  if (provider !== SIMULATED_PROVIDER_ID || config.NODE_ENV !== "production") return "real";
  return config.ALLOW_SIMULATED_AI ? "simulated" : "unavailable";
}

/**
 * ¿Un texto YA generado se marca como ejemplo? Se decide con el proveedor que lo escribió
 * (`AIRequest.provider`), no con la ruta de hoy: un kit que armó el simulador sigue siendo
 * «Texto de ejemplo (IA simulada)» aunque después se enrute la tarea a un modelo de verdad, y uno
 * que escribió un modelo sigue siendo «Creado con ayuda de IA» aunque hoy la ruta vaya al simulador.
 * En desarrollo y pruebas el simulador es lo normal (como en `availabilityOf`).
 */
export function isSimulatedOutput(provider: string, config: SimulationConfig): boolean {
  return availabilityOf(provider, config) !== "real";
}

/** ¿Una salida de este proveedor cuenta como generación de IA? Lo simulado, nunca. */
export function countsAsAiGeneration(provider: string | null | undefined): boolean {
  return provider !== SIMULATED_PROVIDER_ID;
}

/** `ALLOW_SIMULATED_AI` como la lee `serverEnvSchema` (`z.stringbool`, falso si falta o no vale). */
const flag = z.stringbool().catch(false).default(false);

/**
 * Configuración leída de `process.env` (no de `@/server/env`: las tareas también corren en scripts y
 * pruebas sin todas las variables del servidor).
 */
export function simulationConfigFromProcess(): SimulationConfig {
  return {
    NODE_ENV: process.env.NODE_ENV,
    ALLOW_SIMULATED_AI: flag.parse(process.env.ALLOW_SIMULATED_AI),
  };
}

/**
 * Envuelve la respuesta simulada de una tarea (`AITask.mock`): en producción sin
 * `ALLOW_SIMULATED_AI` el simulador no entrega plantillas y falla como un proveedor no disponible
 * (el servicio lo registra como error y la interfaz ofrece hacerlo a mano). Así, ni una página vieja
 * ni una llamada directa a la acción reciben texto falso presentado como de la IA.
 */
export function simulatedOutput<Input>(
  mock: (input: Input) => unknown,
  config: () => SimulationConfig = simulationConfigFromProcess,
): (input: Input) => unknown {
  return (input) => {
    if (availabilityOf(SIMULATED_PROVIDER_ID, config()) === "unavailable") {
      throw new AIProviderError(
        "unavailable",
        "[ai] IA simulada en producción sin ALLOW_SIMULATED_AI: no se entregan plantillas.",
      );
    }
    return mock(input);
  };
}
