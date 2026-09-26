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

export const getFeedPolicy = cache(() =>
  readSetting(FEED_POLICY_KEY, feedPolicySchema, DEFAULT_FEED_POLICY),
);

export const getAiBudget = cache(() =>
  readSetting(AI_BUDGET_KEY, aiBudgetSchema, DEFAULT_AI_BUDGET),
);

export const getCommerceFees = cache(() =>
  readSetting(COMMERCE_FEES_KEY, commerceFeesSchema, DEFAULT_COMMERCE_FEES),
);
