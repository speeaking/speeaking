import "server-only";
import { cache } from "react";
import type { z } from "zod";
import { AI_BUDGET_KEY, aiBudgetSchema, DEFAULT_AI_BUDGET } from "@/modules/ai/budget";
import {
  COMMERCE_FEES_KEY,
  commerceFeesSchema,
  DEFAULT_COMMERCE_FEES,
} from "@/modules/commerce/fees";
import { DEFAULT_FEED_POLICY, FEED_POLICY_KEY, feedPolicySchema } from "@/modules/feed/policy";
import { db } from "@/server/db";
import { AUTONOMY_KEY, autonomySchema, DEFAULT_AUTONOMY } from "./autonomy";
import { feedExperimentAssignments, resolveFeedPolicy } from "./experiments";

/**
 * Lee un ajuste de plataforma y lo valida con su esquema. Si no existe o es inválido (p. ej. un
 * cambio fuera de límites), usa el valor por defecto: el sistema nunca opera fuera de sus límites.
 */
async function readSetting<T>(key: string, schema: z.ZodType<T>, fallback: T): Promise<T> {
  const row = await db.platformSetting.findUnique({ where: { key }, select: { value: true } });
  if (!row) return fallback;
  const parsed = schema.safeParse(row.value);
  if (!parsed.success) {
    console.error(`[platform] ajuste inválido "${key}"; se usa el valor por defecto`);
    return fallback;
  }
  return parsed.data;
}

const getBaseFeedPolicy = cache(() =>
  readSetting(FEED_POLICY_KEY, feedPolicySchema, DEFAULT_FEED_POLICY),
);

/** Experimentos en curso sobre la política del feed (uno por petición, sin importar el viewer). */
const getRunningFeedExperiments = cache(() =>
  db.experiment.findMany({
    where: { status: "RUNNING", settingKey: { startsWith: `${FEED_POLICY_KEY}.` } },
    select: { key: true, settingKey: true, variants: true, allocation: true },
    orderBy: { startedAt: "asc" },
  }),
);

/**
 * Política del feed para quien ve (motor de automejora): la vigente, con el valor de tratamiento de
 * cada experimento en curso al que la persona quedó asignada (hash estable por persona). Sin sesión,
 * siempre la vigente (control).
 */
export const getFeedPolicy = cache(async (viewerId: string | null = null) => {
  const base = await getBaseFeedPolicy();
  if (!viewerId) return base;
  return resolveFeedPolicy(base, await getRunningFeedExperiments(), viewerId);
});

/**
 * Variante de cada experimento del feed en curso que aplica a la persona (la misma que decide
 * `getFeedPolicy`). Sin sesión, ninguna.
 */
export const getFeedExperimentAssignments = cache(async (viewerId: string | null = null) => {
  if (!viewerId) return [];
  return feedExperimentAssignments(
    await getBaseFeedPolicy(),
    await getRunningFeedExperiments(),
    viewerId,
  );
});

export const getAiBudget = cache(() =>
  readSetting(AI_BUDGET_KEY, aiBudgetSchema, DEFAULT_AI_BUDGET),
);

export const getCommerceFees = cache(() =>
  readSetting(COMMERCE_FEES_KEY, commerceFeesSchema, DEFAULT_COMMERCE_FEES),
);

/** Modo de autonomía del motor de automejora (`observer` por omisión). */
export const getAutonomy = cache(() => readSetting(AUTONOMY_KEY, autonomySchema, DEFAULT_AUTONOMY));
