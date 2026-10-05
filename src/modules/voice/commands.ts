import { z } from "zod";

export const MAX_VOICE_COMMAND = 600;
export const MAX_SHARE_NOTE = 500;
export const DEFAULT_SHARE_NOTE = "Te comparto esta publicación.";

export const voiceCommandSchema = z.object({
  action: z.enum(["read", "share", "stop", "cancel", "help"]),
  recipient: z.string().max(80).nullable(),
  note: z.string().max(MAX_SHARE_NOTE).nullable(),
});
export type VoiceCommand = z.infer<typeof voiceCommandSchema>;
export type VoiceFriend = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export function normalizeVoice(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}_.\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[._]+$/gu, "");
}

export function withoutWakeName(text: string) {
  return text
    .trim()
    .replace(/^(?:(?:hey|oye|hola|ey)\s+)?(?:spyke|spike|speeaking|speaking)[,\s:]+/iu, "");
}

/** La IA nunca confirma un envío. La confirmación pertenece a un turno posterior del usuario. */
export function isSendConfirmation(text: string) {
  return /^(?:confirmar envio|confirmo (?:el )?envio|si (?:enviala|envialo)|enviala|envialo)$/u.test(
    normalizeVoice(withoutWakeName(text)),
  );
}

/** Controles de lectura sin llamar al modelo ni gastar presupuesto. */
export function localVoiceCommand(text: string): VoiceCommand | null {
  const value = normalizeVoice(withoutWakeName(text));
  let action: VoiceCommand["action"] | null = null;
  if (
    /^(?:lee|leeme|leer|escuchar)(?: (?:esta|la|esa))?(?: publicacion| noticia| texto)?(?: por favor)?$/u.test(
      value,
    )
  )
    action = "read";
  if (/^(?:deten|detente|para|parar|silencio|detener)(?: (?:la )?lectura)?$/u.test(value))
    action = "stop";
  if (/^(?:cancela|cancelar|no envies|no la envies|no lo envies)$/u.test(value)) action = "cancel";
  if (/^(?:ayuda|que puedes hacer)$/u.test(value)) action = "help";
  return action ? { action, recipient: null, note: null } : null;
}

/** Piezas pequeñas para que las voces del navegador lean también publicaciones largas. */
export function speechChunks(raw: string, max = 220) {
  const text = raw
    .replace(/https?:\/\/\S+/giu, " enlace ")
    .replace(/\s+/g, " ")
    .trim();
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    let end = Math.min(start + max, text.length);
    if (end < text.length) {
      const breakAt = text.lastIndexOf(" ", end);
      if (breakAt > start + max / 2) end = breakAt;
      const last = text.charCodeAt(end - 1);
      if (last >= 0xd800 && last <= 0xdbff) end--;
    }
    chunks.push(text.slice(start, end).trim());
    start = end;
    while (text[start] === " ") start++;
  }
  return chunks.filter(Boolean);
}
