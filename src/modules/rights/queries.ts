import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  CounterNoticeBasis,
  NotificationType,
  ReportTargetType,
  RightsNoticeStatus,
} from "@/generated/prisma/enums";
import { db } from "@/server/db";
import type { SiteRef } from "./urls";

export type Tx = Prisma.TransactionClient;
type Client = Tx | typeof db;

/** Contenido de speeaking que señala un aviso, con quien lo subió (a quien se avisa). */
export type ResolvedTarget = {
  targetType: ReportTargetType;
  targetId: string;
  ownerId: string | null;
  url: string;
};

// ─────────────────────────── Resolver direcciones ───────────────────────────

/**
 * Busca lo que señala una dirección de speeaking. Cuenta aunque esté oculto o retirado (el equipo ve
 * su estado). Una foto o un video cuentan por lo que los usa: publicaciones, productos y el perfil
 * del que son foto o portada (la portada de un video, por el video).
 */
export async function findTargetsForRef(ref: SiteRef, url: string): Promise<ResolvedTarget[]> {
  switch (ref.kind) {
    case "POST": {
      const post = await db.post.findUnique({
        where: { id: ref.postId },
        select: { id: true, authorId: true },
      });
      return post ? [{ targetType: "POST", targetId: post.id, ownerId: post.authorId, url }] : [];
    }
    case "PRODUCT": {
      const product = await db.product.findUnique({
        where: { slug: ref.slug },
        select: { id: true, seller: { select: { userId: true } } },
      });
      return product
        ? [{ targetType: "PRODUCT", targetId: product.id, ownerId: product.seller.userId, url }]
        : [];
    }
    case "USER": {
      const profile = await db.profile.findUnique({
        where: { username: ref.username },
        select: { userId: true },
      });
      return profile
        ? [{ targetType: "USER", targetId: profile.userId, ownerId: profile.userId, url }]
        : [];
    }
    case "MEDIA": {
      const usage = {
        postLinks: { select: { post: { select: { id: true, authorId: true } } } },
        productLinks: {
          select: { product: { select: { id: true, seller: { select: { userId: true } } } } },
        },
        profileAvatar: { select: { userId: true } },
        profileCover: { select: { userId: true } },
      } as const;
      const media = await db.media.findUnique({
        where: { storageKey: ref.storageKey },
        select: { ...usage, posterOf: { select: usage } },
      });
      if (!media) return [];
      const targets: ResolvedTarget[] = [];
      for (const item of media.posterOf ? [media, media.posterOf] : [media]) {
        for (const { post } of item.postLinks) {
          targets.push({ targetType: "POST", targetId: post.id, ownerId: post.authorId, url });
        }
        for (const { product } of item.productLinks) {
          targets.push({
            targetType: "PRODUCT",
            targetId: product.id,
            ownerId: product.seller.userId,
            url,
          });
        }
        for (const profile of [item.profileAvatar, item.profileCover]) {
          if (profile) {
            targets.push({
              targetType: "USER",
              targetId: profile.userId,
              ownerId: profile.userId,
              url,
            });
          }
        }
      }
      return targets;
    }
  }
}

// ─────────────────────────────── Aviso ───────────────────────────────

/**
 * Crea los casos de un aviso (uno por cuenta, `owner-cases.ts`) en una sola transacción: o se
 * guardan todos o ninguno. Los números de caso quedan en el mismo orden.
 */
export function createNotices(
  cases: readonly {
    data: Omit<Prisma.RightsNoticeUncheckedCreateInput, "targets" | "counterNotices">;
    targets: readonly ResolvedTarget[];
  }[],
) {
  return db.$transaction(async (tx) => {
    const created: { id: string; number: number }[] = [];
    // Uno tras otro: en una transacción todas van por la misma conexión.
    for (const { data, targets } of cases) {
      created.push(
        await tx.rightsNotice.create({
          data: {
            ...data,
            targets: {
              create: targets.map((target) => ({
                targetType: target.targetType,
                targetId: target.targetId,
                ownerId: target.ownerId,
                url: target.url,
              })),
            },
          },
          select: { id: true, number: true },
        }),
      );
    }
    return created;
  });
}

const TARGET_SELECT = {
  id: true,
  targetType: true,
  targetId: true,
  ownerId: true,
  url: true,
} as const satisfies Prisma.RightsNoticeTargetSelect;

const COUNTER_SELECT = {
  id: true,
  userId: true,
  name: true,
  email: true,
  domicile: true,
  basis: true,
  explanation: true,
  createdAt: true,
  forwardedAt: true,
} as const satisfies Prisma.CounterNoticeSelect;

/** Todo el expediente (solo para el equipo o para decidir qué ve cada quien en el servicio). */
const NOTICE_SELECT = {
  id: true,
  number: true,
  kind: true,
  status: true,
  claimantName: true,
  claimantEmail: true,
  claimantAltEmail: true,
  claimantPhone: true,
  claimantDomicile: true,
  claimantRole: true,
  principalName: true,
  workDescription: true,
  rightDescription: true,
  facts: true,
  urls: true,
  trademarkRegistration: true,
  swornStatement: true,
  penaltyAcknowledged: true,
  submittedById: true,
  receivedAt: true,
  contentRemovedAt: true,
  uploaderNotifiedAt: true,
  counterNoticeAt: true,
  restoreDueAt: true,
  restoredAt: true,
  decidedById: true,
  decisionNote: true,
  decidedBy: { select: { profile: { select: { username: true } } } },
  targets: { select: TARGET_SELECT, orderBy: { createdAt: "asc" } },
  counterNotices: { select: COUNTER_SELECT, orderBy: { createdAt: "asc" } },
} as const satisfies Prisma.RightsNoticeSelect;

export type NoticeRecord = Prisma.RightsNoticeGetPayload<{ select: typeof NOTICE_SELECT }>;

export function findNoticeByNumber(number: number): Promise<NoticeRecord | null> {
  return db.rightsNotice.findUnique({ where: { number }, select: NOTICE_SELECT });
}

export function findNoticeById(id: string): Promise<NoticeRecord | null> {
  return db.rightsNotice.findUnique({ where: { id }, select: NOTICE_SELECT });
}

/** Etapa y fechas del caso, sin relaciones (dentro de la transacción del caso bloqueado). */
export function findNoticeState(tx: Tx, id: string) {
  return tx.rightsNotice.findUnique({
    where: { id },
    select: { status: true, restoreDueAt: true, counterNoticeAt: true },
  });
}

export async function hasCounterNoticeFrom(tx: Tx, noticeId: string, userId: string) {
  return (await tx.counterNotice.count({ where: { noticeId, userId } })) > 0;
}

/** Avisos para la lista del equipo: los abiertos primero (el más antiguo arriba). */
export async function listNotices(take = 200) {
  const select = {
    id: true,
    number: true,
    kind: true,
    status: true,
    claimantName: true,
    urls: true,
    receivedAt: true,
    contentRemovedAt: true,
    restoreDueAt: true,
    targets: { select: { targetType: true, ownerId: true } },
  } as const satisfies Prisma.RightsNoticeSelect;
  const open: RightsNoticeStatus[] = ["RECEIVED", "CONTENT_REMOVED", "COUNTER_NOTICE_RECEIVED"];
  const [openRows, closedRows] = await Promise.all([
    db.rightsNotice.findMany({
      where: { status: { in: open } },
      orderBy: { receivedAt: "asc" },
      take,
      select,
    }),
    db.rightsNotice.findMany({
      where: { status: { notIn: open } },
      orderBy: { receivedAt: "desc" },
      take,
      select,
    }),
  ]);
  return { open: openRows, closed: closedRows };
}

/** Cómo se llama y dónde está cada cosa señalada (para el equipo y para quien la subió). */
export async function findTargetDetails(
  targets: readonly { targetType: ReportTargetType; targetId: string }[],
) {
  const ids = (type: ReportTargetType) =>
    targets.filter((target) => target.targetType === type).map((target) => target.targetId);
  const [posts, products, profiles] = await Promise.all([
    db.post.findMany({
      where: { id: { in: ids("POST") } },
      select: { id: true, body: true, status: true },
    }),
    db.product.findMany({
      where: { id: { in: ids("PRODUCT") } },
      select: { id: true, slug: true, title: true, moderationStatus: true },
    }),
    db.profile.findMany({
      where: { userId: { in: ids("USER") } },
      select: { userId: true, username: true, displayName: true },
    }),
  ]);
  return { posts, products, profiles };
}

/** Perfil público de quienes subieron lo señalado (nombre de usuario para buscarlos). */
export function findOwnerProfiles(userIds: readonly string[]) {
  return db.profile.findMany({
    where: { userId: { in: [...userIds] } },
    select: { userId: true, username: true, displayName: true },
  });
}

/** Avisos que pueden contar como falta para esas personas (el código decide cuáles cuentan). */
export function listStrikeCandidates(ownerIds: readonly string[], since: Date) {
  return db.rightsNotice.findMany({
    where: {
      status: { in: ["CONTENT_REMOVED", "KEPT_DOWN", "COUNTER_NOTICE_RECEIVED"] },
      contentRemovedAt: { gte: since },
      targets: { some: { ownerId: { in: [...ownerIds] } } },
    },
    select: {
      status: true,
      contentRemovedAt: true,
      restoreDueAt: true,
      targets: { select: { ownerId: true } },
    },
  });
}

/** Correos de quienes subieron lo señalado (para avisarles también por correo, si hay proveedor). */
export function findUserEmails(userIds: readonly string[]) {
  return db.user.findMany({
    where: { id: { in: [...userIds] } },
    select: { id: true, email: true },
  });
}

// ───────────────────────── Escrituras del equipo ─────────────────────────

/** Transacción con el aviso bloqueado (FOR UPDATE): dos acciones sobre el mismo caso van en fila. */
export function withNoticeLock<T>(noticeId: string, work: (tx: Tx) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT 1 FROM "rights_notices" WHERE "id" = ${noticeId}::uuid FOR UPDATE`;
    return work(tx);
  });
}

export function updateNotice(tx: Tx, id: string, data: Prisma.RightsNoticeUncheckedUpdateInput) {
  return tx.rightsNotice.update({ where: { id }, data, select: { id: true } });
}

/** Fotos y videos de las publicaciones y productos señalados (para bloquear su nueva subida). */
export async function findTargetMediaIds(
  tx: Tx,
  targets: readonly { targetType: ReportTargetType; targetId: string }[],
) {
  const ids = (type: ReportTargetType) =>
    targets.filter((target) => target.targetType === type).map((target) => target.targetId);
  // Una tras otra: en una transacción todas van por la misma conexión.
  const postMedia = await tx.postMedia.findMany({
    where: { postId: { in: ids("POST") } },
    select: { mediaId: true },
  });
  const productMedia = await tx.productMedia.findMany({
    where: { productId: { in: ids("PRODUCT") } },
    select: { mediaId: true },
  });
  return [...new Set([...postMedia, ...productMedia].map((row) => row.mediaId))];
}

/** Al restaurar, lo que bloqueó este aviso se puede volver a subir. */
export function unblockNoticeHashes(tx: Tx, noticeId: string) {
  return tx.blockedMediaHash.deleteMany({ where: { noticeId, reason: "RIGHTS_NOTICE" } });
}

/**
 * ¿Lo oculto sigue oculto por un aviso de derechos? Solo si la última decisión de moderación sobre
 * ese contenido fue retirarlo por un aviso (este u otro que se cerró antes, si el contenido lo
 * señalaban los dos): si ya estaba oculto por otra razón, o alguien lo restauró y lo volvió a ocultar
 * por otra, restaurar el caso no lo toca. Lo que otro aviso vigente mantiene retirado lo descarta
 * antes `findTargetsUnderOtherNotices`.
 */
export async function isHiddenByRightsNotice(target: {
  targetType: "POST" | "PRODUCT";
  targetId: string;
}): Promise<boolean> {
  const latest = await db.platformDecision.findFirst({
    where: {
      kind: { startsWith: "moderation." },
      newValue: { path: ["targetId"], equals: target.targetId },
    },
    orderBy: [{ decidedAt: "desc" }, { createdAt: "desc" }],
    select: { kind: true },
  });
  return latest?.kind === `moderation.rights_hide_${target.targetType.toLowerCase()}`;
}

/** Etapas en las que un aviso mantiene retirado lo que señala. */
const KEEPS_DOWN: RightsNoticeStatus[] = [
  "CONTENT_REMOVED",
  "COUNTER_NOTICE_RECEIVED",
  "KEPT_DOWN",
];

/**
 * De lo que señala un aviso, lo que también señala OTRO aviso que lo mantiene retirado (p. ej. quien
 * avisa mandó el mismo aviso dos veces): restaurar o cerrar el primero no lo debe volver a mostrar
 * ni soltar sus archivos.
 */
export function findTargetsUnderOtherNotices(
  noticeId: string,
  targets: readonly { targetType: ReportTargetType; targetId: string }[],
) {
  if (targets.length === 0) return Promise.resolve([]);
  return db.rightsNoticeTarget.findMany({
    where: {
      noticeId: { not: noticeId },
      notice: { status: { in: KEEPS_DOWN } },
      OR: targets.map((target) => ({ targetType: target.targetType, targetId: target.targetId })),
    },
    select: {
      targetType: true,
      targetId: true,
      noticeId: true,
      notice: { select: { number: true } },
    },
  });
}

/**
 * Avisos de la campana a quienes subieron lo señalado (`CONTENT_REMOVED` / `CONTENT_RESTORED`), en
 * la misma transacción que el cambio del caso: `uploaderNotifiedAt` solo se guarda si el aviso
 * existe. Uno por persona, caso y evento (`dedupeKey`, ver `notification-key.ts`); si el evento
 * vuelve a pasar (restaurar, volver a retirar y restaurar otra vez), el mismo aviso se renueva: sube
 * arriba y queda sin leer. La etapa del caso, revisada con el caso bloqueado, impide repetirlo por
 * un doble clic.
 */
export async function upsertRightsNotifications(
  tx: Tx,
  rows: readonly {
    recipientId: string;
    type: Extract<NotificationType, "CONTENT_REMOVED" | "CONTENT_RESTORED">;
    dedupeKey: string;
  }[],
  now: Date,
) {
  for (const row of rows) {
    await tx.notification.upsert({
      where: { dedupeKey: row.dedupeKey },
      create: {
        recipientId: row.recipientId,
        type: row.type,
        dedupeKey: row.dedupeKey,
        createdAt: now,
      },
      update: { readAt: null, createdAt: now },
    });
  }
  return rows.length;
}

/**
 * Bitácora del caso en `PlatformDecision` (quién, qué, antes, después y nota), como la de la cola
 * de moderación: `kind` `moderation.rights.<acción>` la deja fuera del Centro de decisiones.
 */
export function logRightsDecision(
  tx: Tx,
  entry: {
    action: string;
    title: string;
    actorUserId: string;
    previousValue: Prisma.InputJsonValue;
    newValue: Prisma.InputJsonValue;
    reason: string | null;
    now: Date;
  },
) {
  return tx.platformDecision.create({
    data: {
      actor: "HUMAN",
      kind: `moderation.rights.${entry.action}`,
      title: entry.title,
      hypothesis: "Aviso de derechos (LFDA art. 114 Octies): decisión del equipo, no del motor.",
      riskLevel: "MEDIUM",
      status: "APPLIED",
      previousValue: entry.previousValue,
      newValue: entry.newValue,
      reason: entry.reason,
      approvedById: entry.actorUserId,
      decidedAt: entry.now,
      appliedAt: entry.now,
    },
    select: { id: true },
  });
}

// ─────────────────────────────── Contra-aviso ───────────────────────────────

export function createCounterNotice(
  tx: Tx,
  data: {
    noticeId: string;
    userId: string;
    name: string;
    email: string;
    domicile: string;
    basis: CounterNoticeBasis;
    explanation: string;
    now: Date;
  },
) {
  return tx.counterNotice.create({
    data: {
      noticeId: data.noticeId,
      userId: data.userId,
      name: data.name,
      email: data.email,
      domicile: data.domicile,
      basis: data.basis,
      explanation: data.explanation,
      swornStatement: true,
      penaltyAcknowledged: true,
      createdAt: data.now,
    },
    select: COUNTER_SELECT,
  });
}

/** La copia del contra-aviso ya se mandó a quien avisó. Solo la primera vez cuenta. */
export function markCounterNoticeForwarded(
  counterNoticeId: string,
  noticeId: string,
  now: Date,
  client: Client = db,
) {
  return client.counterNotice.updateMany({
    where: { id: counterNoticeId, noticeId, forwardedAt: null },
    data: { forwardedAt: now },
  });
}
