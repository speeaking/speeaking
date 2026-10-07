"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { z } from "zod";
import { getAdminViewer } from "@/modules/admin/guard";
import { AdminAuthorizationError } from "@/modules/admin/service";
import { getViewer } from "@/modules/identity/session";
import { verifyTurnstile } from "@/modules/identity/turnstile";
import { RIGHTS_TURNSTILE_ACTION } from "./constants";
import { checkRightsLimit } from "./limits";
import { counterNoticeInputSchema, noticeInputSchema, rightsAdminActionSchema } from "./schemas";
import { applyRightsAction, RightsError, submitCounterNotice, submitNotice } from "./service";

/** Campos de texto que el formulario vuelve a llenar si algo falta (las casillas nunca). */
const NOTICE_TEXT_FIELDS = [
  "kind",
  "claimantName",
  "claimantEmail",
  "claimantAltEmail",
  "claimantPhone",
  "claimantDomicile",
  "claimantRole",
  "principalName",
  "trademarkRegistration",
  "workDescription",
  "rightDescription",
  "facts",
  "urls",
] as const;

type FieldErrors = Partial<Record<string, string[]>>;

export type NoticeFormState = {
  ok?: boolean;
  /** Uno por cada cuenta que subió lo señalado; casi siempre, uno. */
  caseNumbers?: number[];
  emailSent?: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Partial<Record<(typeof NOTICE_TEXT_FIELDS)[number], string>>;
};

function text(formData: FormData, name: string): string | undefined {
  const value = formData.get(name);
  return typeof value === "string" ? value : undefined;
}

/**
 * Aviso de derechos desde /derechos-de-autor#aviso. Funciona sin cuenta: límite por IP antes de
 * todo (cada intento cuenta), después por correo de quien avisa, y Turnstile si está configurado.
 */
export async function submitNoticeAction(
  _previous: NoticeFormState,
  formData: FormData,
): Promise<NoticeFormState> {
  const values = Object.fromEntries(
    NOTICE_TEXT_FIELDS.map((name) => [name, text(formData, name) ?? ""]),
  ) as NoticeFormState["values"];
  const requestHeaders = await headers();
  const limitedIp = await checkRightsLimit("noticeIp", requestHeaders);
  if (limitedIp) return { error: limitedIp, values };

  const parsed = noticeInputSchema.safeParse({
    ...Object.fromEntries(NOTICE_TEXT_FIELDS.map((name) => [name, text(formData, name)])),
    swornStatement: text(formData, "swornStatement"),
    penaltyAcknowledged: text(formData, "penaltyAcknowledged"),
  });
  if (!parsed.success) {
    return {
      error: "Revisa los campos marcados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      values,
    };
  }

  const limitedEmail = await checkRightsLimit(
    "noticeEmail",
    requestHeaders,
    parsed.data.claimantEmail,
  );
  if (limitedEmail) return { error: limitedEmail, values };
  const verificationError = await verifyTurnstile(
    formData,
    requestHeaders,
    RIGHTS_TURNSTILE_ACTION,
  );
  if (verificationError) return { error: verificationError, values };

  const viewer = await getViewer();
  const notice = await submitNotice(parsed.data, { submittedById: viewer?.userId ?? null });
  revalidatePath("/admin/avisos");
  return {
    ok: true,
    caseNumbers: notice.cases.map((item) => item.number),
    emailSent: notice.emailSent,
  };
}

export type CounterNoticeFormState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: FieldErrors;
  values?: Partial<Record<"name" | "email" | "domicile" | "basis" | "explanation", string>>;
};

const COUNTER_ERRORS: Partial<Record<RightsError["code"], string>> = {
  NOT_FOUND: "No encontramos este caso en tu cuenta. Entra con la cuenta que subió el contenido.",
  ALREADY_FILED: "Ya recibimos tu contra-aviso para este caso.",
  NOT_REMOVED_YET:
    "Todavía no retiramos nada por este aviso. Si lo hacemos, te avisaremos y podrás mandar tu contra-aviso.",
  CLOSED: "Este caso ya está cerrado: no hace falta un contra-aviso.",
};

/** Contra-aviso de quien subió el contenido retirado (con su sesión). */
export async function submitCounterNoticeAction(
  _previous: CounterNoticeFormState,
  formData: FormData,
): Promise<CounterNoticeFormState> {
  const values = {
    name: text(formData, "name") ?? "",
    email: text(formData, "email") ?? "",
    domicile: text(formData, "domicile") ?? "",
    basis: text(formData, "basis") ?? "",
    explanation: text(formData, "explanation") ?? "",
  };
  const viewer = await getViewer();
  if (!viewer) return { error: "Entra con la cuenta que subió el contenido.", values };
  const limited = await checkRightsLimit("counterNotice", await headers(), viewer.userId);
  if (limited) return { error: limited, values };

  const parsed = counterNoticeInputSchema.safeParse({
    ...values,
    caseNumber: text(formData, "caseNumber"),
    swornStatement: text(formData, "swornStatement"),
    penaltyAcknowledged: text(formData, "penaltyAcknowledged"),
  });
  if (!parsed.success) {
    const fieldErrors = z.flattenError(parsed.error).fieldErrors;
    return {
      error: fieldErrors.caseNumber?.[0] ?? "Revisa los campos marcados.",
      fieldErrors,
      values,
    };
  }

  try {
    await submitCounterNotice(viewer.userId, parsed.data);
  } catch (error) {
    if (error instanceof RightsError) {
      return { error: COUNTER_ERRORS[error.code] ?? "No pudimos recibir tu contra-aviso.", values };
    }
    throw error;
  }
  revalidatePath("/derechos-de-autor/contra-aviso");
  revalidatePath("/admin/avisos");
  return { ok: true };
}

// ─────────────────────────────── Equipo ───────────────────────────────

export type RightsAdminFormState = { ok?: boolean; message?: string; error?: string };

const ADMIN_ERRORS: Partial<Record<RightsError["code"], string>> = {
  NOT_FOUND: "Ya no existe.",
  NOT_ALLOWED:
    "No se puede en la etapa actual del caso (quizá alguien ya lo atendió). Recarga la página.",
  NO_TARGETS:
    "Ninguna dirección del aviso apunta a contenido de speeaking: no hay nada que retirar. Si no procede, recházalo con una nota.",
  MANUAL_PENDING:
    "Primero retira a mano la foto de perfil, la portada o el comentario señalados y marca la casilla.",
  NOTE_REQUIRED:
    "Escribe el motivo: restaurar antes del plazo del contra-aviso, o sin contra-aviso, queda en el expediente.",
};

/**
 * Acción del equipo en /admin/avisos. A quien no es ADMIN le responde lo mismo que si no existiera;
 * el servicio vuelve a comprobar el rol (`assertAdmin`) y deja la bitácora.
 */
export async function rightsAdminAction(
  _previous: RightsAdminFormState,
  formData: FormData,
): Promise<RightsAdminFormState> {
  const admin = await getAdminViewer();
  if (!admin) return { error: "No encontrado." };
  const limited = await checkRightsLimit("admin", await headers(), admin.userId);
  if (limited) return { error: limited };

  const parsed = rightsAdminActionSchema.safeParse({
    action: text(formData, "action"),
    noticeId: text(formData, "noticeId"),
    counterNoticeId: text(formData, "counterNoticeId"),
    note: text(formData, "note"),
    manualDone: text(formData, "manualDone"),
  });
  if (!parsed.success) {
    return {
      error:
        parsed.error.issues.find((issue) => issue.path[0] === "note")?.message ??
        "Acción inválida.",
    };
  }

  try {
    const { paths, message } = await applyRightsAction(admin.userId, parsed.data);
    for (const path of paths) revalidatePath(path);
    revalidatePath("/admin/avisos", "layout");
    return { ok: true, message };
  } catch (error) {
    if (error instanceof AdminAuthorizationError) return { error: "No encontrado." };
    if (error instanceof RightsError) {
      return { error: ADMIN_ERRORS[error.code] ?? "No se pudo completar." };
    }
    throw error;
  }
}
