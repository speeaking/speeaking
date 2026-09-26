import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import type { GuardrailEvaluation } from "./guardrails";
import type { ThresholdAssessment } from "./threshold";

/**
 * Forma de `PlatformDecision.evaluation` (JSON escrito solo por código):
 * - `analysis`: qué detector la generó, con qué día y cifras (calculadas por código, P2);
 * - `narrative`: el texto explicativo (plantilla o IA, marcado como tal; la IA solo redacta);
 * - `threshold`: el umbral de tráfico al decidir;
 * - `guardrails`: la última evaluación de salvaguardas;
 * - `trail`: bitácora de cada paso (quién, qué, cuándo). Toda acción queda registrada (ADR-019).
 */

export const TRAIL_ACTIONS = [
  "proposed",
  "held",
  "approved",
  "rejected",
  "applied",
  "auto_applied",
  "reverted",
  "auto_reverted",
  "experiment_started",
  "experiment_stopped",
  "experiment_concluded",
  "monitor_closed",
] as const;

export type TrailAction = (typeof TRAIL_ACTIONS)[number];

const trailEntrySchema = z.object({
  at: z.string(),
  actor: z.enum(["AI", "HUMAN", "SYSTEM"]),
  action: z.enum(TRAIL_ACTIONS),
  userId: z.string().optional(),
  note: z.string().max(900).optional(),
});

export type TrailEntry = z.infer<typeof trailEntrySchema>;

const factValue = z.union([z.number(), z.string(), z.boolean(), z.null()]);

/**
 * Lectura tolerante: una parte con otra forma (p. ej. escrita por otro módulo que comparte la tabla)
 * se ignora al mostrar, sin tirar el resto; las entradas de bitácora inválidas se omiten una por una.
 */
const evaluationSchema = z
  .object({
    analysis: z
      .object({
        day: z.string(),
        detector: z.string(),
        facts: z.record(z.string(), factValue),
      })
      .optional()
      .catch(undefined),
    narrative: z
      .object({
        source: z.enum(["template", "ai"]),
        text: z.string().max(4000),
        model: z.string().max(128).optional(),
      })
      .optional()
      .catch(undefined),
    threshold: z.unknown().optional(),
    guardrails: z.unknown().optional(),
    trail: z
      .array(z.unknown())
      .catch([])
      .default([])
      .transform((entries) =>
        entries.flatMap((entry) => {
          const parsed = trailEntrySchema.safeParse(entry);
          return parsed.success ? [parsed.data] : [];
        }),
      ),
  })
  .loose();

export type DecisionEvaluation = z.infer<typeof evaluationSchema>;

export function parseEvaluation(value: unknown): DecisionEvaluation {
  const parsed = evaluationSchema.safeParse(value ?? {});
  return parsed.success ? parsed.data : { trail: [] };
}

export function trailEntry(
  action: TrailAction,
  actor: TrailEntry["actor"],
  now: Date,
  extra: { userId?: string | null; note?: string | null } = {},
): TrailEntry {
  return {
    at: now.toISOString(),
    actor,
    action,
    ...(extra.userId ? { userId: extra.userId } : {}),
    ...(extra.note ? { note: extra.note.slice(0, 900) } : {}),
  };
}

/**
 * Nueva evaluación con cambios y entradas de bitácora agregadas. Parte de lo GUARDADO, no de la
 * lectura tolerante: nada de lo anterior se pierde (ni lo que tenga otra forma, p. ej. escrito por
 * otro módulo); solo se agregan entradas a la bitácora y se reemplazan umbral y salvaguardas.
 */
export function updateEvaluation(
  current: unknown,
  changes: {
    trail?: TrailEntry[];
    threshold?: ThresholdAssessment;
    guardrails?: GuardrailEvaluation;
  },
): Prisma.InputJsonValue {
  const base: Record<string, unknown> =
    current === null || current === undefined
      ? {}
      : typeof current === "object" && !Array.isArray(current)
        ? { ...(current as Record<string, unknown>) }
        : { previous: current };
  const trail = Array.isArray(base.trail) ? (base.trail as unknown[]) : [];
  if (base.trail !== undefined && !Array.isArray(base.trail)) base.previousTrail = base.trail;
  return JSON.parse(
    JSON.stringify({
      ...base,
      ...(changes.threshold ? { threshold: changes.threshold } : {}),
      ...(changes.guardrails ? { guardrails: changes.guardrails } : {}),
      trail: [...trail, ...(changes.trail ?? [])],
    }),
  ) as Prisma.InputJsonValue;
}
