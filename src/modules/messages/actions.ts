"use server";

import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getViewer, requireOnboardedViewer } from "@/modules/identity/session";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { looksLikePaymentData, MAX_MESSAGE_LENGTH } from "./pair";
import {
  blockMessages,
  type ConversationSummaryDTO,
  findRecipient,
  getOrCreateConversation,
  getThread,
  listConversations,
  MessageError,
  sendMessage,
  type ThreadDTO,
  unblockMessages,
} from "./service";

export type MessageFormState = { error?: string; hint?: string; sentId?: string };

const MESSAGES: Record<string, string> = {
  NOT_FOUND: "No encontramos a esa persona.",
  SELF: "No puedes escribirte a ti misma o mismo.",
  EDITORIAL: "Las cuentas editoriales no reciben mensajes.",
  NOT_ONBOARDED: "Esa persona todavía no termina su perfil.",
  EMPTY: `Escribe algo (hasta ${MAX_MESSAGE_LENGTH.toLocaleString("es-MX")} caracteres).`,
  FORBIDDEN: "Esa conversación no es tuya.",
  // Sin decir quién bloqueó a quién (ADR-069).
  BLOCKED: "No puedes escribirle a esta persona.",
};

/** Antispam: 30 mensajes cada 10 minutos y 20 conversaciones nuevas al día por persona. */
async function messageLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("messages.send", "user", userId)!,
      limit: 30,
      windowSeconds: 10 * 60,
    }),
  );
}

async function newConversationLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("messages.new", "user", userId)!,
      limit: 20,
      windowSeconds: 24 * 60 * 60,
    }),
  );
}

/** Abre (o crea) la conversación con una persona y lleva al hilo; `texto` va prellenado. */
export async function startConversationAction(formData: FormData): Promise<void> {
  const username = String(formData.get("para") ?? "");
  const text = String(formData.get("texto") ?? "").slice(0, MAX_MESSAGE_LENGTH);
  const viewer = await requireOnboardedViewer(
    `/mensajes/nuevo?${new URLSearchParams({ para: username, ...(text ? { texto: text } : {}) })}`,
  );
  const limited = await newConversationLimit(viewer.userId);
  if (limited) redirect(`/mensajes?error=${encodeURIComponent(limited)}` as Route);
  let conversationId: string;
  try {
    const recipient = await findRecipient(viewer.userId, username);
    conversationId = (await getOrCreateConversation(viewer.userId, recipient.userId)).id;
  } catch (error) {
    if (error instanceof MessageError) {
      redirect(`/mensajes?error=${encodeURIComponent(MESSAGES[error.code] ?? "")}` as Route);
    }
    throw error;
  }
  redirect(
    `/mensajes/${conversationId}${text ? `?texto=${encodeURIComponent(text)}` : ""}` as Route,
  );
}

/** La bandeja para el recuadro de la barra (ADR-068): lo mismo que /mensajes. `null` sin sesión. */
export async function loadInboxAction(): Promise<ConversationSummaryDTO[] | null> {
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return null;
  return listConversations(viewer.userId);
}

/**
 * Un hilo para el recuadro (ADR-068): solo sus dos personas, y abrirlo lo marca como leído, igual
 * que /mensajes/[id]. `null` si no existe, no es suyo o no hay sesión.
 */
export async function loadThreadAction(conversationId: string): Promise<ThreadDTO | null> {
  if (!z.uuid().safeParse(conversationId).success) return null;
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return null;
  return getThread(viewer.userId, conversationId);
}

/** Bloquear o desbloquear: 30 cambios por hora por persona (frena el ida y vuelta automático). */
async function blockLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("messages.block", "user", userId)!,
      limit: 30,
      windowSeconds: 60 * 60,
    }),
  );
}

export type BlockResult = { ok: true } | { ok: false; error: string };

/**
 * «Bloquear mensajes» de la otra persona de una conversación propia (ADR-069), o quitar el bloqueo
 * propio con `blocked: false`.
 */
export async function setMessagesBlockedAction(
  conversationId: string,
  blocked: boolean,
): Promise<BlockResult> {
  if (!z.uuid().safeParse(conversationId).success) return { ok: false, error: MESSAGES.FORBIDDEN! };
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded) return { ok: false, error: MESSAGES.FORBIDDEN! };
  const limited = await blockLimit(viewer.userId);
  if (limited) return { ok: false, error: limited };
  const done = blocked
    ? await blockMessages(viewer.userId, conversationId)
    : await unblockMessages(viewer.userId, conversationId);
  if (!done) return { ok: false, error: MESSAGES.FORBIDDEN! };
  revalidatePath(`/mensajes/${conversationId}`);
  revalidatePath("/(social)", "layout");
  return { ok: true };
}

const sendSchema = z.object({
  conversationId: z.uuid(),
  body: z.string().max(MAX_MESSAGE_LENGTH + 500),
});

/** Envía un mensaje al hilo abierto. */
export async function sendMessageAction(
  _previous: MessageFormState,
  formData: FormData,
): Promise<MessageFormState> {
  const parsed = sendSchema.safeParse({
    conversationId: formData.get("conversationId"),
    body: formData.get("body"),
  });
  if (!parsed.success) return { error: MESSAGES.EMPTY };
  const viewer = await requireOnboardedViewer(`/mensajes/${parsed.data.conversationId}`);
  const limited = await messageLimit(viewer.userId);
  if (limited) return { error: limited };
  try {
    const { messageId } = await sendMessage(
      viewer.userId,
      parsed.data.conversationId,
      parsed.data.body,
    );
    revalidatePath(`/mensajes/${parsed.data.conversationId}`);
    revalidatePath("/mensajes");
    return {
      sentId: messageId,
      hint: looksLikePaymentData(parsed.data.body)
        ? "Recuerda: los pagos van dentro del pedido; nunca por transferencia a una cuenta escrita en un mensaje."
        : undefined,
    };
  } catch (error) {
    if (error instanceof MessageError) return { error: MESSAGES[error.code] ?? MESSAGES.EMPTY };
    throw error;
  }
}
