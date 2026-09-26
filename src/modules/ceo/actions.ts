"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminViewer } from "@/modules/admin/guard";
import { AUTONOMY_MODES } from "@/modules/platform/autonomy";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import {
  approveDecision,
  type CeoActionResult,
  changeAutonomyMode,
  rejectDecision,
  revertDecision,
  startExperimentAsAdmin,
  stopExperimentAsAdmin,
} from "./service";

/**
 * Acciones del área /admin del motor de automejora. Cada una: `getAdminViewer()` (a quien no es ADMIN
 * se le responde un error genérico, como a una ruta inexistente), Zod en la entrada, límite de
 * frecuencia por persona (`admin.<acción>:user:<uuid>`) y el servicio, que vuelve a verificar el rol.
 */

export type CeoFormState = { ok?: boolean; message?: string; error?: string };

const GENERIC_ERROR = "No encontramos lo que buscas.";
const WINDOW_SECONDS = 10 * 60;

const noteSchema = z
  .string()
  .trim()
  .max(300, "La nota puede tener hasta 300 caracteres.")
  .optional()
  .transform((value) => (value ? value : undefined));

const decisionSchema = z.object({ decisionId: z.uuid(), note: noteSchema });
const experimentSchema = z.object({ experimentId: z.uuid(), note: noteSchema });
const autonomySchema = z.object({ mode: z.enum(AUTONOMY_MODES) });

async function authorize(action: string, limit: number) {
  const admin = await getAdminViewer();
  if (!admin) return { error: GENERIC_ERROR } as const;
  const key = rateLimitKey(`admin.${action}`, "user", admin.userId);
  if (!key) return { error: GENERIC_ERROR } as const;
  const limited = limitOrError(await rateLimit({ key, limit, windowSeconds: WINDOW_SECONDS }));
  if (limited) return { error: limited } as const;
  return { userId: admin.userId } as const;
}

function field(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

function toState(result: CeoActionResult): CeoFormState {
  if (!result.ok) return { ok: false, error: result.error };
  for (const path of ["/admin", "/admin/resumen", "/admin/decisiones", "/admin/experimentos"]) {
    revalidatePath(path);
  }
  return { ok: true, message: result.message };
}

async function decisionAction(
  action: "approve" | "reject" | "revert",
  formData: FormData,
): Promise<CeoFormState> {
  const auth = await authorize(`decision.${action}`, 30);
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = decisionSchema.safeParse({
    decisionId: field(formData, "decisionId"),
    note: field(formData, "note"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { decisionId, note } = parsed.data;
  const run = { approve: approveDecision, reject: rejectDecision, revert: revertDecision }[action];
  return toState(await run(auth.userId, decisionId, note));
}

export async function approveDecisionAction(_state: CeoFormState, formData: FormData) {
  return decisionAction("approve", formData);
}

export async function rejectDecisionAction(_state: CeoFormState, formData: FormData) {
  return decisionAction("reject", formData);
}

export async function revertDecisionAction(_state: CeoFormState, formData: FormData) {
  return decisionAction("revert", formData);
}

async function experimentAction(action: "start" | "stop", formData: FormData) {
  const auth = await authorize(`experiment.${action}`, 20);
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = experimentSchema.safeParse({
    experimentId: field(formData, "experimentId"),
    note: field(formData, "note"),
  });
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  }
  const { experimentId, note } = parsed.data;
  return toState(
    action === "start"
      ? await startExperimentAsAdmin(auth.userId, experimentId)
      : await stopExperimentAsAdmin(auth.userId, experimentId, note),
  );
}

export async function startExperimentAction(_state: CeoFormState, formData: FormData) {
  return experimentAction("start", formData);
}

export async function stopExperimentAction(_state: CeoFormState, formData: FormData) {
  return experimentAction("stop", formData);
}

export async function setAutonomyAction(
  _state: CeoFormState,
  formData: FormData,
): Promise<CeoFormState> {
  const auth = await authorize("autonomy", 10);
  if ("error" in auth) return { ok: false, error: auth.error };
  const parsed = autonomySchema.safeParse({ mode: field(formData, "mode") });
  if (!parsed.success) return { ok: false, error: "Modo de autonomía inválido." };
  return toState(await changeAutonomyMode(auth.userId, parsed.data.mode));
}
