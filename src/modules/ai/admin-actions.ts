"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getAdminViewer } from "@/modules/admin/guard";
import { AdminAuthorizationError } from "@/modules/admin/service";
import { AI_PROVIDERS } from "@/server/env-schema";
import { AI_TASKS } from "@/server/providers/ai/types";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { changeAiRouting, discardAiRoutingProposal, RoutingChangeError } from "./routing-decisions";

export type RoutingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<"task" | "choice" | "reason", string[]>>;
  ok?: string;
};

const GENERIC_ERROR = "No se pudo guardar el cambio.";

const schema = z.object({
  task: z.enum(AI_TASKS, { error: "Elige una tarea." }),
  choice: z.union([
    z.literal("default"),
    z
      .string()
      .regex(/^[a-z_]+\|[A-Za-z0-9._:/@+-]{1,128}$/)
      .transform((value) => {
        const [provider, model] = value.split("|") as [string, string];
        return { provider, model };
      })
      .pipe(z.object({ provider: z.enum(AI_PROVIDERS), model: z.string() })),
  ]),
  reason: z
    .string()
    .trim()
    .min(10, "Explica en una frase por qué cambias el modelo (mínimo 10 caracteres).")
    .max(300, "Máximo 300 caracteres."),
});

/** Límite de acciones del equipo en /admin/ia (cambiar el modelo y descartar propuestas). */
async function adminLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("admin.ai-routing", "user", userId)!,
      limit: 20,
      windowSeconds: 60 * 60,
    }),
  );
}

/** /admin/ia: cambia el modelo de una tarea (ADMIN; queda como decisión HUMAN aplicada). */
export async function changeAiRoutingAction(
  _previous: RoutingFormState,
  formData: FormData,
): Promise<RoutingFormState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: GENERIC_ERROR };
  const limited = await adminLimit(admin.userId);
  if (limited) return { error: limited };

  const parsed = schema.safeParse({
    task: formData.get("task"),
    choice: formData.get("choice"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      fieldErrors: {
        ...fieldErrors,
        ...(fieldErrors.choice ? { choice: ["Elige un modelo de la lista."] } : {}),
      },
    };
  }

  try {
    const { task, choice, reason } = parsed.data;
    await changeAiRouting(admin.userId, {
      task,
      route: choice === "default" ? null : choice,
      reason,
    });
  } catch (error) {
    if (error instanceof RoutingChangeError) return { error: error.userMessage };
    if (error instanceof AdminAuthorizationError) return { error: GENERIC_ERROR };
    throw error;
  }
  revalidatePath("/admin/ia");
  return { ok: "Listo: el cambio se aplicó y quedó registrado como decisión." };
}

export type DiscardProposalState = {
  error?: string;
  fieldErrors?: Partial<Record<"reason", string[]>>;
  ok?: string;
};

const discardSchema = z.object({
  decisionId: z.uuid(),
  reason: z
    .string()
    .trim()
    .min(10, "Explica en una frase por qué la descartas (mínimo 10 caracteres).")
    .max(300, "Máximo 300 caracteres."),
});

/**
 * /admin/ia: descarta una propuesta de la IA para cambiar el modelo (vieja o que no se quiere
 * aplicar). Queda REJECTED con el motivo y quién la descartó; la ruta no cambia.
 */
export async function discardAiRoutingProposalAction(
  _previous: DiscardProposalState,
  formData: FormData,
): Promise<DiscardProposalState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: GENERIC_ERROR };
  const limited = await adminLimit(admin.userId);
  if (limited) return { error: limited };

  const parsed = discardSchema.safeParse({
    decisionId: formData.get("decisionId"),
    reason: formData.get("reason") ?? "",
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return fieldErrors.reason
      ? { fieldErrors: { reason: fieldErrors.reason } }
      : { error: GENERIC_ERROR };
  }

  try {
    await discardAiRoutingProposal(admin.userId, parsed.data);
  } catch (error) {
    if (error instanceof RoutingChangeError) return { error: error.userMessage };
    if (error instanceof AdminAuthorizationError) return { error: GENERIC_ERROR };
    throw error;
  }
  revalidatePath("/admin/ia");
  return { ok: "Listo: descartaste la propuesta. Quedó en la bitácora con tu motivo." };
}
