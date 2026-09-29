import "server-only";
import { db } from "@/server/db";
import { cleanMessageBody, conversationPair, hasUnread, sideOf } from "./pair";

/**
 * Mensajes privados (ADR-047): una conversación por par de personas, texto plano, solo para las dos.
 * Gratis para todos: es el pegamento de la red social. Reglas: cuenta con perfil terminado, nunca
 * con uno mismo ni con las cuentas editoriales; la persona puede reportar a la otra desde el hilo.
 */
export type MessageErrorCode =
  "NOT_FOUND" | "SELF" | "EDITORIAL" | "NOT_ONBOARDED" | "EMPTY" | "FORBIDDEN";

export class MessageError extends Error {
  override name = "MessageError";
  constructor(readonly code: MessageErrorCode) {
    super(code);
  }
}

export type PersonDTO = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export type ConversationSummaryDTO = {
  id: string;
  other: PersonDTO;
  lastMessage: { body: string; mine: boolean; at: string } | null;
  unread: boolean;
};

export type MessageDTO = { id: string; body: string; mine: boolean; at: string };

export type ThreadDTO = {
  id: string;
  other: PersonDTO;
  messages: MessageDTO[];
};

const personSelect = {
  id: true,
  profile: { select: { username: true, displayName: true, avatarUrl: true } },
} as const;

type PersonRow = {
  id: string;
  profile: { username: string; displayName: string; avatarUrl: string | null } | null;
};

function toPerson(row: PersonRow): PersonDTO {
  return {
    userId: row.id,
    username: row.profile?.username ?? "",
    displayName: row.profile?.displayName ?? "Alguien",
    avatarUrl: row.profile?.avatarUrl ?? null,
  };
}

/** Persona a la que se le puede escribir: existe, con perfil terminado, no editorial, no uno mismo. */
export async function findRecipient(viewerId: string, username: string): Promise<PersonDTO> {
  const row = await db.user.findFirst({
    where: { profile: { username: username.toLowerCase() } },
    select: {
      id: true,
      profile: {
        select: {
          username: true,
          displayName: true,
          avatarUrl: true,
          isEditorial: true,
          onboardedAt: true,
        },
      },
    },
  });
  if (!row || !row.profile) throw new MessageError("NOT_FOUND");
  if (row.id === viewerId) throw new MessageError("SELF");
  if (row.profile.isEditorial) throw new MessageError("EDITORIAL");
  if (!row.profile.onboardedAt) throw new MessageError("NOT_ONBOARDED");
  return toPerson(row);
}

/** La conversación entre dos personas (se crea al primer uso). */
export async function getOrCreateConversation(viewerId: string, otherUserId: string) {
  if (viewerId === otherUserId) throw new MessageError("SELF");
  const pair = conversationPair(viewerId, otherUserId);
  return db.conversation.upsert({
    where: { userAId_userBId: pair },
    create: pair,
    update: {},
    select: { id: true },
  });
}

/** Bandeja: conversaciones de la persona, la más reciente primero, con su último mensaje. */
export async function listConversations(viewerId: string): Promise<ConversationSummaryDTO[]> {
  const rows = await db.conversation.findMany({
    where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    orderBy: { lastMessageAt: "desc" },
    take: 50,
    select: {
      id: true,
      userAId: true,
      userBId: true,
      aReadAt: true,
      bReadAt: true,
      lastMessageAt: true,
      userA: { select: personSelect },
      userB: { select: personSelect },
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
        select: { body: true, senderId: true, createdAt: true },
      },
    },
  });
  return rows.map((row) => {
    const side = sideOf(row, viewerId);
    const last = row.messages[0] ?? null;
    return {
      id: row.id,
      other: toPerson(side.otherUserId === row.userAId ? row.userA : row.userB),
      lastMessage: last
        ? { body: last.body, mine: last.senderId === viewerId, at: last.createdAt.toISOString() }
        : null,
      unread: hasUnread(row.lastMessageAt, last?.senderId ?? null, viewerId, side.myReadAt),
    };
  });
}

/** Conversaciones con mensajes sin leer (para el globo de la barra superior). */
export async function countUnreadConversations(viewerId: string): Promise<number> {
  const rows = await db.conversation.findMany({
    where: { OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    select: {
      userAId: true,
      userBId: true,
      aReadAt: true,
      bReadAt: true,
      lastMessageAt: true,
      messages: { orderBy: { createdAt: "desc" }, take: 1, select: { senderId: true } },
    },
  });
  return rows.filter((row) =>
    hasUnread(
      row.lastMessageAt,
      row.messages[0]?.senderId ?? null,
      viewerId,
      sideOf(row, viewerId).myReadAt,
    ),
  ).length;
}

/** El hilo (últimos 200 mensajes) y lo marca como leído hasta ahora. Solo sus dos personas. */
export async function getThread(
  viewerId: string,
  conversationId: string,
  now = new Date(),
): Promise<ThreadDTO | null> {
  const row = await db.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    select: {
      id: true,
      userAId: true,
      userBId: true,
      aReadAt: true,
      bReadAt: true,
      userA: { select: personSelect },
      userB: { select: personSelect },
      messages: {
        orderBy: { createdAt: "asc" },
        take: 200,
        select: { id: true, body: true, senderId: true, createdAt: true },
      },
    },
  });
  if (!row) return null;
  const side = sideOf(row, viewerId);
  await db.conversation.update({
    where: { id: row.id },
    data: { [side.readField]: now },
    select: { id: true },
  });
  return {
    id: row.id,
    other: toPerson(side.otherUserId === row.userAId ? row.userA : row.userB),
    messages: row.messages.map((message) => ({
      id: message.id,
      body: message.body,
      mine: message.senderId === viewerId,
      at: message.createdAt.toISOString(),
    })),
  };
}

/** Envía un mensaje en una conversación propia; el texto limpio, nunca vacío. */
export async function sendMessage(viewerId: string, conversationId: string, rawBody: string) {
  const body = cleanMessageBody(rawBody);
  if (!body) throw new MessageError("EMPTY");
  const conversation = await db.conversation.findFirst({
    where: { id: conversationId, OR: [{ userAId: viewerId }, { userBId: viewerId }] },
    select: { id: true, userAId: true, userBId: true },
  });
  if (!conversation) throw new MessageError("FORBIDDEN");
  const now = new Date();
  const side = sideOf({ ...conversation, aReadAt: null, bReadAt: null }, viewerId);
  const [message] = await db.$transaction([
    db.message.create({
      data: { conversationId, senderId: viewerId, body, createdAt: now },
      select: { id: true },
    }),
    db.conversation.update({
      where: { id: conversationId },
      // Quien escribe ya leyó todo lo anterior.
      data: { lastMessageAt: now, [side.readField]: now },
      select: { id: true },
    }),
  ]);
  return { messageId: message.id };
}
