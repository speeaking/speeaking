import "server-only";
import { createHash } from "node:crypto";
import { recordedCost } from "@/modules/ai/cost";
import { AIError } from "@/modules/ai/errors";
import { isFeatureOn } from "@/modules/ai/features-store";
import { redactPersonalData } from "@/modules/ai/personal-data";
import { reserveAiRequest } from "@/modules/ai/reservation";
import { providerFailure, SERVICE_TIMEOUT_MS, withTimeout } from "@/modules/ai/service";
import { aiAvailability, simulatedRecord } from "@/modules/ai/tasks/availability";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { postVisibleTo } from "@/modules/relationships/privacy";
import { db } from "@/server/db";
import { getAIProvider } from "@/server/providers/ai";
import { canHaveContext, cleanSummary, contextTask } from "./post-context";

/**
 * Tope diario del gasto en «Contexto», sumando a todas las personas (ADR-060). Con el modelo de
 * texto de hoy un resumen cuesta ≈ US$0.00015: el tope alcanza para miles al día y, si se acaba,
 * el botón dice «inténtalo más tarde» en lugar de gastar de más.
 */
export const CONTEXT_DAILY_CAP_USD = 0.5;

export type PostContextResult =
  | { ok: true; summary: string; simulated: boolean; cached: boolean }
  | {
      ok: false;
      reason: "not_found" | "too_short" | "needs_auth" | "limited" | "unavailable" | "failed";
      message?: string;
    };

function bodyHash(body: string) {
  return createHash("sha256").update(body).digest("hex");
}

/**
 * El «Contexto» de una publicación: el guardado si el texto no cambió (gratis, para cualquiera) o
 * uno nuevo (solo con sesión, dentro del límite por persona, con la función encendida, la IA
 * disponible y el tope diario). El modelo solo recibe el texto de la publicación, sin datos de
 * contacto; el resumen se limpia antes de guardarse y se guarda para todos.
 */
export async function getPostContext(
  postId: string,
  viewerId: string | null,
  { checkLimit }: { checkLimit: () => Promise<{ ok: true } | { ok: false; error: string }> },
): Promise<PostContextResult> {
  const post = await db.post.findFirst({
    where: {
      id: postId,
      status: "PUBLISHED",
      AND: [POST_WITH_VISIBLE_PRODUCT, postVisibleTo(viewerId)],
    },
    select: {
      id: true,
      body: true,
      context: { select: { summary: true, bodyHash: true, provider: true } },
    },
  });
  if (!post) return { ok: false, reason: "not_found" };
  if (!canHaveContext(post.body)) return { ok: false, reason: "too_short" };
  const hash = bodyHash(post.body);
  if (post.context && post.context.bodyHash === hash) {
    return {
      ok: true,
      summary: post.context.summary,
      simulated: simulatedRecord(post.context.provider),
      cached: true,
    };
  }

  if (!viewerId) return { ok: false, reason: "needs_auth" };
  if (!(await isFeatureOn("postContext"))) return { ok: false, reason: "unavailable" };
  if ((await aiAvailability("post_context")) === "unavailable") {
    return { ok: false, reason: "unavailable" };
  }
  const limited = await checkLimit();
  if (!limited.ok) return { ok: false, reason: "limited", message: limited.error };

  const input = { text: redactPersonalData(post.body) };
  let provider;
  let requestId: string;
  try {
    provider = await getAIProvider("post_context");
    // Es de la publicación, no de quien la abre: sin cuota personal, dentro del presupuesto y del
    // tope diario de la función. Se guarda solo el id (el texto ya está en la publicación).
    ({ requestId } = await reserveAiRequest({
      userId: null,
      feature: "POST_CONTEXT",
      provider: {
        id: provider.id,
        model: provider.model,
        promptVersion: contextTask.promptVersion,
      },
      input: { postId: post.id },
      featureDailyCapMicros: Math.round(CONTEXT_DAILY_CAP_USD * 1_000_000),
    }));
  } catch (error) {
    if (error instanceof AIError) return { ok: false, reason: "unavailable" };
    throw error;
  }

  const started = Date.now();
  try {
    const result = await withTimeout(provider.generate(contextTask, input), SERVICE_TIMEOUT_MS);
    const summary = cleanSummary(result.output.summary);
    if (!summary) throw new Error("[contexto] el resumen quedó vacío al limpiarlo");
    const cost = recordedCost(provider.model, result.usage);
    const saved = {
      summary,
      bodyHash: hash,
      provider: provider.id,
      model: provider.model,
      promptVersion: contextTask.promptVersion,
      requestId,
    };
    await db.$transaction([
      db.aIResponse.create({
        data: {
          requestId,
          output: { summary },
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costMicrosUsd: cost.micros,
        },
      }),
      db.aIRequest.update({
        where: { id: requestId },
        data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
      }),
      db.postContext.upsert({
        where: { postId: post.id },
        create: { postId: post.id, ...saved },
        update: { ...saved, createdAt: new Date() },
      }),
    ]);
    return { ok: true, summary, simulated: simulatedRecord(provider.id), cached: false };
  } catch (error) {
    await db.aIRequest
      .update({
        where: { id: requestId },
        data: {
          status: "FAILED",
          errorCode: providerFailure(error),
          latencyMs: Date.now() - started,
        },
      })
      .catch(() => undefined);
    console.error("[contexto] no se pudo generar", error);
    return { ok: false, reason: "failed" };
  }
}
