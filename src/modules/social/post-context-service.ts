import "server-only";
import { createHash } from "node:crypto";
import { AIError } from "@/modules/ai/errors";
import { isFeatureOn } from "@/modules/ai/features-store";
import { redactPersonalData } from "@/modules/ai/personal-data";
import { aiAvailability, simulatedRecord } from "@/modules/ai/tasks/availability";
import { POST_WITH_VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { postVisibleTo } from "@/modules/relationships/privacy";
import { db } from "@/server/db";
import { getAIProvider } from "@/server/providers/ai";
import { generateFullContext } from "./context-generation";
import { canHaveContext, contextTask } from "./post-context";

/** Incluye todas las partes y la síntesis final, sin modificar el presupuesto de la función. */
export { CONTEXT_DAILY_CAP_USD } from "./context-generation";

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

  let provider;
  try {
    provider = await getAIProvider("post_context");
  } catch (error) {
    if (error instanceof AIError) return { ok: false, reason: "unavailable" };
    throw error;
  }

  try {
    const { summary, requestId } = await generateFullContext(
      provider,
      post.id,
      redactPersonalData(post.body),
    );
    // Una lectura larga puede coincidir con una eliminación o un cambio de privacidad.
    const stillVisible = await db.post.findFirst({
      where: {
        id: post.id,
        body: post.body,
        status: "PUBLISHED",
        AND: [POST_WITH_VISIBLE_PRODUCT, postVisibleTo(viewerId)],
      },
      select: { id: true },
    });
    if (!stillVisible) return { ok: false, reason: "not_found" };
    const saved = {
      summary,
      bodyHash: hash,
      provider: provider.id,
      model: provider.model,
      promptVersion: contextTask.promptVersion,
      requestId,
    };
    // Las respuestas de todos los pasos ya están contabilizadas por generateFullContext.
    await db.postContext.upsert({
      where: { postId: post.id },
      create: { postId: post.id, ...saved },
      update: { ...saved, createdAt: new Date() },
    });
    return { ok: true, summary, simulated: simulatedRecord(provider.id), cached: false };
  } catch (error) {
    console.error("[contexto] no se pudo generar el contexto completo", {
      code: error instanceof AIError ? error.code : "GENERATION_FAILED",
    });
    return { ok: false, reason: error instanceof AIError ? "unavailable" : "failed" };
  }
}
