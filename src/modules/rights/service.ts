import "server-only";
import { siteConfig } from "@/config/site";
import type {
  CounterNoticeBasis,
  ReportTargetType,
  RightsClaimantRole,
  RightsNoticeKind,
  RightsNoticeStatus,
} from "@/generated/prisma/enums";
import { assertAdmin } from "@/modules/admin/service";
import { moderateForRightsNotice } from "@/modules/trust/service";
import { env } from "@/server/env";
import { addBusinessDays, RESTORE_AFTER_BUSINESS_DAYS } from "./business-days";
import { formatCaseNumber } from "./case-number";
import { absoluteUrl, rightsEmailEnabled, sendRightsEmail } from "./email";
import {
  CLAIMANT_ROLE_LABELS,
  COUNTER_NOTICE_BASIS_LABELS,
  RIGHTS_KIND_SHORT,
  RIGHTS_STATUS_LABELS,
} from "./labels";
import {
  contentKeptDownEmail,
  contentRemovedEmail,
  counterNoticeCopyEmail,
  type EmailText,
  noticeAcknowledgementEmail,
} from "./messages";
import {
  type RightsNotificationEvent,
  rightsNotificationKey,
  rightsSubject,
} from "./notification-key";
import { type ResolvedLine, splitByOwner } from "./owner-cases";
import * as q from "./queries";
import type { CounterNoticeInput, NoticeInput, RightsAdminAction } from "./schemas";
import { blockMediaHashes } from "./stay-down";
import { countStrikes, STRIKE_THRESHOLD, strikeWindowStart } from "./strikes";
import {
  allowedDecisions,
  canDecide,
  isAutoTarget,
  keepDownHidesAgain,
  type RightsDecision,
  restoreNeedsNote,
} from "./transitions";
import { MAX_URL_LENGTH, normalizeUrl, siteHosts, siteRefFromUrl } from "./urls";

/**
 * Aviso y retirada de la LFDA (art. 114 Octies; RLFDA arts. 37 Ter–37 Nonies, ADR-076): canal formal,
 * sin anonimato, distinto de «Reportar». Sin dependencias de Next: la autorización vive aquí
 * (`assertAdmin` en todo lo del equipo; quien subió el contenido solo ve SU caso).
 *
 * Lo decide siempre una persona del equipo; el código guarda las fechas, calcula el plazo del
 * contra-aviso y cuenta las faltas (P2). Lo que escribe quien avisa es dato no confiable.
 */
export class RightsError extends Error {
  override name = "RightsError";
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "NOT_ALLOWED"
      | "NO_TARGETS"
      | "MANUAL_PENDING"
      | "NOTE_REQUIRED"
      | "ALREADY_FILED"
      | "NOT_REMOVED_YET"
      | "CLOSED",
  ) {
    super(code);
  }
}

const TARGET_TYPE_LABELS: Record<ReportTargetType, string> = {
  POST: "Publicación",
  PRODUCT: "Producto",
  USER: "Perfil (foto, portada o datos)",
  COMMENT: "Comentario",
};

function excerpt(text: string, max = 100) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

function caseUrlPath(number: number) {
  return `/derechos-de-autor/contra-aviso?caso=${formatCaseNumber(number)}`;
}

function targetKey(target: { targetType: ReportTargetType; targetId: string }) {
  return `${target.targetType}:${target.targetId}`;
}

type AutoTargetRow<T> = T & { targetType: "POST" | "PRODUCT"; targetId: string };

function isAutoRow<T extends { targetType: ReportTargetType; targetId: string }>(
  row: T,
): row is AutoTargetRow<T> {
  return isAutoTarget(row.targetType);
}

/** Contenidos agrupados por el aviso que los señala. */
function groupByNotice<T extends { noticeId: string }>(rows: readonly T[]) {
  const groups = new Map<string, T[]>();
  for (const row of rows) groups.set(row.noticeId, [...(groups.get(row.noticeId) ?? []), row]);
  return groups;
}

/** Quién subió qué: una entrada por persona con los tipos de lo suyo (para avisarle una vez). */
function ownersOf(targets: readonly { ownerId: string | null; targetType: ReportTargetType }[]) {
  const owners = new Map<string, ReportTargetType[]>();
  for (const target of targets) {
    if (!target.ownerId) continue;
    owners.set(target.ownerId, [...(owners.get(target.ownerId) ?? []), target.targetType]);
  }
  return owners;
}

// ─────────────────────────────── Aviso ───────────────────────────────

/**
 * Lo de speeaking que señala cada dirección, renglón por renglón. Las de otros sitios no señalan
 * nada aquí, pero el aviso las conserva tal como se escribieron.
 */
async function resolveNoticeLines(
  urls: readonly string[],
): Promise<ResolvedLine<q.ResolvedTarget>[]> {
  const hosts = siteHosts([env.APP_URL, siteConfig.url]);
  const lines: ResolvedLine<q.ResolvedTarget>[] = [];
  for (const raw of urls) {
    const url = normalizeUrl(raw);
    const ref = url ? siteRefFromUrl(url, hosts) : null;
    lines.push({
      raw,
      targets: url && ref ? await q.findTargetsForRef(ref, url.href.slice(0, MAX_URL_LENGTH)) : [],
    });
  }
  return lines;
}

export type SubmittedCase = { id: string; number: number; caseNumber: string; targetCount: number };

export type SubmittedNotice = {
  /** Uno por cada cuenta que subió lo señalado (`owner-cases.ts`); casi siempre, uno. */
  cases: SubmittedCase[];
  /** Se mandó el acuse por correo (solo si hay proveedor). */
  emailSent: boolean;
};

/**
 * Recibe un aviso (con o sin cuenta) y devuelve su número de caso: uno por cada cuenta que subió lo
 * señalado, para que cada quien responda por lo suyo y se restaure solo lo de quien mandó
 * contra-aviso (RLFDA art. 37 Nonies).
 */
export async function submitNotice(
  input: NoticeInput,
  { submittedById, now = new Date() }: { submittedById: string | null; now?: Date },
): Promise<SubmittedNotice> {
  const ownerCases = splitByOwner(await resolveNoticeLines(input.urls));
  const created = await q.createNotices(
    ownerCases.map(({ urls, targets }) => ({
      data: {
        kind: input.kind,
        claimantName: input.claimantName,
        claimantEmail: input.claimantEmail,
        claimantAltEmail: input.claimantAltEmail ?? null,
        claimantPhone: input.claimantPhone ?? null,
        claimantDomicile: input.claimantDomicile ?? null,
        claimantRole: input.claimantRole,
        principalName: input.principalName ?? null,
        workDescription: input.workDescription,
        rightDescription: input.rightDescription,
        facts: input.facts ?? null,
        urls,
        trademarkRegistration: input.trademarkRegistration ?? null,
        swornStatement: input.swornStatement,
        penaltyAcknowledged: input.penaltyAcknowledged,
        submittedById,
        receivedAt: now,
      },
      targets,
    })),
  );
  const emailSent = await sendRightsEmail({
    to: [input.claimantEmail, ...(input.claimantAltEmail ? [input.claimantAltEmail] : [])],
    ...noticeAcknowledgementEmail({
      numbers: created.map((item) => item.number),
      kind: input.kind,
      receivedAt: now,
      urlCount: input.urls.length,
    }),
  });
  return {
    cases: created.map((item, index) => ({
      id: item.id,
      number: item.number,
      caseNumber: formatCaseNumber(item.number),
      targetCount: ownerCases[index]!.targets.length,
    })),
    emailSent,
  };
}

// ─────────────────────── Quien subió el contenido ───────────────────────

export type OwnerCaseView = {
  caseNumber: string;
  kind: RightsNoticeKind;
  kindLabel: string;
  status: RightsNoticeStatus;
  statusLabel: string;
  receivedAt: Date;
  contentRemovedAt: Date | null;
  restoreDueAt: Date | null;
  restoredAt: Date | null;
  /** El aviso formal no es anónimo: nombre y correo de quien avisó (y de quien representa). */
  claimant: { name: string; principalName: string | null; email: string };
  workDescription: string;
  rightDescription: string;
  facts: string | null;
  /** Solo lo suyo dentro del caso. */
  targets: { typeLabel: string; label: string; href: string | null; state: string }[];
  myCounterNotice: { createdAt: Date; basisLabel: string; forwarded: boolean } | null;
  canFile: boolean;
};

/**
 * El caso visto por quien subió lo señalado. `null` si no existe, si nada de lo señalado es suyo o
 * si todavía no se retiró nada (la misma respuesta: no revela qué casos existen). Quién avisó se
 * comparte para que pueda mandar su contra-aviso, así que solo después del retiro: un aviso
 * pendiente o rechazado no expone a quien lo mandó (los números de caso son consecutivos).
 */
export async function getOwnerCase(userId: string, number: number): Promise<OwnerCaseView | null> {
  const notice = await q.findNoticeByNumber(number);
  if (!notice?.contentRemovedAt) return null;
  const mine = notice.targets.filter((target) => target.ownerId === userId);
  if (mine.length === 0) return null;
  const details = await q.findTargetDetails(mine);
  const counter = notice.counterNotices.find((item) => item.userId === userId) ?? null;
  return {
    caseNumber: formatCaseNumber(notice.number),
    kind: notice.kind,
    kindLabel: RIGHTS_KIND_SHORT[notice.kind],
    status: notice.status,
    statusLabel: RIGHTS_STATUS_LABELS[notice.status],
    receivedAt: notice.receivedAt,
    contentRemovedAt: notice.contentRemovedAt,
    restoreDueAt: notice.restoreDueAt,
    restoredAt: notice.restoredAt,
    claimant: {
      name: notice.claimantName,
      principalName: notice.claimantRole === "REPRESENTATIVE" ? notice.principalName : null,
      email: notice.claimantEmail,
    },
    workDescription: notice.workDescription,
    rightDescription: notice.rightDescription,
    facts: notice.facts,
    targets: mine.map((target) => describeTarget(target, details)),
    myCounterNotice: counter
      ? {
          createdAt: counter.createdAt,
          basisLabel: COUNTER_NOTICE_BASIS_LABELS[counter.basis],
          forwarded: counter.forwardedAt !== null,
        }
      : null,
    canFile:
      !counter &&
      (notice.status === "CONTENT_REMOVED" || notice.status === "COUNTER_NOTICE_RECEIVED"),
  };
}

type TargetDetails = Awaited<ReturnType<typeof q.findTargetDetails>>;

function describeTarget(
  target: { targetType: ReportTargetType; targetId: string },
  details: TargetDetails,
): { typeLabel: string; label: string; href: string | null; state: string } {
  const typeLabel = TARGET_TYPE_LABELS[target.targetType];
  switch (target.targetType) {
    case "POST": {
      const post = details.posts.find((item) => item.id === target.targetId);
      if (!post) return { typeLabel, label: "Ya no existe", href: null, state: "Ya no existe" };
      return {
        typeLabel,
        label: excerpt(post.body) || "(sin texto)",
        href: `/p/${post.id}`,
        state:
          post.status === "PUBLISHED"
            ? "Visible"
            : post.status === "HIDDEN"
              ? "Oculta"
              : "Borrada por su autor",
      };
    }
    case "PRODUCT": {
      const product = details.products.find((item) => item.id === target.targetId);
      if (!product) return { typeLabel, label: "Ya no existe", href: null, state: "Ya no existe" };
      return {
        typeLabel,
        label: product.title,
        href: `/producto/${product.slug}`,
        state: product.moderationStatus === "HIDDEN" ? "Oculto" : "Visible",
      };
    }
    case "USER": {
      const profile = details.profiles.find((item) => item.userId === target.targetId);
      if (!profile) return { typeLabel, label: "Ya no existe", href: null, state: "Ya no existe" };
      return {
        typeLabel,
        label: `${profile.displayName} (@${profile.username})`,
        href: `/u/${profile.username}`,
        state: "Se revisa a mano",
      };
    }
    case "COMMENT":
      return { typeLabel, label: "Comentario", href: null, state: "Se revisa a mano" };
  }
}

export type FiledCounterNotice = { caseNumber: string; restoreDueAt: Date; forwarded: boolean };

/**
 * Contra-aviso (RLFDA art. 37 Septies) de quien subió algo señalado por el caso, después de que se
 * retiró. Uno por persona y caso. Se restaura `RESTORE_AFTER_BUSINESS_DAYS` días hábiles después
 * (si llegan varios, cuenta el último); la copia va a quien avisó al momento si hay correo.
 */
export async function submitCounterNotice(
  userId: string,
  input: CounterNoticeInput,
  now: Date = new Date(),
): Promise<FiledCounterNotice> {
  const notice = await q.findNoticeByNumber(input.caseNumber);
  // Como `getOwnerCase`: un caso sin retiro no existe para quien subió el contenido.
  if (!notice?.contentRemovedAt || !notice.targets.some((target) => target.ownerId === userId)) {
    throw new RightsError("NOT_FOUND");
  }
  const { counter, restoreDueAt } = await q.withNoticeLock(notice.id, async (tx) => {
    const current = await q.findNoticeState(tx, notice.id);
    if (!current) throw new RightsError("NOT_FOUND");
    if (await q.hasCounterNoticeFrom(tx, notice.id, userId)) {
      throw new RightsError("ALREADY_FILED");
    }
    if (current.status === "RECEIVED") throw new RightsError("NOT_REMOVED_YET");
    if (current.status !== "CONTENT_REMOVED" && current.status !== "COUNTER_NOTICE_RECEIVED") {
      throw new RightsError("CLOSED");
    }
    const due = addBusinessDays(now, RESTORE_AFTER_BUSINESS_DAYS);
    const restoreDueAt =
      current.restoreDueAt && current.restoreDueAt > due ? current.restoreDueAt : due;
    const counter = await q.createCounterNotice(tx, {
      noticeId: notice.id,
      userId,
      name: input.name,
      email: input.email,
      domicile: input.domicile,
      basis: input.basis,
      explanation: input.explanation,
      now,
    });
    await q.updateNotice(tx, notice.id, {
      status: "COUNTER_NOTICE_RECEIVED",
      counterNoticeAt: current.counterNoticeAt ?? now,
      restoreDueAt,
    });
    return { counter, restoreDueAt };
  });

  const forwarded = await sendRightsEmail({
    to: [notice.claimantEmail, ...(notice.claimantAltEmail ? [notice.claimantAltEmail] : [])],
    ...counterNoticeCopyEmail({ number: notice.number, counter, restoreDueAt }),
  });
  if (forwarded) await q.markCounterNoticeForwarded(counter.id, notice.id, new Date());
  return { caseNumber: formatCaseNumber(notice.number), restoreDueAt, forwarded };
}

// ─────────────────────────────── Equipo ───────────────────────────────

export type AdminOwner = {
  userId: string;
  username: string | null;
  displayName: string | null;
  strikes: number;
  /** Con `STRIKE_THRESHOLD` faltas o más: revisar el cierre de la cuenta (nunca automático). */
  reviewClosure: boolean;
};

export type AdminNoticeRow = {
  id: string;
  caseNumber: string;
  kindLabel: string;
  status: RightsNoticeStatus;
  statusLabel: string;
  claimantName: string;
  receivedAt: Date;
  urlCount: number;
  targetCount: number;
  manualTargetCount: number;
  owners: AdminOwner[];
  restoreDueAt: Date | null;
  /** Hay contra-aviso y ya venció su plazo: toca restaurar (si no hubo acción legal). */
  restoreDue: boolean;
};

async function ownersWithStrikes(ownerIds: readonly string[], now: Date): Promise<AdminOwner[]> {
  const unique = [...new Set(ownerIds)];
  if (unique.length === 0) return [];
  const [profiles, candidates] = await Promise.all([
    q.findOwnerProfiles(unique),
    q.listStrikeCandidates(unique, strikeWindowStart(now)),
  ]);
  return unique.map((userId) => {
    const profile = profiles.find((item) => item.userId === userId);
    const strikes = countStrikes(
      candidates.filter((notice) => notice.targets.some((target) => target.ownerId === userId)),
      now,
    );
    return {
      userId,
      username: profile?.username ?? null,
      displayName: profile?.displayName ?? null,
      strikes,
      reviewClosure: strikes >= STRIKE_THRESHOLD,
    };
  });
}

/** Lista de casos para /admin/avisos: los abiertos (el más antiguo arriba) y los cerrados. */
export async function listNoticesForAdmin(
  actorUserId: string,
  now: Date = new Date(),
): Promise<{ open: AdminNoticeRow[]; closed: AdminNoticeRow[] }> {
  await assertAdmin(actorUserId);
  const { open, closed } = await q.listNotices();
  const owners = await ownersWithStrikes(
    [...open, ...closed].flatMap((notice) =>
      notice.targets.flatMap((target) => (target.ownerId ? [target.ownerId] : [])),
    ),
    now,
  );
  const row = (notice: (typeof open)[number]): AdminNoticeRow => {
    const ownerIds = new Set(notice.targets.flatMap((t) => (t.ownerId ? [t.ownerId] : [])));
    return {
      id: notice.id,
      caseNumber: formatCaseNumber(notice.number),
      kindLabel: RIGHTS_KIND_SHORT[notice.kind],
      status: notice.status,
      statusLabel: RIGHTS_STATUS_LABELS[notice.status],
      claimantName: notice.claimantName,
      receivedAt: notice.receivedAt,
      urlCount: notice.urls.length,
      targetCount: notice.targets.length,
      manualTargetCount: notice.targets.filter((t) => !isAutoTarget(t.targetType)).length,
      owners: owners.filter((owner) => ownerIds.has(owner.userId)),
      restoreDueAt: notice.restoreDueAt,
      restoreDue:
        notice.status === "COUNTER_NOTICE_RECEIVED" &&
        notice.restoreDueAt !== null &&
        notice.restoreDueAt <= now,
    };
  };
  return { open: open.map(row), closed: closed.map(row) };
}

export type AdminNoticeDetail = {
  id: string;
  number: number;
  caseNumber: string;
  kind: RightsNoticeKind;
  kindLabel: string;
  status: RightsNoticeStatus;
  statusLabel: string;
  claimant: {
    name: string;
    email: string;
    altEmail: string | null;
    phone: string | null;
    domicile: string | null;
    role: RightsClaimantRole;
    roleLabel: string;
    principalName: string | null;
  };
  trademarkRegistration: string | null;
  workDescription: string;
  rightDescription: string;
  facts: string | null;
  swornStatement: boolean;
  penaltyAcknowledged: boolean;
  submittedWithAccount: boolean;
  /** Las direcciones tal como se escribieron y si alguna apuntó a contenido de speeaking. */
  urls: { raw: string; resolved: boolean }[];
  targets: {
    id: string;
    targetType: ReportTargetType;
    typeLabel: string;
    label: string;
    href: string | null;
    state: string;
    /** Foto de perfil, portada o comentario: el equipo lo retira a mano. */
    manual: boolean;
    ownerId: string | null;
  }[];
  owners: AdminOwner[];
  timeline: {
    receivedAt: Date;
    contentRemovedAt: Date | null;
    uploaderNotifiedAt: Date | null;
    counterNoticeAt: Date | null;
    restoreDueAt: Date | null;
    restoredAt: Date | null;
  };
  decidedBy: string | null;
  decisionNote: string | null;
  counterNotices: {
    id: string;
    name: string;
    email: string;
    domicile: string;
    basis: CounterNoticeBasis;
    basisLabel: string;
    explanation: string;
    createdAt: Date;
    forwardedAt: Date | null;
    /** La copia para quien avisó (se manda a mano si no hay correo configurado). */
    copy: EmailText;
  }[];
  decisions: readonly RightsDecision[];
  /** «Mantener retirado» vuelve a ocultar lo restaurado (quien avisó acreditó una acción legal). */
  keepDownHidesAgain: boolean;
  restoreNeedsNote: boolean;
  emailEnabled: boolean;
};

/** Expediente completo para el equipo. `null` si no existe. */
export async function getNoticeForAdmin(
  actorUserId: string,
  number: number,
  now: Date = new Date(),
): Promise<AdminNoticeDetail | null> {
  await assertAdmin(actorUserId);
  const notice = await q.findNoticeByNumber(number);
  if (!notice) return null;
  const [details, owners] = await Promise.all([
    q.findTargetDetails(notice.targets),
    ownersWithStrikes(
      notice.targets.flatMap((target) => (target.ownerId ? [target.ownerId] : [])),
      now,
    ),
  ]);
  const resolvedUrls = new Set(notice.targets.map((target) => target.url));
  return {
    id: notice.id,
    number: notice.number,
    caseNumber: formatCaseNumber(notice.number),
    kind: notice.kind,
    kindLabel: RIGHTS_KIND_SHORT[notice.kind],
    status: notice.status,
    statusLabel: RIGHTS_STATUS_LABELS[notice.status],
    claimant: {
      name: notice.claimantName,
      email: notice.claimantEmail,
      altEmail: notice.claimantAltEmail,
      phone: notice.claimantPhone,
      domicile: notice.claimantDomicile,
      role: notice.claimantRole,
      roleLabel: CLAIMANT_ROLE_LABELS[notice.claimantRole],
      principalName: notice.principalName,
    },
    trademarkRegistration: notice.trademarkRegistration,
    workDescription: notice.workDescription,
    rightDescription: notice.rightDescription,
    facts: notice.facts,
    swornStatement: notice.swornStatement,
    penaltyAcknowledged: notice.penaltyAcknowledged,
    submittedWithAccount: notice.submittedById !== null,
    urls: notice.urls.map((raw) => {
      const href = normalizeUrl(raw)?.href.slice(0, MAX_URL_LENGTH);
      return { raw, resolved: href !== undefined && resolvedUrls.has(href) };
    }),
    targets: notice.targets.map((target) => ({
      id: target.id,
      targetType: target.targetType,
      ...describeTarget(target, details),
      manual: !isAutoTarget(target.targetType),
      ownerId: target.ownerId,
    })),
    owners,
    timeline: {
      receivedAt: notice.receivedAt,
      contentRemovedAt: notice.contentRemovedAt,
      uploaderNotifiedAt: notice.uploaderNotifiedAt,
      counterNoticeAt: notice.counterNoticeAt,
      restoreDueAt: notice.restoreDueAt,
      restoredAt: notice.restoredAt,
    },
    decidedBy: notice.decidedBy?.profile?.username ?? null,
    decisionNote: notice.decisionNote,
    counterNotices: notice.counterNotices.map((counter) => ({
      id: counter.id,
      name: counter.name,
      email: counter.email,
      domicile: counter.domicile,
      basis: counter.basis,
      basisLabel: COUNTER_NOTICE_BASIS_LABELS[counter.basis],
      explanation: counter.explanation,
      createdAt: counter.createdAt,
      forwardedAt: counter.forwardedAt,
      copy: counterNoticeCopyEmail({
        number: notice.number,
        counter,
        restoreDueAt:
          notice.restoreDueAt ?? addBusinessDays(counter.createdAt, RESTORE_AFTER_BUSINESS_DAYS),
      }),
    })),
    decisions: allowedDecisions(notice),
    keepDownHidesAgain: keepDownHidesAgain(notice),
    restoreNeedsNote: restoreNeedsNote(notice, now),
    emailEnabled: rightsEmailEnabled(),
  };
}

export type RightsActionResult = { paths: string[]; message: string };

/**
 * Acción del equipo sobre un caso. Todas: `assertAdmin`, la etapa se vuelve a revisar con el caso
 * bloqueado, quién decidió y su nota quedan en el caso y en la bitácora (`moderation.rights.*`).
 * Ocultar y restaurar pasan por la moderación de `trust` (contenido a contenido, antes de cerrar el
 * caso: si algo falla a la mitad, repetir la acción termina el trabajo sin duplicar nada).
 */
export async function applyRightsAction(
  actorUserId: string,
  action: RightsAdminAction,
  now: Date = new Date(),
): Promise<RightsActionResult> {
  await assertAdmin(actorUserId);
  const notice = await q.findNoticeById(action.noticeId);
  if (!notice) throw new RightsError("NOT_FOUND");
  const caseLabel = formatCaseNumber(notice.number);

  if (action.action === "mark_forwarded") {
    await q.withNoticeLock(notice.id, async (tx) => {
      const changed = await q.markCounterNoticeForwarded(
        action.counterNoticeId,
        notice.id,
        now,
        tx,
      );
      if (changed.count === 0) throw new RightsError("NOT_ALLOWED");
      await q.logRightsDecision(tx, {
        action: "forwarded",
        title: `Copia del contra-aviso enviada a quien avisó: ${caseLabel}`,
        actorUserId,
        previousValue: { noticeId: notice.id, counterNoticeId: action.counterNoticeId },
        newValue: {
          noticeId: notice.id,
          counterNoticeId: action.counterNoticeId,
          forwardedAt: now.toISOString(),
        },
        reason: null,
        now,
      });
    });
    return { paths: [], message: "Listo: quedó registrado el envío de la copia." };
  }

  if (!canDecide(notice, action.action)) throw new RightsError("NOT_ALLOWED");
  const note = action.note ?? null;
  const auto = notice.targets.filter(
    (target): target is typeof target & { targetType: "POST" | "PRODUCT" } =>
      isAutoTarget(target.targetType),
  );
  const owners = ownersOf(notice.targets);

  const decision: RightsDecision = action.action;
  /** Cierra el caso con el caso bloqueado: revisa otra vez la etapa (alguien pudo adelantarse). */
  const close = <T>(work: (tx: q.Tx) => Promise<T>) =>
    q.withNoticeLock(notice.id, async (tx) => {
      const current = await q.findNoticeState(tx, notice.id);
      if (!current || !canDecide(current, decision)) throw new RightsError("NOT_ALLOWED");
      return work(tx);
    });
  const log = (
    tx: q.Tx,
    status: RightsNoticeStatus,
    extra: Record<string, string | number | boolean | null> = {},
  ) =>
    q.logRightsDecision(tx, {
      action: action.action,
      title: `${RIGHTS_STATUS_LABELS[status]}: ${caseLabel}`,
      actorUserId,
      previousValue: { noticeId: notice.id, status: notice.status },
      newValue: { noticeId: notice.id, status, ...extra },
      reason: note,
      now,
    });
  /** Aviso en la campana a cada persona que subió algo del caso (uno por persona y evento). */
  const notifyOwners = (
    tx: q.Tx,
    type: "CONTENT_REMOVED" | "CONTENT_RESTORED",
    event: RightsNotificationEvent,
    recipients: Map<string, ReportTargetType[]> = owners,
  ) =>
    q.upsertRightsNotifications(
      tx,
      [...recipients].map(([recipientId, types]) => ({
        recipientId,
        type,
        dedupeKey: rightsNotificationKey({
          caseNumber: notice.number,
          event,
          subject: rightsSubject(types),
          kind: notice.kind,
          recipientId,
        }),
      })),
      now,
    );
  /** Oculta lo que se oculta con un clic (por la moderación de `trust`, contenido a contenido). */
  const hideAuto = async () => {
    const paths: string[] = [];
    let hidden = 0;
    for (const target of auto) {
      const result = await moderateForRightsNotice(
        actorUserId,
        {
          targetType: target.targetType,
          targetId: target.targetId,
          hide: true,
          noticeId: notice.id,
          caseLabel,
          note,
        },
        now,
      );
      if (result.changed) hidden += 1;
      paths.push(...result.paths);
    }
    return { paths, hidden };
  };
  /** Sus fotos y videos no se pueden volver a subir desde ninguna cuenta (`stay-down.ts`). */
  const blockAutoMedia = async (tx: q.Tx) =>
    blockMediaHashes(tx, await q.findTargetMediaIds(tx, auto), "RIGHTS_NOTICE", notice.id);
  /** Hay foto de perfil, portada o comentario señalados y el equipo no confirmó que los retiró. */
  const manualPending = (manualDone: boolean) =>
    notice.targets.some((target) => !isAutoTarget(target.targetType)) && !manualDone;

  switch (action.action) {
    case "remove": {
      if (notice.targets.length === 0) throw new RightsError("NO_TARGETS");
      if (manualPending(action.manualDone)) throw new RightsError("MANUAL_PENDING");
      const { paths, hidden } = await hideAuto();
      const { blocked, notified } = await close(async (tx) => {
        const blocked = await blockAutoMedia(tx);
        const notified = await notifyOwners(tx, "CONTENT_REMOVED", "removed");
        await q.updateNotice(tx, notice.id, {
          status: "CONTENT_REMOVED",
          contentRemovedAt: now,
          uploaderNotifiedAt: notified > 0 ? now : null,
          decidedById: actorUserId,
          decisionNote: note,
        });
        await log(tx, "CONTENT_REMOVED", { hidden, blockedHashes: blocked, notified });
        return { blocked, notified };
      });
      await emailOwners(notice, owners, "removed");
      return {
        paths,
        message: `Listo: se retiró el contenido${notifiedSuffix(notified)}.${blockedSuffix(blocked)}`,
      };
    }

    case "restore":
    case "withdraw": {
      const wasRemoved = notice.status !== "RECEIVED";
      if (action.action === "restore" && restoreNeedsNote(notice, now) && !note) {
        throw new RightsError("NOTE_REQUIRED");
      }
      const paths: string[] = [];
      // Lo que otro aviso vigente también señala sigue retirado (y bloqueado) por ese aviso.
      const others = wasRemoved
        ? await q.findTargetsUnderOtherNotices(notice.id, notice.targets)
        : [];
      const keptByOther = new Set(others.map(targetKey));
      const untouched = new Set<string>();
      if (wasRemoved) {
        for (const target of auto) {
          if (keptByOther.has(targetKey(target))) continue;
          // Solo lo que sigue oculto por un aviso (no lo ocultado por otra decisión de moderación).
          if (!(await q.isHiddenByRightsNotice(target))) {
            untouched.add(targetKey(target));
            continue;
          }
          const result = await moderateForRightsNotice(
            actorUserId,
            {
              targetType: target.targetType,
              targetId: target.targetId,
              hide: false,
              noticeId: notice.id,
              caseLabel,
              note,
            },
            now,
          );
          paths.push(...result.paths);
        }
      }
      // Solo se avisa «volvimos a mostrar» de lo que de verdad vuelve a verse.
      const shownAgain = notice.targets.filter(
        (target) => !keptByOther.has(targetKey(target)) && !untouched.has(targetKey(target)),
      );
      const status = action.action === "restore" ? "RESTORED" : "WITHDRAWN";
      const notified = await close(async (tx) => {
        let notified = 0;
        if (wasRemoved) {
          await q.unblockNoticeHashes(tx, notice.id);
          for (const [otherId, targets] of groupByNotice(others.filter(isAutoRow))) {
            await blockMediaHashes(
              tx,
              await q.findTargetMediaIds(tx, targets),
              "RIGHTS_NOTICE",
              otherId,
            );
          }
          notified = await notifyOwners(tx, "CONTENT_RESTORED", "restored", ownersOf(shownAgain));
        }
        await q.updateNotice(tx, notice.id, {
          status,
          ...(wasRemoved ? { restoredAt: now } : {}),
          decidedById: actorUserId,
          decisionNote: note,
        });
        await log(tx, status, {
          restored: wasRemoved,
          keptHiddenByOtherDecision: untouched.size,
          keptByOtherNotice: keptByOther.size,
          notified,
        });
        return notified;
      });
      const restoredSomething = wasRemoved && shownAgain.length > 0;
      const base =
        action.action === "withdraw"
          ? restoredSomething
            ? "Listo: quien avisó lo retiró y se restauró el contenido."
            : "Listo: quien avisó lo retiró."
          : restoredSomething
            ? `Listo: se restauró el contenido${notifiedSuffix(notified)}.`
            : "Listo: el caso quedó como restaurado.";
      const otherCases = [...new Set(others.map((row) => formatCaseNumber(row.notice.number)))];
      const notes = [
        base,
        keptByOther.size > 0
          ? `${keptByOther.size === 1 ? "Una cosa sigue retirada" : `${keptByOther.size} cosas siguen retiradas`} por ${otherCases.length === 1 ? "otro aviso vigente" : "otros avisos vigentes"} (${otherCases.join(", ")}).`
          : null,
        untouched.size > 0
          ? `${untouched.size === 1 ? "Una cosa no se tocó" : `${untouched.size} cosas no se tocaron`}: su última decisión de moderación no fue de un aviso.`
          : null,
        wasRemoved && shownAgain.some((target) => !isAutoTarget(target.targetType))
          ? "Lo que retiraste a mano (foto de perfil, portada o comentario) se repone a mano."
          : null,
      ];
      return { paths, message: notes.filter(Boolean).join(" ") };
    }

    case "keep_down": {
      // Quien avisó acreditó una acción legal (RLFDA art. 37 Nonies). Si el contenido ya se había
      // restaurado tras el contra-aviso, se vuelve a retirar como en «Retirar contenido».
      const hideAgain = keepDownHidesAgain(notice);
      if (hideAgain && manualPending(action.manualDone)) throw new RightsError("MANUAL_PENDING");
      const { paths, hidden } = hideAgain ? await hideAuto() : { paths: [], hidden: 0 };
      const { blocked, notified } = await close(async (tx) => {
        const blocked = hideAgain ? await blockAutoMedia(tx) : 0;
        const notified = await notifyOwners(tx, "CONTENT_REMOVED", "kept");
        await q.updateNotice(tx, notice.id, {
          status: "KEPT_DOWN",
          decidedById: actorUserId,
          decisionNote: note,
        });
        await log(tx, "KEPT_DOWN", {
          hiddenAgain: hideAgain,
          hidden,
          blockedHashes: blocked,
          notified,
        });
        return { blocked, notified };
      });
      await emailOwners(notice, owners, "kept");
      return {
        paths,
        message: `${
          hideAgain
            ? "Listo: se volvió a retirar el contenido"
            : "Listo: el contenido se mantiene retirado"
        }${notifiedSuffix(notified)}.${blockedSuffix(blocked)}`,
      };
    }

    case "reject": {
      await close(async (tx) => {
        await q.updateNotice(tx, notice.id, {
          status: "REJECTED",
          decidedById: actorUserId,
          decisionNote: note,
        });
        await log(tx, "REJECTED");
      });
      return { paths: [], message: "Listo: el aviso quedó como «No procede»." };
    }
  }
}

function notifiedSuffix(notified: number) {
  return notified > 0 ? " y se avisó a quien lo subió" : "";
}

function blockedSuffix(blocked: number) {
  if (blocked === 0) return "";
  return ` ${blocked === 1 ? "Un archivo ya no se puede" : `${blocked} archivos ya no se pueden`} volver a subir.`;
}

/**
 * Correo a quien subió lo retirado (o lo que se mantiene retirado), además del aviso de la campana.
 * Solo con proveedor de correo; nunca falla la acción.
 */
async function emailOwners(
  notice: q.NoticeRecord,
  owners: Map<string, ReportTargetType[]>,
  event: Exclude<RightsNotificationEvent, "restored">,
) {
  if (!rightsEmailEnabled() || owners.size === 0) return;
  try {
    const caseUrl = absoluteUrl(caseUrlPath(notice.number));
    const users = await q.findUserEmails([...owners.keys()]);
    for (const user of users) {
      const subject = rightsSubject(owners.get(user.id) ?? []);
      await sendRightsEmail({
        to: [user.email],
        ...(event === "kept"
          ? contentKeptDownEmail({ number: notice.number, subject, caseUrl })
          : contentRemovedEmail({ number: notice.number, kind: notice.kind, subject, caseUrl })),
      });
    }
  } catch {
    console.error("[derechos] no se pudo avisar por correo a quien subió el contenido");
  }
}
