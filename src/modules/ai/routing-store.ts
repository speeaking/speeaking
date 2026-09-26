import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { AI_ROUTING_KEY, type AIRouting, aiRoutingSchema, DEFAULT_AI_ROUTING } from "./routing";

/**
 * `ai.routing` validado. Si no existe o es inválido (un modelo que salió de la lista blanca, un
 * valor escrito a mano), se usa el predeterminado: cada tarea con el proveedor de las variables de
 * entorno. El sistema nunca llama a un modelo fuera de sus límites.
 */
export const getAiRouting = cache(async (): Promise<AIRouting> => {
  const row = await db.platformSetting.findUnique({
    where: { key: AI_ROUTING_KEY },
    select: { value: true },
  });
  if (!row) return DEFAULT_AI_ROUTING;
  const parsed = aiRoutingSchema.safeParse(row.value);
  if (!parsed.success) {
    console.error(`[ai] ajuste inválido "${AI_ROUTING_KEY}"; se usa el predeterminado`);
    return DEFAULT_AI_ROUTING;
  }
  return parsed.data;
});
