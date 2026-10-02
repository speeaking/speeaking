import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { assertAdmin } from "@/modules/admin/service";
import { policyViolation } from "@/modules/ai/content-policy";
import { recordedCost } from "@/modules/ai/cost";
import { AIError } from "@/modules/ai/errors";
import { isFeatureOn } from "@/modules/ai/features-store";
import { redactPersonalData } from "@/modules/ai/personal-data";
import { reserveAiRequest } from "@/modules/ai/reservation";
import { providerFailure, SERVICE_TIMEOUT_MS, withTimeout } from "@/modules/ai/service";
import { aiAvailability } from "@/modules/ai/tasks/availability";
import { SIMULATED_PROVIDER_ID } from "@/modules/ai/tasks/simulation";
import { addDays, type Day, dayToDbDate, mexicoDay } from "@/modules/platform/calendar";
import { MAX_POST_LENGTH } from "@/modules/social/schemas";
import { db } from "@/server/db";
import { getAIProvider } from "@/server/providers/ai";
import { EditorialAccountConflictError, ensureEditorialAccount } from "./account";
import { type DraftKind, type DraftPlan, planDraft, planTopic, TOPIC_MAX_CHARS } from "./brief";
import { daysUntilText, occasionDateText } from "./calendar";
import { cleanDraftBody, comparableText } from "./draft-text";
import { type EditorialDraftInput, editorialDraftTask, RECENT_EXCERPT_CHARS } from "./task";

/**
 * Redacción diaria (ADR-066). Cada día la IA redacta un borrador por comunidad para su cuenta
 * editorial («Equipo speeaking») y una persona del equipo decide qué se publica: nada sale sin su
 * aprobación. Contenido honesto (ADR-018): la cuenta se identifica como editorial, el texto lleva la
 * marca de IA y aquí nunca se crean usuarios, comentarios, reacciones ni seguidores.
 */

/** Tope diario del gasto de la redacción (un borrador cuesta ≈ US$0.00007 con su modelo de arranque). */
export const EDITORIAL_DAILY_CAP_USD = 0.25;
/** Con esta cantidad de borradores sin revisar, la comunidad deja de recibir automáticos. */
export const MAX_PENDING_PER_COMMUNITY = 3;
/** Un borrador que nadie revisa en estos días se descarta solo. */
export const DRAFT_TTL_DAYS = 3;
/** Publicaciones recientes que se le muestran al modelo para que no repita temas. */
const RECENT_FOR_PROMPT = 8;
/** Una fecha del calendario ya tratada no se vuelve a proponer en la comunidad. */
const OCCASION_MEMORY_DAYS = 60;
/** Tiempo para EMPEZAR borradores en la corrida diaria (el cron completo tiene 300 s). */
const DAILY_RUN_BUDGET_MS = 90_000;
const DAILY_RUN_CONCURRENCY = 3;

export type DeskStatus = "ready" | "off" | "unavailable";

export type DraftFailure =
  | DeskStatus
  | "not_found"
  /** Ya existe el borrador automático de hoy para esa comunidad. */
  | "exists"
  /** La comunidad tiene demasiados borradores sin revisar. */
  | "queue_full"
  /** Presupuesto de IA o tope diario de la redacción agotado. */
  | "budget"
  /** El texto no pasó la limpieza o las reglas de contenido. */
  | "rejected"
  /** Igual a una publicación o a un borrador reciente. */
  | "duplicate"
  | "failed";

export type DraftOutcome =
  { ok: true; draftId: string } | { ok: false; reason: Exclude<DraftFailure, "ready"> };

type DeskCommunity = { id: string; slug: string; name: string; description: string };

function isUniqueViolation(error: unknown) {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

/**
 * ¿Puede redactar hoy? Apagada desde /admin/ia (`editorialDesk`) o sin un modelo de verdad: en
 * producción las plantillas del simulador nunca se publican como contenido editorial.
 */
export async function deskStatus(): Promise<DeskStatus> {
  if (!(await isFeatureOn("editorialDesk"))) return "off";
  return (await aiAvailability("editorial_draft")) === "real" ? "ready" : "unavailable";
}

/** Comunidades oficiales en su orden curado: la posición decide la rotación de cada una. */
function officialCommunities(): Promise<DeskCommunity[]> {
  return db.community.findMany({
    where: { isOfficial: true },
    orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
    select: { id: true, slug: true, name: true, description: true },
  });
}

/**
 * Redacta y guarda un borrador. Orden: el código arma el encargo (`brief.ts`), se reserva
 * presupuesto ANTES de llamar (SEC-19), el modelo redacta, el código limpia el texto y revisa las
 * reglas de contenido, y solo entonces se guarda como PENDING. Las fallas quedan en `AIRequest`.
 */
async function createDraft(
  community: DeskCommunity,
  communityIndex: number,
  options: { day: Day; now: Date; auto: boolean; topic?: string },
): Promise<DraftOutcome> {
  const autoKey = options.auto ? `${community.id}:${options.day}` : null;
  if (autoKey) {
    const [existing, pending] = await Promise.all([
      db.editorialDraft.findUnique({ where: { autoKey }, select: { id: true } }),
      db.editorialDraft.count({ where: { communityId: community.id, status: "PENDING" } }),
    ]);
    if (existing) return { ok: false, reason: "exists" };
    if (pending >= MAX_PENDING_PER_COMMUNITY) return { ok: false, reason: "queue_full" };
  }

  const [occasionRows, recentDrafts, recentPosts] = await Promise.all([
    // Cualquier borrador cuenta, también uno descartado: si el equipo no quiso esa fecha en esta
    // comunidad, no se le vuelve a proponer cada día hasta que pase.
    db.editorialDraft.findMany({
      where: {
        communityId: community.id,
        occasion: { not: null },
        day: { gte: dayToDbDate(addDays(options.day, -OCCASION_MEMORY_DAYS)) },
      },
      select: { occasion: true },
    }),
    db.editorialDraft.findMany({
      where: { communityId: community.id, status: "PENDING" },
      orderBy: { createdAt: "desc" },
      take: RECENT_FOR_PROMPT,
      select: { body: true },
    }),
    db.post.findMany({
      where: {
        communityId: community.id,
        status: "PUBLISHED",
        author: { profile: { isEditorial: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: RECENT_FOR_PROMPT,
      select: { body: true },
    }),
  ]);
  const recent = [...recentDrafts, ...recentPosts].map((row) => row.body);

  const plan: DraftPlan = options.topic
    ? planTopic(options.topic)
    : planDraft({
        day: options.day,
        communityIndex,
        communitySlug: community.slug,
        usedOccasions: new Set(occasionRows.flatMap((row) => (row.occasion ? [row.occasion] : []))),
      });
  const occasion = plan.kind === "DATE" ? plan.occasion : null;
  const topic = plan.kind === "TOPIC" ? plan.topic : null;
  const input: EditorialDraftInput = {
    community: { name: community.name, description: community.description },
    kind: plan.kind,
    angle: plan.angle,
    occasion: occasion
      ? {
          name: occasion.name,
          dateText: occasionDateText(occasion.day),
          untilText: daysUntilText(options.day, occasion),
        }
      : null,
    topic,
    recent: recent.slice(0, RECENT_FOR_PROMPT).map((body) => body.slice(0, RECENT_EXCERPT_CHARS)),
  };

  let provider;
  let requestId: string;
  try {
    provider = await getAIProvider("editorial_draft");
    // Tarea del sistema: sin cuota por persona, dentro del presupuesto global y de su tope diario.
    ({ requestId } = await reserveAiRequest({
      userId: null,
      feature: "EDITORIAL_DRAFT",
      provider: {
        id: provider.id,
        model: provider.model,
        promptVersion: editorialDraftTask.promptVersion,
      },
      input: {
        communityId: community.id,
        day: options.day,
        kind: plan.kind,
        occasion: occasion?.key ?? null,
        topic,
      },
      featureDailyCapMicros: Math.round(EDITORIAL_DAILY_CAP_USD * 1_000_000),
      now: options.now,
    }));
  } catch (error) {
    if (error instanceof AIError) return { ok: false, reason: "budget" };
    throw error;
  }

  const started = Date.now();
  const fail = (errorCode: "INVALID_OUTPUT" | "PROVIDER_ERROR") =>
    db.aIRequest
      .update({
        where: { id: requestId },
        data: { status: "FAILED", errorCode, latencyMs: Date.now() - started },
      })
      .catch(() => undefined);

  let result;
  try {
    result = await withTimeout(provider.generate(editorialDraftTask, input), SERVICE_TIMEOUT_MS);
  } catch (error) {
    // Queda FAILED: su costo máximo sigue contando en el presupuesto del mes.
    await fail(providerFailure(error));
    return { ok: false, reason: "failed" };
  }

  const body = cleanDraftBody(result.output.body);
  if (!body || policyViolation(body)) {
    await fail("INVALID_OUTPUT");
    return { ok: false, reason: "rejected" };
  }
  const comparable = comparableText(body);
  if (recent.some((text) => comparableText(text) === comparable)) {
    await fail("INVALID_OUTPUT");
    return { ok: false, reason: "duplicate" };
  }

  const cost = recordedCost(provider.model, result.usage);
  if (!cost.known) console.error(`[redaccion] costo desconocido para ${provider.model}`);
  try {
    const [, , draft] = await db.$transaction([
      db.aIResponse.create({
        data: {
          requestId,
          output: { body },
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costMicrosUsd: cost.micros,
        },
      }),
      db.aIRequest.update({
        where: { id: requestId },
        data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
      }),
      db.editorialDraft.create({
        data: {
          communityId: community.id,
          kind: plan.kind,
          day: dayToDbDate(options.day),
          autoKey,
          body,
          occasion: occasion?.key ?? null,
          topic,
          provider: provider.id,
          model: provider.model,
          promptVersion: editorialDraftTask.promptVersion,
          requestId,
        },
        select: { id: true },
      }),
    ]);
    return { ok: true, draftId: draft.id };
  } catch (error) {
    // Otra corrida guardó a la vez el borrador automático de hoy: este sobra.
    if (isUniqueViolation(error)) {
      await fail("INVALID_OUTPUT");
      return { ok: false, reason: "exists" };
    }
    throw error;
  }
}

/** Los borradores que nadie revisó en `DRAFT_TTL_DAYS` días se descartan solos. */
export async function expireOldDrafts(day: Day, now: Date = new Date()): Promise<number> {
  const { count } = await db.editorialDraft.updateMany({
    where: { status: "PENDING", day: { lt: dayToDbDate(addDays(day, -DRAFT_TTL_DAYS)) } },
    data: { status: "DISCARDED", reviewedAt: now },
  });
  return count;
}

export type DailyDraftsSummary = {
  day: Day;
  status: DeskStatus;
  /** Borradores viejos descartados por no revisarse. */
  expired: number;
  created: number;
  /** Comunidades que ya tenían el de hoy o demasiados sin revisar. */
  skipped: number;
  failed: number;
  /** Comunidades que no se intentaron: se acabó el tiempo o el presupuesto. */
  notAttempted: number;
};

/**
 * Paso `editorial-drafts` de la operación diaria: un borrador automático por comunidad oficial.
 * Idempotente (repetirlo el mismo día no crea otro) y con tiempo acotado: lo que no alcance hoy se
 * puede pedir a mano desde /admin/redaccion. `only` limita la corrida a esas comunidades (pruebas, o
 * repetir una en particular); la posición de cada una sigue saliendo de la lista completa.
 */
export async function runDailyDrafts(
  now: Date = new Date(),
  options: { budgetMs?: number; only?: readonly string[] } = {},
): Promise<DailyDraftsSummary> {
  const { budgetMs = DAILY_RUN_BUDGET_MS, only } = options;
  const day = mexicoDay(now);
  const summary: DailyDraftsSummary = {
    day,
    status: "ready",
    expired: await expireOldDrafts(day, now),
    created: 0,
    skipped: 0,
    failed: 0,
    notAttempted: 0,
  };
  summary.status = await deskStatus();
  if (summary.status !== "ready") return summary;

  const queue = (await officialCommunities())
    .map((community, index) => ({ community, index }))
    .filter(({ community }) => !only || only.includes(community.id));
  const deadline = Date.now() + budgetMs;
  let next = 0;
  let outOfBudget = false;
  const worker = async () => {
    while (next < queue.length) {
      const { community, index } = queue[next++]!;
      if (outOfBudget || Date.now() > deadline) {
        summary.notAttempted += 1;
        continue;
      }
      const outcome = await createDraft(community, index, { day, now, auto: true }).catch(
        (error: unknown) => {
          console.error("[redaccion] no se pudo redactar un borrador", error);
          return { ok: false, reason: "failed" } as const;
        },
      );
      if (outcome.ok) summary.created += 1;
      else if (outcome.reason === "exists" || outcome.reason === "queue_full") summary.skipped += 1;
      else {
        summary.failed += 1;
        if (outcome.reason === "budget") outOfBudget = true;
      }
    }
  };
  await Promise.all(Array.from({ length: DAILY_RUN_CONCURRENCY }, worker));
  return summary;
}

/** Tema que escribe el equipo: una línea, sin datos de contacto y dentro del largo. */
export function cleanTopic(raw: string): string {
  return redactPersonalData(raw.replace(/\s+/g, " ").trim()).slice(0, TOPIC_MAX_CHARS);
}

/**
 * El equipo pide un borrador más para una comunidad, con o sin tema propio. El tema pasa por las
 * mismas reglas de contenido que todo lo que va a la IA.
 */
export async function requestDraft(
  adminUserId: string,
  input: { communityId: string; topic?: string },
  now: Date = new Date(),
): Promise<DraftOutcome> {
  await assertAdmin(adminUserId);
  const status = await deskStatus();
  if (status !== "ready") return { ok: false, reason: status };
  const communities = await officialCommunities();
  const index = communities.findIndex((community) => community.id === input.communityId);
  if (index < 0) return { ok: false, reason: "not_found" };
  const topic = input.topic ? cleanTopic(input.topic) : "";
  if (topic && policyViolation(topic)) return { ok: false, reason: "rejected" };
  return createDraft(communities[index]!, index, {
    day: mexicoDay(now),
    now,
    auto: false,
    ...(topic ? { topic } : {}),
  });
}

export type DeskDraft = {
  id: string;
  kind: DraftKind;
  body: string;
  topic: string | null;
  createdAt: Date;
  /** Lo escribió el simulador (desarrollo y pruebas), no un modelo. */
  simulated: boolean;
  community: { slug: string; name: string; emoji: string };
};

export type DeskPublished = {
  id: string;
  postId: string;
  excerpt: string;
  reviewedAt: Date;
  community: { slug: string; name: string; emoji: string };
};

export type Desk = {
  status: DeskStatus;
  pending: DeskDraft[];
  published: DeskPublished[];
  communities: { id: string; name: string; emoji: string }[];
};

const communityChip = { select: { slug: true, name: true, emoji: true } } as const;

/** Lo que ve el equipo en /admin/redaccion: por revisar, lo último publicado y las comunidades. */
export async function getDesk(adminUserId: string): Promise<Desk> {
  await assertAdmin(adminUserId);
  const [status, pending, published, communities] = await Promise.all([
    deskStatus(),
    db.editorialDraft.findMany({
      where: { status: "PENDING" },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 60,
      select: {
        id: true,
        kind: true,
        body: true,
        topic: true,
        provider: true,
        createdAt: true,
        community: communityChip,
      },
    }),
    db.editorialDraft.findMany({
      where: { status: "PUBLISHED", postId: { not: null }, reviewedAt: { not: null } },
      orderBy: { reviewedAt: "desc" },
      take: 8,
      select: { id: true, body: true, postId: true, reviewedAt: true, community: communityChip },
    }),
    db.community.findMany({
      where: { isOfficial: true },
      orderBy: [{ sortOrder: "asc" }, { slug: "asc" }],
      select: { id: true, name: true, emoji: true },
    }),
  ]);
  return {
    status,
    pending: pending.map(({ provider, ...draft }) => ({
      ...draft,
      simulated: provider === SIMULATED_PROVIDER_ID,
    })),
    published: published.flatMap((draft) =>
      draft.postId && draft.reviewedAt
        ? [
            {
              id: draft.id,
              postId: draft.postId,
              excerpt: draft.body.slice(0, 140),
              reviewedAt: draft.reviewedAt,
              community: draft.community,
            },
          ]
        : [],
    ),
    communities,
  };
}

export type PublishOutcome =
  | { ok: true; postId: string; communitySlug: string }
  | { ok: false; reason: "not_found" | "already_reviewed" | "invalid_body" | "account_conflict" };

/**
 * Publica un borrador con el texto que dejó quien lo revisó. La publicación es de la cuenta
 * editorial de la comunidad y lleva la marca de IA. Dos toques seguidos (o dos personas a la vez)
 * publican una sola vez: el borrador se toma con su estado PENDING dentro de la transacción.
 */
export async function publishDraft(
  adminUserId: string,
  draftId: string,
  body: string,
  now: Date = new Date(),
): Promise<PublishOutcome> {
  await assertAdmin(adminUserId);
  const text = body.replace(/\r\n?/g, "\n").trim();
  if (!text || text.length > MAX_POST_LENGTH) return { ok: false, reason: "invalid_body" };
  const draft = await db.editorialDraft.findUnique({
    where: { id: draftId },
    select: { status: true, community: { select: { id: true, slug: true, name: true } } },
  });
  if (!draft) return { ok: false, reason: "not_found" };
  if (draft.status !== "PENDING") return { ok: false, reason: "already_reviewed" };

  let authorId: string;
  try {
    authorId = await ensureEditorialAccount(db, draft.community);
  } catch (error) {
    if (!(error instanceof EditorialAccountConflictError)) throw error;
    console.error(`${error.message} (comunidad ${draft.community.slug})`);
    return { ok: false, reason: "account_conflict" };
  }
  return db.$transaction(async (tx) => {
    const claimed = await tx.editorialDraft.updateMany({
      where: { id: draftId, status: "PENDING" },
      data: { status: "PUBLISHED", reviewedById: adminUserId, reviewedAt: now, body: text },
    });
    if (claimed.count === 0) return { ok: false, reason: "already_reviewed" } as const;
    const post = await tx.post.create({
      data: {
        authorId,
        communityId: draft.community.id,
        body: text,
        isAiGenerated: true,
        publishedAt: now,
      },
      select: { id: true },
    });
    await tx.editorialDraft.update({ where: { id: draftId }, data: { postId: post.id } });
    return { ok: true, postId: post.id, communitySlug: draft.community.slug } as const;
  });
}

/** Descarta un borrador pendiente. `false` si ya no estaba pendiente (o no existe). */
export async function discardDraft(
  adminUserId: string,
  draftId: string,
  now: Date = new Date(),
): Promise<boolean> {
  await assertAdmin(adminUserId);
  const { count } = await db.editorialDraft.updateMany({
    where: { id: draftId, status: "PENDING" },
    data: { status: "DISCARDED", reviewedById: adminUserId, reviewedAt: now },
  });
  return count > 0;
}
