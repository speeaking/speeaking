import { createHash } from "node:crypto";
import { z } from "zod";
import type { FeedPolicy } from "@/modules/feed/policy";
import { getTunable, readTunable, withTunable } from "./tunables";

/**
 * Asignación a experimentos (plan-90-dias.md §2.4): estable POR PERSONA, sin tabla de asignaciones.
 * El cubo es un hash de la llave del experimento y la persona, así que la misma persona cae siempre en
 * la misma variante de ese experimento y en variantes independientes de otros. Quien no tiene sesión
 * se queda en control (no se puede medir por persona y no se le cambia nada).
 */

export type Variant = "control" | "treatment";

/** Número en [0, 1) derivado de SHA-256(llave + persona). */
export function assignmentBucket(experimentKey: string, userId: string): number {
  const digest = createHash("sha256")
    .update(`speeaking:experiment:v1|${experimentKey}|${userId.toLowerCase()}`)
    .digest();
  return digest.readUInt32BE(0) / 0x1_0000_0000;
}

export function assignVariant(
  experimentKey: string,
  userId: string | null | undefined,
  allocation: number,
): Variant {
  if (!userId) return "control";
  return assignmentBucket(experimentKey, userId) < allocation ? "treatment" : "control";
}

/** `Experiment.variants`: el valor del parámetro en cada grupo (validado con el catálogo). */
export const experimentVariantsSchema = z.object({
  control: z.number().finite(),
  treatment: z.number().finite(),
});

export type ExperimentVariants = z.infer<typeof experimentVariantsSchema>;

export type RunningExperiment = {
  key: string;
  settingKey: string;
  variants: unknown;
  allocation: number;
};

/**
 * Política del feed para una persona: la base con el valor de tratamiento de cada experimento en
 * curso al que la persona quedó asignada. Un experimento con datos inválidos se ignora (la persona
 * ve la base), igual que uno cuyo control ya no es el valor vigente (p. ej. se revirtió el ajuste
 * mientras corría: su tratamiento podría quedar a más de un paso del valor real). El resultado se
 * valida con el esquema: nunca se opera fuera de los límites.
 */
export function resolveFeedPolicy(
  base: FeedPolicy,
  experiments: readonly RunningExperiment[],
  viewerId: string | null | undefined,
): FeedPolicy {
  if (!viewerId) return base;
  let policy = base;
  for (const { tunable, treatment, variant } of applicable(base, experiments, viewerId)) {
    if (variant !== "treatment") continue;
    policy = withTunable(policy, tunable, treatment) ?? policy;
  }
  return policy;
}

/**
 * Variante de cada experimento en curso que de verdad aplica a la persona: los mismos que usa
 * `resolveFeedPolicy` (datos válidos y control igual al valor vigente). Se registra con la impresión
 * visible (T5) para auditar qué vio cada quien. Sin sesión, ninguno (control, sin medirse).
 */
export function feedExperimentAssignments(
  base: FeedPolicy,
  experiments: readonly RunningExperiment[],
  viewerId: string | null | undefined,
): { key: string; variant: Variant }[] {
  if (!viewerId) return [];
  return applicable(base, experiments, viewerId).map(({ experiment, variant }) => ({
    key: experiment.key,
    variant,
  }));
}

function applicable(base: FeedPolicy, experiments: readonly RunningExperiment[], viewerId: string) {
  return experiments.flatMap((experiment) => {
    const tunable = getTunable(experiment.settingKey);
    const variants = experimentVariantsSchema.safeParse(experiment.variants);
    if (!tunable || !variants.success) return [];
    if (readTunable(base, tunable) !== variants.data.control) return [];
    const variant = assignVariant(experiment.key, viewerId, experiment.allocation);
    return [{ experiment, tunable, treatment: variants.data.treatment, variant }];
  });
}
