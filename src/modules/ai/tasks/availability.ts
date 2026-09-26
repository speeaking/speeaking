import "server-only";
import { env } from "@/server/env";
import { getAIRoute } from "@/server/providers/ai";
import type { AITaskId } from "@/server/providers/ai/types";
import { AIError } from "../errors";
import {
  type AiAvailability,
  availabilityOf,
  isSimulatedOutput,
  type SimulationConfig,
} from "./simulation";

function serverSimulationConfig(): SimulationConfig {
  return { NODE_ENV: env.NODE_ENV, ALLOW_SIMULATED_AI: env.ALLOW_SIMULATED_AI };
}

/**
 * Disponibilidad vigente de una tarea para la interfaz (`simulation.ts`): con la ruta de
 * `ai.routing` (o las variables de entorno) y la bandera `ALLOW_SIMULATED_AI`.
 */
export async function aiAvailability(task: AITaskId): Promise<AiAvailability> {
  const route = await getAIRoute(task);
  return availabilityOf(route.provider, serverSimulationConfig());
}

/**
 * Para los servicios, ANTES de reservar: sin IA disponible (producción con el simulador y sin
 * `ALLOW_SIMULATED_AI`) lanza `AIError("UNAVAILABLE")`, así la persona no gasta su cuota en una
 * llamada que no le daría nada y la interfaz le ofrece hacerlo a mano.
 */
export async function assertAiAvailable(task: AITaskId): Promise<AiAvailability> {
  const availability = await aiAvailability(task);
  if (availability === "unavailable") throw new AIError("UNAVAILABLE");
  return availability;
}

/**
 * Modo con que se redacta un error de IA (`aiErrorMessage`). Solo el de cuota cambia en un piloto
 * con la IA simulada («usos», no «generaciones con IA»), así que solo entonces se lee la ruta. Si esa
 * lectura falla, el mensaje de siempre: un error al redactar un error no debe volverse un 500.
 */
export async function aiErrorMode(error: AIError, task: AITaskId): Promise<"real" | "simulated"> {
  if (error.code !== "QUOTA_EXCEEDED") return "real";
  try {
    return (await aiAvailability(task)) === "simulated" ? "simulated" : "real";
  } catch (cause) {
    console.error("[ai] no se pudo leer la ruta para redactar el error", cause);
    return "real";
  }
}

/** ¿El texto guardado de este proveedor (`AIRequest.provider`) se marca como ejemplo? */
export function simulatedRecord(provider: string): boolean {
  return isSimulatedOutput(provider, serverSimulationConfig());
}
