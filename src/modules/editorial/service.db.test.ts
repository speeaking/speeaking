import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as Reservation from "@/modules/ai/reservation";

/**
 * Redacción diaria (ADR-066) contra la base de desarrollo (`pnpm db:start`): quién puede revisar,
 * un borrador automático por comunidad y día, lo que no pasa la limpieza no se guarda, y publicar
 * crea UNA publicación de la cuenta editorial marcada como hecha con IA. Usa una comunidad propia
 * (`e2e-fix-redaccion-*`) y cuentas `e2e.fix.redaccion*@example.com`, y lo borra todo al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

type Generate = (task: unknown, input: unknown) => Promise<unknown>;
const ai = vi.hoisted(() => ({
  featureOn: true,
  generate: null as Generate | null,
  calls: 0,
}));

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("@/server/env", () => ({ env: { NODE_ENV: "test", ALLOW_SIMULATED_AI: false } }));
vi.mock("@/modules/ai/features-store", () => ({ isFeatureOn: async () => ai.featureOn }));
vi.mock("@/server/providers/ai", () => ({
  getAIRoute: async () => ({ provider: "mock", model: "mock", source: "default" }),
  getAIProvider: async () => ({
    id: "mock",
    model: "mock",
    async generate(
      task: { mock: (input: unknown) => unknown; output: { parse: (v: unknown) => unknown } },
      input: unknown,
    ) {
      ai.calls += 1;
      if (ai.generate) return ai.generate(task, input);
      return {
        output: task.output.parse(task.mock(input)),
        usage: { inputTokens: 120, outputTokens: 40 },
      };
    },
  }),
}));
vi.mock("@/modules/ai/reservation", async (importOriginal) => {
  const actual = await importOriginal<typeof Reservation>();
  return { ...actual, reserveAiRequest: vi.fn(actual.reserveAiRequest) };
});

const { db } = await import("@/server/db");
const { env } = await import("@/server/env");
const { AdminAuthorizationError } = await import("@/modules/admin/service");
const { AIError } = await import("@/modules/ai/errors");
const { reserveAiRequest } = await import("@/modules/ai/reservation");
const { addDays, dayToDbDate, mexicoDay } = await import("@/modules/platform/calendar");
const { MAX_POST_LENGTH } = await import("@/modules/social/schemas");
const { AIProviderError } = await import("@/server/providers/ai/errors");
const { editorialAccount } = await import("./account");
const {
  DRAFT_TTL_DAYS,
  MAX_PENDING_PER_COMMUNITY,
  discardDraft,
  expireOldDrafts,
  getDesk,
  publishDraft,
  requestDraft,
  runDailyDrafts,
} = await import("./service");

const RUN = randomUUID().slice(0, 8);
const NOW = new Date();
const TODAY = mexicoDay(NOW);
const usage = { inputTokens: 120, outputTokens: 40 };
const community = { id: "", slug: `e2e-fix-redaccion-${RUN}`, name: `Prueba ${RUN}` };
const ids = { admin: "", stranger: "" };

async function createUser(tag: string, role: "ADMIN" | "USER") {
  const user = await db.user.create({
    data: { name: `Redacción ${tag}`, email: `e2e.fix.redaccion.${RUN}.${tag}@example.com` },
    select: { id: true },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      username: `e2e.fix.red.${RUN}.${tag}`,
      displayName: `Persona ${tag}`,
      role,
      onboardedAt: new Date(),
    },
  });
  return user.id;
}

const drafts = (status?: "PENDING" | "PUBLISHED" | "DISCARDED") =>
  db.editorialDraft.findMany({
    where: { communityId: community.id, ...(status ? { status } : {}) },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });

const only = () => ({ only: [community.id] });

/** Un borrador pedido a mano por el equipo, ya guardado. */
async function requested(topic?: string) {
  const outcome = await requestDraft(ids.admin, {
    communityId: community.id,
    ...(topic ? { topic } : {}),
  });
  if (!outcome.ok) throw new Error(`no se creó el borrador: ${outcome.reason}`);
  return db.editorialDraft.findUniqueOrThrow({ where: { id: outcome.draftId } });
}

describe.skipIf(!databaseUrl)("redacción diaria contra PostgreSQL", () => {
  beforeAll(async () => {
    ids.admin = await createUser("equipo", "ADMIN");
    ids.stranger = await createUser("extrana", "USER");
    community.id = (
      await db.community.create({
        data: {
          slug: community.slug,
          name: community.name,
          description: "Comunidad de prueba de la redacción.",
          emoji: "🧪",
          sortOrder: 9_999,
          isOfficial: true,
        },
        select: { id: true },
      })
    ).id;
  });

  beforeEach(() => {
    ai.featureOn = true;
    ai.generate = null;
    ai.calls = 0;
    env.NODE_ENV = "test";
  });

  afterAll(async () => {
    if (community.id) {
      await db.aIRequest.deleteMany({
        where: {
          feature: "EDITORIAL_DRAFT",
          input: { path: ["communityId"], equals: community.id },
        },
      });
      await db.community.delete({ where: { id: community.id } });
    }
    await db.user.deleteMany({
      where: {
        OR: [
          { id: { in: [ids.admin, ids.stranger].filter(Boolean) } },
          { email: editorialAccount(community).email },
        ],
      },
    });
    await db.$disconnect();
  });

  it("solo el equipo entra a la redacción", async () => {
    const fake = randomUUID();
    await expect(getDesk(ids.stranger)).rejects.toBeInstanceOf(AdminAuthorizationError);
    await expect(requestDraft(ids.stranger, { communityId: community.id })).rejects.toBeInstanceOf(
      AdminAuthorizationError,
    );
    await expect(publishDraft(ids.stranger, fake, "Hola")).rejects.toBeInstanceOf(
      AdminAuthorizationError,
    );
    await expect(discardDraft(ids.stranger, fake)).rejects.toBeInstanceOf(AdminAuthorizationError);
    expect(ai.calls).toBe(0);
  });

  it("apagada, o sin un modelo de verdad, no redacta", async () => {
    ai.featureOn = false;
    expect(await requestDraft(ids.admin, { communityId: community.id })).toEqual({
      ok: false,
      reason: "off",
    });
    expect(await runDailyDrafts(NOW, only())).toMatchObject({ status: "off", created: 0 });

    // Producción con el simulador: las plantillas no se publican como contenido del equipo.
    ai.featureOn = true;
    env.NODE_ENV = "production";
    expect(await requestDraft(ids.admin, { communityId: community.id })).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(await runDailyDrafts(NOW, only())).toMatchObject({ status: "unavailable", created: 0 });

    expect(ai.calls).toBe(0);
    expect(await drafts()).toHaveLength(0);
  });

  it("con demasiados borradores sin revisar, la comunidad deja de recibir automáticos", async () => {
    for (let index = 0; index < MAX_PENDING_PER_COMMUNITY; index++) await requested();
    const full = await runDailyDrafts(NOW, only());
    expect(full).toMatchObject({ status: "ready", created: 0, skipped: 1, failed: 0 });
    expect(await drafts("PENDING")).toHaveLength(MAX_PENDING_PER_COMMUNITY);

    // Al revisar (aquí, descartar) vuelve a haber lugar.
    const [first, second] = await drafts("PENDING");
    expect(await discardDraft(ids.admin, first!.id)).toBe(true);
    expect(await discardDraft(ids.admin, second!.id)).toBe(true);
    expect(await discardDraft(ids.admin, second!.id)).toBe(false);
    const discarded = await db.editorialDraft.findUniqueOrThrow({ where: { id: first!.id } });
    expect(discarded).toMatchObject({ status: "DISCARDED", reviewedById: ids.admin });
    expect(discarded.reviewedAt).not.toBeNull();
  });

  it("redacta un borrador automático por comunidad y día, sin repetirlo", async () => {
    // Sin tiempo no se intenta nada (lo que falte se pide a mano).
    expect(await runDailyDrafts(NOW, { ...only(), budgetMs: -1 })).toMatchObject({
      created: 0,
      notAttempted: 1,
    });

    expect(await runDailyDrafts(NOW, only())).toMatchObject({
      day: TODAY,
      status: "ready",
      created: 1,
      skipped: 0,
      failed: 0,
    });
    const auto = await db.editorialDraft.findUniqueOrThrow({
      where: { autoKey: `${community.id}:${TODAY}` },
      include: { request: { include: { response: true } } },
    });
    expect(auto).toMatchObject({
      status: "PENDING",
      provider: "mock",
      model: "mock",
      promptVersion: "editorial@2",
      topic: null,
      reviewedById: null,
      postId: null,
    });
    expect(auto.day).toEqual(dayToDbDate(TODAY));
    // La llamada queda en la contabilidad de IA: del sistema, lograda y con la misma salida.
    expect(auto.request).toMatchObject({
      userId: null,
      feature: "EDITORIAL_DRAFT",
      status: "SUCCEEDED",
    });
    expect(auto.request?.response?.output).toEqual({ body: auto.body });

    // Repetir la operación diaria (un reintento del cron) no crea otro.
    const callsBefore = ai.calls;
    expect(await runDailyDrafts(NOW, only())).toMatchObject({ created: 0, skipped: 1 });
    expect(ai.calls).toBe(callsBefore);
  });

  it("un tema del equipo se limpia y se respeta; uno prohibido no llega a la IA", async () => {
    const draft = await requested("  Empezó el frío   en la ciudad, escríbeme al 55 1234 5678 ");
    expect(draft).toMatchObject({ kind: "TOPIC", status: "PENDING", autoKey: null });
    expect(draft.topic).toBe("Empezó el frío en la ciudad, escríbeme al [teléfono]");
    expect(draft.body).toContain("Empezó el frío en la ciudad");
    expect(draft.body).not.toContain("5678");

    const callsBefore = ai.calls;
    expect(
      await requestDraft(ids.admin, { communityId: community.id, topic: "Réplicas AAA de tenis" }),
    ).toEqual({ ok: false, reason: "rejected" });
    expect(await requestDraft(ids.admin, { communityId: randomUUID() })).toEqual({
      ok: false,
      reason: "not_found",
    });
    expect(ai.calls).toBe(callsBefore);
  });

  it("una fecha cercana se propone una sola vez por comunidad", async () => {
    // 14 de febrero de 2027: la única fecha del calendario en los siguientes siete días.
    const valentines = new Date("2027-02-14T18:00:00.000Z");
    const first = await requestDraft(ids.admin, { communityId: community.id }, valentines);
    expect(first.ok).toBe(true);
    const second = await requestDraft(ids.admin, { communityId: community.id }, valentines);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(
      await db.editorialDraft.findUniqueOrThrow({ where: { id: first.draftId } }),
    ).toMatchObject({ kind: "DATE", occasion: "dia-del-amor-y-la-amistad-2027" });
    const next = await db.editorialDraft.findUniqueOrThrow({ where: { id: second.draftId } });
    expect(next.kind).not.toBe("DATE");
    expect(next.occasion).toBeNull();
    await db.editorialDraft.deleteMany({ where: { id: { in: [first.draftId, second.draftId] } } });
  });

  it("lo que no pasa la limpieza, se repite o falla no se guarda como borrador", async () => {
    const before = (await drafts()).length;
    const lastRequest = () =>
      db.aIRequest.findFirstOrThrow({
        where: {
          feature: "EDITORIAL_DRAFT",
          input: { path: ["communityId"], equals: community.id },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        select: { status: true, errorCode: true },
      });
    const ask = () => requestDraft(ids.admin, { communityId: community.id });

    ai.generate = async () => ({ output: { body: "¿Y tú?" }, usage });
    expect(await ask()).toEqual({ ok: false, reason: "rejected" });
    expect(await lastRequest()).toEqual({ status: "FAILED", errorCode: "INVALID_OUTPUT" });

    ai.generate = async () => ({
      output: { body: "Hoy toca hablar de réplicas de tenis. ¿Dónde las consigues tú?" },
      usage,
    });
    expect(await ask()).toEqual({ ok: false, reason: "rejected" });

    const existing = (await drafts("PENDING"))[0]!;
    ai.generate = async () => ({ output: { body: existing.body.toUpperCase() }, usage });
    expect(await ask()).toEqual({ ok: false, reason: "duplicate" });

    ai.generate = async () => {
      throw new AIProviderError("timeout", "[ai] sin respuesta del proveedor");
    };
    expect(await ask()).toEqual({ ok: false, reason: "failed" });
    expect(await lastRequest()).toEqual({ status: "FAILED", errorCode: "PROVIDER_ERROR" });

    // Sin presupuesto (o con el tope diario agotado) ni siquiera se llama al modelo.
    ai.generate = null;
    const callsBefore = ai.calls;
    vi.mocked(reserveAiRequest).mockRejectedValueOnce(new AIError("DAILY_CAP"));
    expect(await ask()).toEqual({ ok: false, reason: "budget" });
    expect(ai.calls).toBe(callsBefore);

    expect(await drafts()).toHaveLength(before);
  });

  it("publicar crea una sola publicación de la cuenta editorial, marcada como hecha con IA", async () => {
    const draft = await requested("Tema para publicar");
    expect(await publishDraft(ids.admin, draft.id, "   ")).toEqual({
      ok: false,
      reason: "invalid_body",
    });
    expect(await publishDraft(ids.admin, draft.id, "x".repeat(MAX_POST_LENGTH + 1))).toEqual({
      ok: false,
      reason: "invalid_body",
    });
    expect(await publishDraft(ids.admin, randomUUID(), "Hola a todas y todos")).toEqual({
      ok: false,
      reason: "not_found",
    });

    const edited = "Texto que ajustó el equipo antes de publicar.\r\n¿Qué opinan?";
    const result = await publishDraft(ids.admin, draft.id, `  ${edited}  `);
    expect(result).toMatchObject({ ok: true, communitySlug: community.slug });
    if (!result.ok) return;

    const post = await db.post.findUniqueOrThrow({
      where: { id: result.postId },
      include: { author: { include: { profile: true, accounts: true } } },
    });
    expect(post).toMatchObject({
      body: "Texto que ajustó el equipo antes de publicar.\n¿Qué opinan?",
      communityId: community.id,
      isAiGenerated: true,
      status: "PUBLISHED",
      productId: null,
      collaboration: false,
    });
    // La cuenta editorial de la comunidad: identificada, y sin forma de iniciar sesión.
    const account = editorialAccount(community);
    expect(post.author.email).toBe(account.email);
    expect(post.author.accounts).toHaveLength(0);
    expect(post.author.profile).toMatchObject({
      username: account.username,
      displayName: "Equipo speeaking",
      isEditorial: true,
      role: "USER",
    });
    expect(await db.editorialDraft.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({
      status: "PUBLISHED",
      postId: post.id,
      reviewedById: ids.admin,
      body: post.body,
    });

    // Ya revisado: ni se vuelve a publicar ni se puede descartar.
    expect(await publishDraft(ids.admin, draft.id, edited)).toEqual({
      ok: false,
      reason: "already_reviewed",
    });
    expect(await discardDraft(ids.admin, draft.id)).toBe(false);
  });

  it("no publica si el correo de la cuenta editorial lo tiene una cuenta que no es de la plataforma", async () => {
    // Otra comunidad cuyo correo editorial ya ocupa una persona (con contraseña, o con un perfil
    // que no es editorial): la redacción no publica con esa cuenta.
    const other = {
      id: "",
      slug: `e2e-fix-redaccion-${RUN}-b`,
      name: `Prueba ${RUN} b`,
    };
    other.id = (
      await db.community.create({
        data: {
          slug: other.slug,
          name: other.name,
          description: "Otra comunidad de prueba.",
          emoji: "🧪",
          sortOrder: 9_998,
          isOfficial: true,
        },
        select: { id: true },
      })
    ).id;
    const squatter = await db.user.create({
      data: {
        name: "Persona cualquiera",
        email: editorialAccount(other).email,
        profile: {
          create: {
            username: `e2e.fix.red.${RUN}.okupa`,
            displayName: "Equipo falso",
            onboardedAt: new Date(),
          },
        },
        accounts: {
          create: { accountId: "okupa", providerId: "credential", password: "hash" },
        },
      },
      select: { id: true },
    });
    try {
      const draft = await db.editorialDraft.create({
        data: {
          communityId: other.id,
          kind: "QUESTION",
          day: dayToDbDate(TODAY),
          body: "Borrador para una comunidad con la cuenta ocupada.",
          provider: "mock",
          model: "mock",
          promptVersion: "editorial@2",
        },
        select: { id: true },
      });
      expect(await publishDraft(ids.admin, draft.id, "Texto que no debe salir")).toEqual({
        ok: false,
        reason: "account_conflict",
      });
      // Ni con un perfil editorial falso, si la cuenta puede iniciar sesión.
      await db.profile.update({ where: { userId: squatter.id }, data: { isEditorial: true } });
      expect(await publishDraft(ids.admin, draft.id, "Texto que no debe salir")).toEqual({
        ok: false,
        reason: "account_conflict",
      });
      expect(await db.post.count({ where: { authorId: squatter.id } })).toBe(0);
      expect(await db.editorialDraft.findUniqueOrThrow({ where: { id: draft.id } })).toMatchObject({
        status: "PENDING",
        postId: null,
      });
    } finally {
      await db.community.delete({ where: { id: other.id } });
      await db.user.delete({ where: { id: squatter.id } });
    }
  });

  it("dos toques a la vez publican una sola vez y reutilizan la misma cuenta", async () => {
    const draft = await requested("Tema del doble toque");
    const results = await Promise.all([
      publishDraft(ids.admin, draft.id, "Doble toque, una sola publicación."),
      publishDraft(ids.admin, draft.id, "Doble toque, una sola publicación."),
    ]);
    expect(results.filter((result) => result.ok)).toHaveLength(1);
    expect(results.filter((result) => !result.ok)).toEqual([
      { ok: false, reason: "already_reviewed" },
    ]);
    const account = editorialAccount(community);
    expect(await db.user.count({ where: { email: account.email } })).toBe(1);
    expect(
      await db.post.count({
        where: { author: { email: account.email }, body: "Doble toque, una sola publicación." },
      }),
    ).toBe(1);
  });

  it("un borrador que nadie revisa en tres días se descarta solo", async () => {
    const row = (day: string) =>
      db.editorialDraft.create({
        data: {
          communityId: community.id,
          kind: "QUESTION",
          day: dayToDbDate(day),
          body: `Borrador viejo del ${day} para la comunidad de prueba.`,
          provider: "mock",
          model: "mock",
          promptVersion: "editorial@2",
        },
        select: { id: true },
      });
    const expired = await row(addDays(TODAY, -(DRAFT_TTL_DAYS + 1)));
    const kept = await row(addDays(TODAY, -DRAFT_TTL_DAYS));

    expect(await expireOldDrafts(TODAY, NOW)).toBeGreaterThanOrEqual(1);
    const after = await db.editorialDraft.findUniqueOrThrow({ where: { id: expired.id } });
    // Venció solo: descartado sin que nadie lo revisara.
    expect(after).toMatchObject({ status: "DISCARDED", reviewedById: null });
    expect(after.reviewedAt).not.toBeNull();
    expect(await db.editorialDraft.findUniqueOrThrow({ where: { id: kept.id } })).toMatchObject({
      status: "PENDING",
    });
  });

  it("la mesa muestra lo pendiente, lo publicado y las comunidades", async () => {
    const desk = await getDesk(ids.admin);
    expect(desk.status).toBe("ready");
    const pending = desk.pending.filter((draft) => draft.community.slug === community.slug);
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((draft) => draft.simulated)).toBe(true);
    expect(pending.map((draft) => draft.id).sort()).toEqual(
      (await drafts("PENDING")).map((draft) => draft.id).sort(),
    );
    const published = desk.published.filter((item) => item.community.slug === community.slug);
    expect(published).toHaveLength(2);
    expect(published.every((item) => item.postId.length > 0)).toBe(true);
    expect(desk.communities.map((item) => item.id)).toContain(community.id);
  });
});
