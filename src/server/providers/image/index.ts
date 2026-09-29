import "server-only";
import { type AiAvailability, availabilityOf } from "@/modules/ai/tasks/simulation";
import { env } from "@/server/env";
import { MockImageProvider } from "./mock";
import { OpenAICompatibleImageProvider } from "./openai-compatible-image";
import type { ImageProvider } from "./types";

let instance: ImageProvider | undefined;

/**
 * Proveedor de imágenes activo (ADR-043): con `AI_PROVIDER=openai_compatible` y `AI_IMAGE_MODEL`,
 * el adaptador sobre el mismo servidor y llave de texto; si no, el simulador. No hay enrutador por
 * tarea todavía: un solo modelo de imagen (cambiarlo es una variable de entorno).
 */
export function getImageProvider(): ImageProvider {
  instance ??= createProvider();
  return instance;
}

function createProvider(): ImageProvider {
  if (env.AI_PROVIDER === "openai_compatible" && env.AI_IMAGE_MODEL) {
    if (!env.AI_BASE_URL || !env.AI_API_KEY) {
      throw new Error("Configuración de IA incompleta para openai_compatible.");
    }
    return new OpenAICompatibleImageProvider({
      baseUrl: env.AI_BASE_URL,
      apiKey: env.AI_API_KEY,
      model: env.AI_IMAGE_MODEL,
    });
  }
  return new MockImageProvider();
}

/**
 * Disponibilidad de la generación de imágenes (misma regla que el texto, ADR-038): en producción
 * el simulador solo con `ALLOW_SIMULATED_AI=true`; sin eso, «no disponible» y la interfaz no ofrece
 * generar ni gasta cuota.
 */
export function imageAvailability(): AiAvailability {
  return availabilityOf(getImageProvider().id, {
    NODE_ENV: env.NODE_ENV,
    ALLOW_SIMULATED_AI: env.ALLOW_SIMULATED_AI,
  });
}

export type { ImageInput, ImageProvider, ImageResult, ImageTask, ImageUsage } from "./types";
