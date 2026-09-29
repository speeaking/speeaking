import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import {
  AI_FEATURES_KEY,
  type AiFeatureKey,
  type AiFeaturesSetting,
  DEFAULT_AI_FEATURES,
  isAiFeatureEnabled,
  parseAiFeatures,
} from "./features";

/** `ai.features` validado (o el predeterminado), una lectura por petición. */
export const getAiFeatures = cache(async (): Promise<AiFeaturesSetting> => {
  const row = await db.platformSetting.findUnique({
    where: { key: AI_FEATURES_KEY },
    select: { value: true },
  });
  if (!row) return DEFAULT_AI_FEATURES;
  const parsed = parseAiFeatures(row.value);
  if (parsed === DEFAULT_AI_FEATURES && row.value !== null) {
    console.error(`[ai] ajuste inválido "${AI_FEATURES_KEY}"; se usa el predeterminado`);
  }
  return parsed;
});

/** ¿La función está encendida? (ADR-043). */
export async function isFeatureOn(key: AiFeatureKey): Promise<boolean> {
  return isAiFeatureEnabled(await getAiFeatures(), key);
}

export class FeatureDisabledError extends Error {
  override name = "FeatureDisabledError";
  constructor(readonly feature: AiFeatureKey) {
    super(`La función ${feature} está apagada.`);
  }
}

/** Para los servicios: lanza si la función está apagada (la interfaz ya no debería llegar aquí). */
export async function requireFeature(key: AiFeatureKey): Promise<void> {
  if (!(await isFeatureOn(key))) throw new FeatureDisabledError(key);
}
