import { z } from "zod";

/**
 * Modo de autonomía del motor de automejora (plan-90-dias.md §2.4). Vive en `PlatformSetting` (no en
 * una variable de entorno) para que el fundador lo cambie desde /admin/resumen y quede en la bitácora.
 *
 * - `observer` (por omisión): la IA solo propone; nada se aplica sin una persona.
 * - `low_risk`: lo de riesgo BAJO se aplica solo (con reversión automática) y lo de riesgo MEDIO se
 *   lanza como experimento al 10 %, ambos únicamente si se cumple el umbral de tráfico y fuera de los
 *   congelamientos. Lo de riesgo ALTO nunca se aplica solo.
 */
export const AUTONOMY_KEY = "platform.autonomy";

export const AUTONOMY_MODES = ["observer", "low_risk"] as const;
export type AutonomyMode = (typeof AUTONOMY_MODES)[number];

export const autonomySchema = z.object({
  version: z.literal(1),
  mode: z.enum(AUTONOMY_MODES),
});

export type AutonomySetting = z.infer<typeof autonomySchema>;

export const DEFAULT_AUTONOMY: AutonomySetting = { version: 1, mode: "observer" };

/** Valor guardado → modo (el valor por defecto, `observer`, si falta o no es válido). */
export function parseAutonomy(value: unknown): AutonomySetting {
  const parsed = autonomySchema.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_AUTONOMY;
}

export const AUTONOMY_LABELS: Record<AutonomyMode, string> = {
  observer: "Observador",
  low_risk: "Riesgo bajo",
};
