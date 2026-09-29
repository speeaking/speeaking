import "server-only";
import { assertAdmin } from "@/modules/admin/service";
import { trailEntry, updateEvaluation } from "@/modules/ceo/decision-record";
import { db } from "@/server/db";
import {
  AI_FEATURES_KEY,
  type AiFeatureKey,
  aiFeatureChanges,
  aiFeatureDefinition,
  parseAiFeatures,
  withAiFeature,
} from "./features";

export class FeatureChangeError extends Error {
  override name = "FeatureChangeError";
  constructor(readonly userMessage: string) {
    super(userMessage);
  }
}

/**
 * Una persona ADMIN enciende o apaga una función de IA (ADR-043). Es una decisión de producto de
 * riesgo ALTO: nunca la aplica la IA ni el sistema; queda como `PlatformDecision` HUMAN APPLIED con
 * el valor anterior y el nuevo (reversible con otra decisión). Candado por ajuste.
 */
export async function setAiFeature(
  actorUserId: string,
  { key, enabled, reason }: { key: AiFeatureKey; enabled: boolean; reason: string },
  now = new Date(),
): Promise<{ decisionId: string | null; changed: boolean }> {
  await assertAdmin(actorUserId);
  const definition = aiFeatureDefinition(key);
  if (definition.status !== "built") {
    throw new FeatureChangeError(
      "Esa función todavía no existe en el código: no se puede encender.",
    );
  }
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`setting:${AI_FEATURES_KEY}`}, 0))`;
    const row = await tx.platformSetting.findUnique({
      where: { key: AI_FEATURES_KEY },
      select: { value: true, version: true },
    });
    const previous = parseAiFeatures(row?.value);
    const next = withAiFeature(previous, key, enabled);
    const changes = aiFeatureChanges(previous, next);
    if (changes.length === 0) return { decisionId: null, changed: false };

    await tx.platformSetting.upsert({
      where: { key: AI_FEATURES_KEY },
      create: { key: AI_FEATURES_KEY, value: next, version: 1, updatedBy: "HUMAN" },
      update: { value: next, version: (row?.version ?? 0) + 1, updatedBy: "HUMAN" },
    });
    const title = `${enabled ? "Encender" : "Apagar"} «${definition.label}»`;
    const decision = await tx.platformDecision.create({
      data: {
        actor: "HUMAN",
        kind: "ai.features",
        title,
        hypothesis: reason,
        settingKey: AI_FEATURES_KEY,
        previousValue: previous,
        newValue: next,
        riskLevel: "HIGH",
        status: "APPLIED",
        reason,
        approvedById: actorUserId,
        decidedAt: now,
        appliedAt: now,
        evaluation: updateEvaluation(null, {
          trail: [trailEntry("applied", "HUMAN", now, { userId: actorUserId, note: reason })],
        }),
      },
      select: { id: true },
    });
    return { decisionId: decision.id, changed: true };
  });
}
