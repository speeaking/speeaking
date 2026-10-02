import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/**
 * Mensajes privados contra la base de desarrollo (`pnpm db:start`): bloquear mensajes (ADR-069)
 * deja a las dos personas sin poder escribir, solo quien bloqueó lo quita y nadie de fuera bloquea
 * una conversación ajena. Crea cuentas `e2e.fix.mensajes*@example.com` y las borra al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});

const { db } = await import("@/server/db");
const {
  MessageError,
  blockMessages,
  findRecipient,
  getOrCreateConversation,
  getThread,
  sendMessage,
  unblockMessages,
} = await import("./service");

const RUN = randomUUID().slice(0, 8);
const people = { ana: "", beto: "", otra: "" };
let conversationId = "";

async function createPerson(tag: keyof typeof people) {
  const user = await db.user.create({
    data: { name: `Mensajes ${tag}`, email: `e2e.fix.mensajes.${RUN}.${tag}@example.com` },
    select: { id: true },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      username: `e2e.fix.msj.${RUN}.${tag}`,
      displayName: `Persona ${tag}`,
      onboardedAt: new Date(),
    },
  });
  return user.id;
}

async function rejection(run: () => Promise<unknown>) {
  try {
    await run();
  } catch (error) {
    if (error instanceof MessageError) return error.code;
    throw error;
  }
  return null;
}

describe.skipIf(!databaseUrl)("bloquear mensajes (ADR-069) contra PostgreSQL", () => {
  beforeAll(async () => {
    people.ana = await createPerson("ana");
    people.beto = await createPerson("beto");
    people.otra = await createPerson("otra");
    conversationId = (await getOrCreateConversation(people.ana, people.beto)).id;
    await sendMessage(people.beto, conversationId, "Hola, ¿sigue disponible?");
  });

  afterAll(async () => {
    await db.user.deleteMany({ where: { id: { in: Object.values(people).filter(Boolean) } } });
    await db.$disconnect();
  });

  it("nadie de fuera bloquea una conversación ajena", async () => {
    expect(await blockMessages(people.otra, conversationId)).toBe(false);
    expect(await unblockMessages(people.otra, conversationId)).toBe(false);
    expect(await db.messageBlock.count({ where: { blockerId: people.otra } })).toBe(0);
  });

  it("con el bloqueo, ninguna de las dos escribe ni empieza otra conversación", async () => {
    expect(await blockMessages(people.ana, conversationId)).toBe(true);
    // Repetirlo no hace nada.
    expect(await blockMessages(people.ana, conversationId)).toBe(true);
    expect(await db.messageBlock.count({ where: { blockerId: people.ana } })).toBe(1);

    expect(await rejection(() => sendMessage(people.beto, conversationId, "¿Hola?"))).toBe(
      "BLOCKED",
    );
    expect(await rejection(() => sendMessage(people.ana, conversationId, "Ya no"))).toBe("BLOCKED");
    expect(await rejection(() => findRecipient(people.beto, `e2e.fix.msj.${RUN}.ana`))).toBe(
      "BLOCKED",
    );
    expect(await rejection(() => findRecipient(people.ana, `e2e.fix.msj.${RUN}.beto`))).toBe(
      "BLOCKED",
    );
    // Con alguien más, todo sigue igual.
    expect(await findRecipient(people.beto, `e2e.fix.msj.${RUN}.otra`)).toMatchObject({
      userId: people.otra,
    });
  });

  it("el hilo dice quién bloqueó solo a quien lo hizo, y conserva el historial", async () => {
    const mine = await getThread(people.ana, conversationId);
    const theirs = await getThread(people.beto, conversationId);
    expect(mine?.blocked).toBe("byMe");
    expect(theirs?.blocked).toBe("byThem");
    expect(theirs?.messages.map((message) => message.body)).toEqual(["Hola, ¿sigue disponible?"]);
  });

  it("solo quien bloqueó lo quita; después se vuelve a escribir", async () => {
    expect(await unblockMessages(people.beto, conversationId)).toBe(true);
    expect((await getThread(people.ana, conversationId))?.blocked).toBe("byMe");
    expect(await rejection(() => sendMessage(people.beto, conversationId, "¿Hola?"))).toBe(
      "BLOCKED",
    );

    expect(await unblockMessages(people.ana, conversationId)).toBe(true);
    expect((await getThread(people.beto, conversationId))?.blocked).toBeNull();
    await expect(
      sendMessage(people.beto, conversationId, "Gracias por desbloquearme"),
    ).resolves.toMatchObject({ messageId: expect.any(String) });
  });
});
