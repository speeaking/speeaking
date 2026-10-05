"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { MAX_SHARE_NOTE, MAX_VOICE_COMMAND } from "./commands";
import { interpretVoice, type VoiceInterpretResult } from "./interpret";
import { confirmVoiceShare, prepareVoiceShare, voiceFriends } from "./share";

const SIGN_IN = "Entra a tu cuenta para compartir con tus amigos.";
async function voiceViewer() {
  const viewer = await getViewer();
  return viewer?.profile?.onboarded ? viewer : null;
}
async function readLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("voice.prepare", "user", userId)!,
      limit: 120,
      windowSeconds: 3600,
    }),
  );
}

export async function interpretVoiceAction(instruction: string): Promise<VoiceInterpretResult> {
  const parsed = z.string().trim().min(1).max(MAX_VOICE_COMMAND).safeParse(instruction);
  if (!parsed.success) return { ok: false, error: "Di una orden corta para Spyke." };
  const viewer = await voiceViewer();
  if (!viewer) return { ok: false, error: SIGN_IN };
  const limited = await readLimit(viewer.userId);
  if (limited) return { ok: false, error: limited };
  return interpretVoice(viewer.userId, parsed.data);
}

export async function findVoiceFriendsAction(query: string) {
  const parsed = z.string().trim().max(80).safeParse(query);
  if (!parsed.success) return { ok: false as const, error: "Escribe un nombre corto." };
  const viewer = await voiceViewer();
  if (!viewer) return { ok: false as const, error: SIGN_IN };
  const limited = await readLimit(viewer.userId);
  if (limited) return { ok: false as const, error: limited };
  return { ok: true as const, friends: await voiceFriends(viewer.userId, parsed.data) };
}

const uuid = z.uuid().transform((value) => value.toLowerCase());
const prepareSchema = z.object({ postId: uuid, recipientId: uuid });
export async function prepareVoiceShareAction(postId: string, recipientId: string) {
  const parsed = prepareSchema.safeParse({ postId, recipientId });
  if (!parsed.success) return { ok: false as const, error: "Elige una publicación y un amigo." };
  const viewer = await voiceViewer();
  if (!viewer) return { ok: false as const, error: SIGN_IN };
  const limited = await readLimit(viewer.userId);
  if (limited) return { ok: false as const, error: limited };
  return prepareVoiceShare(viewer.userId, parsed.data.postId, parsed.data.recipientId);
}

const sendSchema = prepareSchema.extend({
  note: z.string().trim().max(MAX_SHARE_NOTE),
  requestId: uuid,
});
/** Solo este paso posterior del flujo envía; interpretar, buscar y preparar nunca envían. */
export async function confirmVoiceShareAction(input: z.infer<typeof sendSchema>) {
  const parsed = sendSchema.safeParse(input);
  if (!parsed.success) return { ok: false as const, error: "Revisa el destinatario y el mensaje." };
  const viewer = await voiceViewer();
  if (!viewer) return { ok: false as const, error: SIGN_IN };
  const result = await confirmVoiceShare(viewer.userId, parsed.data);
  if (result.ok) {
    revalidatePath("/mensajes");
    revalidatePath(`/mensajes/${result.conversationId}`);
  }
  return result;
}
