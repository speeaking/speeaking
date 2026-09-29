/**
 * Reglas puras de los mensajes privados (ADR-047): el par ordenado que identifica una conversación,
 * el conteo de no leídos y la limpieza del texto. Sin base ni servidor: se prueban solas (P2).
 */
export const MAX_MESSAGE_LENGTH = 2_000;

/** Los dos ids en orden fijo: cada par de personas tiene una sola conversación. */
export function conversationPair(a: string, b: string): { userAId: string; userBId: string } {
  return a < b ? { userAId: a, userBId: b } : { userAId: b, userBId: a };
}

/** Quién es «la otra persona» y cuándo leyó cada quien, desde el punto de vista de `viewerId`. */
export function sideOf(
  conversation: { userAId: string; userBId: string; aReadAt: Date | null; bReadAt: Date | null },
  viewerId: string,
) {
  const isA = conversation.userAId === viewerId;
  return {
    otherUserId: isA ? conversation.userBId : conversation.userAId,
    myReadAt: isA ? conversation.aReadAt : conversation.bReadAt,
    readField: (isA ? "aReadAt" : "bReadAt") as "aReadAt" | "bReadAt",
  };
}

/** ¿Hay mensajes de la otra persona después de mi última lectura? */
export function hasUnread(
  lastMessageAt: Date,
  lastMessageSenderId: string | null,
  viewerId: string,
  myReadAt: Date | null,
): boolean {
  if (!lastMessageSenderId || lastMessageSenderId === viewerId) return false;
  return myReadAt === null || lastMessageAt.getTime() > myReadAt.getTime();
}

/** Texto listo para guardar: sin espacios sobrantes ni saltos de línea de más; `null` si queda vacío o largo. */
export function cleanMessageBody(raw: string): string | null {
  const body = raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
  if (body.length === 0 || body.length > MAX_MESSAGE_LENGTH) return null;
  return body;
}

/** Pista para no compartir datos de pago fuera del pedido (regla de la comunidad, no bloqueo). */
export function looksLikePaymentData(body: string): boolean {
  const digits = body.replace(/[\s-]/g, "");
  // CLABE (18 dígitos), tarjeta (16) o un teléfono de 10 seguidos de «deposita/transfiere».
  return /\d{16,18}/.test(digits) || /\b(clabe|deposita|transfiere|dep[oó]sito)\b/i.test(body);
}
