import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import type {
  Authenticity,
  AuthenticityStatus,
  ReportReason,
  RiskLevel,
} from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/format";
import { assertAdmin } from "@/modules/admin/service";
import { getStorage } from "@/server/providers/storage";
import {
  aiSignalWeight,
  listingFingerprint,
  parseStoredAiSignal,
  type StoredAiSignal,
} from "./ai-signal";
import { runAuthenticityTask } from "./ai-runner";
import { brandById } from "./brands";
import {
  ADMIN_AUTHENTICITY_LABELS,
  ADMIN_NOT_DECLARED_LABEL,
  isUrgentReportReason,
  REPORT_REASON_LABELS,
  RISK_LABELS,
} from "./labels";
import * as q from "./queries";
import {
  analyzeListing,
  combineWithAi,
  evaluateRules,
  parseSignals,
  primaryBrandId,
  RULES_VERSION,
} from "./rules";
import type { ModerationAction, ReportableTarget, ReportInput } from "./schemas";
import { nextCheckStatus } from "./status";

/**
 * Confianza y moderación (P14): revisión de RIESGO de falsificación, reportes de compradores,
 * pruebas del vendedor y acciones del equipo. Sin dependencias de Next: la autorización vive aquí
 * (propiedad en cada consulta, `assertAdmin` en todo lo del equipo).
 */
export class TrustError extends Error {
  override name = "TrustError";
  constructor(
    readonly code:
      | "NOT_FOUND"
      | "OWN_CONTENT"
      | "NOT_REQUESTED"
      | "INVALID_MEDIA"
      | "NOT_ALLOWED"
      | "IMITATION_TERMS",
  ) {
    super(code);
  }
}

const DAY_MS = 24 * 60 * 60 * 1000;

// ─────────────────────────── Revisión automática ───────────────────────────

export type CheckOutcome = { status: AuthenticityStatus; level: RiskLevel; score: number };

export type EvaluationOptions = {
  /**
   * La edición cambió qué se vende (título, etiquetas, categoría o condición): un «Comprobante
   * revisado» no se hereda al artículo nuevo (`nextCheckStatus`).
   */
  listingChanged?: boolean;
};

/**
 * Evalúa (o reevalúa) un producto con las reglas y guarda su revisión vigente. Lo llaman el alta y
 * la edición del catálogo, un reporte de posible falsificación, el cambio a «genérico» y la señal
 * de la IA. Serializado por producto (`withProductTrustLock`). `null` si el producto no existe.
 */
export async function refreshAuthenticityCheck(
  productId: string,
  now: Date = new Date(),
  {
    listingChanged = false,
    dryRun = false,
  }: EvaluationOptions & {
    /** Calcula el resultado sin guardarlo (la simulación de `pnpm trust:reevaluate --dry-run`). */
    dryRun?: boolean;
  } = {},
): Promise<CheckOutcome | null> {
  const referencePrices = await q.readReferencePrices();
  return q.withProductTrustLock(productId, async (tx) => {
    const product = await q.loadProductForEvaluation(tx, productId);
    if (!product) return null;
    const input = {
      title: product.title,
      description: product.description,
      tags: product.tags,
      priceCents: product.priceCents,
      currency: product.currency,
      condition: product.condition,
      authenticity: product.authenticity,
    };
    const analysis = analyzeListing(input);
    const brandId = primaryBrandId(analysis);
    const comparablePricesCents = await q.loadComparablePrices(tx, {
      productId,
      categoryId: product.categoryId,
      sellerId: product.sellerId,
      currency: product.currency,
      condition: product.condition,
      aliases: brandId ? (brandById(brandId)?.aliases ?? []) : [],
    });
    const completedSales = await q.countCompletedSales(tx, product.sellerId);
    const counterfeitReports = await q.countCounterfeitReporters(tx, productId);
    const current = await q.findCheck(tx, productId);

    const rules = evaluateRules(
      input,
      {
        comparablePricesCents,
        seller: { createdAt: product.seller.createdAt, completedSales },
        counterfeitReports,
        referencePrices,
        now,
      },
      analysis,
    );
    // La señal de la IA solo vale para el texto que evaluó.
    const stored = parseStoredAiSignal(current?.aiSignal);
    const ai = stored && stored.fingerprint === listingFingerprint(input) ? stored : null;
    const combined = combineWithAi(rules, ai?.weight ?? 0);
    const next = nextCheckStatus({
      current: current
        ? { status: current.status, score: current.score, proofCount: current.proofMediaIds.length }
        : null,
      level: combined.level,
      score: combined.score,
      authenticity: product.authenticity,
      listingChanged,
    });
    if (next.frozen && current) {
      return { status: current.status, level: current.riskLevel, score: current.score };
    }
    if (dryRun) return { status: next.status, level: combined.level, score: combined.score };
    const saved = await q.upsertCheck(tx, productId, {
      riskLevel: combined.level,
      score: combined.score,
      signals: rules.signals,
      rulesVersion: RULES_VERSION,
      status: next.status,
      aiSignal: ai ? (ai as unknown as Prisma.InputJsonValue) : null,
    });
    return { status: saved.status, level: saved.riskLevel, score: saved.score };
  });
}

/**
 * Igual que `refreshAuthenticityCheck`, pero nunca lanza: guardar un producto no falla porque la
 * revisión falle (queda sin revisión y se muestra lo que declaró el vendedor, como antes).
 */
export async function evaluateProductAuthenticity(
  productId: string,
  now?: Date,
  options?: EvaluationOptions,
) {
  try {
    return await refreshAuthenticityCheck(productId, now, options);
  } catch (error) {
    console.error("[trust] no se pudo evaluar la autenticidad del producto", error);
    return null;
  }
}

/**
 * Señal OPCIONAL de la IA (ajuste `trust.aiSignal.enabled`, apagado por omisión). Solo se pide si
 * las reglas ya vieron algo y el riesgo no es alto (ahí no cambiaría nada), y una vez por versión del
 * texto. Después reevalúa con su peso. Nunca lanza.
 */
export async function refreshAiSignal(productId: string, now: Date = new Date()) {
  try {
    if (!(await q.readAiSignalEnabled())) return null;
    const product = await q.loadProductText(productId);
    const check = product?.authenticityCheck;
    if (!product || !check) return null;
    if (check.riskLevel === "HIGH" || parseSignals(check.signals).length === 0) return null;
    const text = { title: product.title, description: product.description, tags: product.tags };
    const fingerprint = listingFingerprint(text);
    if (parseStoredAiSignal(check.aiSignal)?.fingerprint === fingerprint) return null;

    const run = await runAuthenticityTask({ productId, fingerprint, text });
    if (!run) return null;
    const signal: StoredAiSignal = {
      provider: run.provider,
      model: run.model,
      promptVersion: run.promptVersion,
      fingerprint,
      mentionsImitation: run.output.mentionsImitation,
      confidence: run.output.confidence,
      reason: run.output.reason.trim().slice(0, 200),
      weight: aiSignalWeight(run.output),
      requestId: run.requestId,
      at: now.toISOString(),
    };
    await q.withProductTrustLock(productId, (tx) =>
      q.saveAiSignal(tx, productId, signal as unknown as Prisma.InputJsonValue),
    );
    return await refreshAuthenticityCheck(productId, now);
  } catch (error) {
    console.error("[trust] no se pudo obtener la señal de IA", error);
    return null;
  }
}

// ─────────────────────────────── Reportes ───────────────────────────────

/**
 * Reporte de quien compra o navega. Uno por persona y objetivo (si repite, no se duplica). Anónimo
 * para el vendedor: nada de lo que ve el vendedor muestra quién reportó ni cuántos. Un reporte de
 * posible falsificación reevalúa el producto (es una señal más, que sola nunca llega a riesgo alto).
 */
export async function createReport(
  reporterUserId: string,
  input: ReportInput,
): Promise<{ alreadyReported: boolean }> {
  const target = await q.findReportTarget(input.targetType, input.targetId);
  if (!target || !target.visible) throw new TrustError("NOT_FOUND");
  if (target.ownerUserId === reporterUserId) throw new TrustError("OWN_CONTENT");
  const created = await q.insertReport({
    reporterId: reporterUserId,
    targetType: input.targetType,
    targetId: input.targetId,
    reason: input.reason,
    details: input.details,
  });
  if (created && input.reason === "COUNTERFEIT" && target.productId) {
    await evaluateProductAuthenticity(target.productId);
  }
  return { alreadyReported: !created };
}

// ─────────────────────────── Prueba del vendedor ───────────────────────────

/**
 * El vendedor sube su comprobante (ticket, factura, empaque, número de serie). Las fotos deben ser
 * suyas, estar listas y NO estar en ninguna publicación ni producto: así siguen privadas (solo él y
 * el equipo las ven) y desde ese momento ya no se pueden adjuntar a nada (`proof-media.ts`). Solo se
 * acepta si se le pidió (NEEDS_PROOF) o para reemplazar lo enviado, y solo si el producto se declara
 * original: un comprobante de un genérico no demuestra nada y el equipo no podría marcarlo como
 * revisado (se queda en la cola para siempre). Reemplazarlo no libera las fotos anteriores: quedan en
 * la bitácora (`AuthenticityProofHistory`) con la misma protección.
 */
export async function submitProof(
  sellerUserId: string,
  { productId, mediaIds }: { productId: string; mediaIds: readonly string[] },
  now: Date = new Date(),
) {
  const product = await q.findOwnedProduct(sellerUserId, productId);
  if (!product) throw new TrustError("NOT_FOUND");
  if (product.authenticity !== "DECLARED_ORIGINAL") throw new TrustError("NOT_REQUESTED");
  const valid = await q.countPrivateReadyMedia(sellerUserId, mediaIds);
  if (valid !== mediaIds.length) throw new TrustError("INVALID_MEDIA");
  const saved = await q.withProductTrustLock(productId, async (tx) => {
    // Otra vez dentro de la transacción y con las fotos bloqueadas: el recolector de huérfanas no
    // las borra mientras se guardan como comprobante (y si ya las borró, se rechaza), y una
    // publicación o un producto que las esté adjuntando termina antes (y aquí se rechaza) o después
    // (y el trigger lo rechaza a él).
    if ((await q.lockPrivateReadyMedia(tx, sellerUserId, mediaIds)) !== mediaIds.length) {
      throw new TrustError("INVALID_MEDIA");
    }
    return q.saveProof(tx, productId, mediaIds, now);
  });
  if (saved.count === 0) throw new TrustError("NOT_REQUESTED");
  return { slug: product.slug };
}

/** El vendedor cambia su declaración a «genérico o compatible» y se reevalúa. */
export async function declareGeneric(sellerUserId: string, productId: string) {
  const product = await q.findOwnedProduct(sellerUserId, productId);
  if (!product) throw new TrustError("NOT_FOUND");
  if (!(await q.markOwnedProductGeneric(sellerUserId, productId))) {
    throw new TrustError("NOT_FOUND");
  }
  await evaluateProductAuthenticity(productId);
  return { slug: product.slug };
}

/** Mensaje de reportes para el vendedor: sin cuántos (podría adivinar quién fue). */
const SELLER_REPORTS_MESSAGE = "Recibimos reportes de otras personas sobre esta publicación.";

export type SellerAuthenticityCase = {
  product: { id: string; slug: string; title: string; authenticity: Authenticity; hidden: boolean };
  check: {
    status: AuthenticityStatus;
    riskLevel: RiskLevel;
    reasons: string[];
    proofs: { id: string; url: string; width: number; height: number }[];
    reviewNote: string | null;
    reviewedAt: Date | null;
  } | null;
};

/** Caso de autenticidad de un producto propio (Studio). `null` si no existe o es de otra persona. */
export async function getSellerAuthenticityCase(
  sellerUserId: string,
  productId: string,
): Promise<SellerAuthenticityCase | null> {
  const found = await q.findSellerCase(sellerUserId, productId);
  if (!found) return null;
  const { check } = found;
  return {
    product: found.product,
    check: check
      ? {
          status: check.status,
          riskLevel: check.riskLevel,
          reasons: parseSignals(check.signals).map((signal) =>
            signal.rule === "buyer_reports" ? SELLER_REPORTS_MESSAGE : signal.message,
          ),
          proofs: check.proofs,
          reviewNote: check.reviewNote,
          reviewedAt: check.reviewedAt,
        }
      : null,
  };
}

// ─────────────────────────────── Equipo ───────────────────────────────

export type QueueTarget =
  | {
      kind: "PRODUCT";
      title: string;
      href: string;
      price: string;
      sellerName: string;
      hidden: boolean;
    }
  | { kind: "POST"; excerpt: string; href: string; author: string | null; hidden: boolean }
  | { kind: "USER"; displayName: string; username: string; href: string; hidden: false }
  /** `href` es la publicación donde está el comentario. */
  | { kind: "COMMENT"; excerpt: string; href: string; author: string | null; hidden: boolean };

export type QueueReportGroup = {
  targetType: ReportableTarget;
  targetId: string;
  target: QueueTarget | null;
  /** Algún reporte es de contenido íntimo sin consentimiento o de riesgo para menores (ADR-076). */
  urgent: boolean;
  reasons: { reason: ReportReason; label: string; count: number }[];
  reports: {
    id: string;
    reasonLabel: string;
    details: string | null;
    reporter: string | null;
    createdAt: Date;
  }[];
  oldestAt: Date;
};

export type QueueCheck = {
  productId: string;
  href: string;
  title: string;
  price: string;
  authenticity: Authenticity;
  sellerName: string;
  sellerUsername: string | null;
  sellerAgeDays: number;
  status: AuthenticityStatus;
  statusLabel: string;
  riskLevel: RiskLevel;
  riskLabel: string;
  score: number;
  signals: { rule: string; message: string }[];
  ai: { mentionsImitation: boolean; confidence: string; reason: string; model: string } | null;
  proofs: { id: string; url: string; width: number; height: number }[];
  reviewNote: string | null;
  hidden: boolean;
  updatedAt: Date;
};

export type ModerationQueue = {
  reports: QueueReportGroup[];
  checks: QueueCheck[];
  hidden: {
    products: { id: string; title: string; href: string; sellerName: string; at: Date | null }[];
    posts: { id: string; excerpt: string; href: string; author: string | null; at: Date }[];
    comments: { id: string; excerpt: string; href: string; author: string | null; at: Date }[];
  };
};

/** URL de una foto de comprobante: solo la sirve `/admin/moderacion/prueba/[id]` a ADMIN. */
export function proofImageUrl(mediaId: string) {
  return `/admin/moderacion/prueba/${mediaId}`;
}

function excerpt(text: string, max = 140) {
  const clean = text.replace(/\s+/g, " ").trim();
  return clean.length > max ? `${clean.slice(0, max - 1)}…` : clean;
}

/** Cola de moderación: reportes abiertos por objetivo, revisiones con prueba y lo oculto. */
export async function getModerationQueue(
  actorUserId: string,
  now: Date = new Date(),
): Promise<ModerationQueue> {
  await assertAdmin(actorUserId);
  const [openReports, checkRows, hidden] = await Promise.all([
    q.listOpenReports(),
    q.listReviewChecks(),
    q.listHiddenContent(),
  ]);
  const [hiddenProducts, hiddenPosts, hiddenComments] = hidden;

  // Reportes agrupados por objetivo. Primero los urgentes (contenido íntimo sin consentimiento o
  // riesgo para menores, ADR-076); dentro de cada grupo, lo más antiguo primero (24 h hábiles de
  // respuesta).
  const groups = new Map<string, QueueReportGroup>();
  for (const report of openReports) {
    const key = `${report.targetType}:${report.targetId}`;
    let group = groups.get(key);
    if (!group) {
      group = {
        targetType: report.targetType,
        targetId: report.targetId,
        target: null,
        urgent: false,
        reasons: [],
        reports: [],
        oldestAt: report.createdAt,
      };
      groups.set(key, group);
    }
    if (isUrgentReportReason(report.reason)) group.urgent = true;
    if (report.createdAt < group.oldestAt) group.oldestAt = report.createdAt;
    group.reports.push({
      id: report.id,
      reasonLabel: REPORT_REASON_LABELS[report.reason],
      details: report.details,
      reporter: report.reporter?.profile?.username ?? null,
      createdAt: report.createdAt,
    });
    const reason = group.reasons.find((item) => item.reason === report.reason);
    if (reason) reason.count += 1;
    else
      group.reasons.push({
        reason: report.reason,
        label: REPORT_REASON_LABELS[report.reason],
        count: 1,
      });
  }
  const reportGroups = [...groups.values()];
  const idsOf = (type: ReportableTarget) =>
    reportGroups.filter((g) => g.targetType === type).map((g) => g.targetId);
  const [products, posts, profiles, comments] = await Promise.all([
    q.findProductsForQueue(idsOf("PRODUCT")),
    q.findPostsForQueue(idsOf("POST")),
    q.findProfilesForQueue(idsOf("USER")),
    q.findCommentsForQueue(idsOf("COMMENT")),
  ]);
  const productById = new Map(products.map((product) => [product.id, product]));
  const postById = new Map(posts.map((post) => [post.id, post]));
  const profileByUserId = new Map(profiles.map((profile) => [profile.userId, profile]));
  const commentById = new Map(comments.map((comment) => [comment.id, comment]));
  for (const group of reportGroups) {
    group.reports.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    if (group.targetType === "COMMENT") {
      const comment = commentById.get(group.targetId);
      group.target = comment
        ? {
            kind: "COMMENT",
            excerpt: excerpt(comment.body),
            href: `/p/${comment.postId}`,
            author: comment.author.profile?.username ?? null,
            hidden: comment.status !== "PUBLISHED",
          }
        : null;
      continue;
    }
    if (group.targetType === "USER") {
      const profile = profileByUserId.get(group.targetId);
      group.target = profile
        ? {
            kind: "USER",
            displayName: profile.displayName,
            username: profile.username,
            href: `/u/${profile.username}`,
            hidden: false,
          }
        : null;
      continue;
    }
    if (group.targetType === "PRODUCT") {
      const product = productById.get(group.targetId);
      group.target = product
        ? {
            kind: "PRODUCT",
            title: product.title,
            href: `/producto/${product.slug}`,
            price: formatMoney(product.priceCents, product.currency),
            sellerName: product.seller.displayName,
            hidden: product.moderationStatus === "HIDDEN",
          }
        : null;
    } else {
      const post = postById.get(group.targetId);
      group.target = post
        ? {
            kind: "POST",
            excerpt: excerpt(post.body),
            href: `/p/${post.id}`,
            author: post.author.profile?.username ?? null,
            hidden: post.status !== "PUBLISHED",
          }
        : null;
    }
  }

  // Revisiones: primero las que ya tienen comprobante; dentro, la más antigua primero.
  const proofIds = checkRows.flatMap((row) =>
    row.status === "PROOF_SUBMITTED" ? row.proofMediaIds : [],
  );
  const proofMedia = new Map((await q.findMediaByIds(proofIds)).map((m) => [m.id, m]));
  const checks: QueueCheck[] = checkRows
    .map((row) => {
      const ai = parseStoredAiSignal(row.aiSignal);
      const seller = row.product.seller;
      return {
        productId: row.product.id,
        href: `/producto/${row.product.slug}`,
        title: row.product.title,
        price: formatMoney(row.product.priceCents, row.product.currency),
        authenticity: row.product.authenticity,
        sellerName: seller.displayName,
        sellerUsername: seller.user.profile?.username ?? null,
        sellerAgeDays: Math.max(
          0,
          Math.floor((now.getTime() - seller.createdAt.getTime()) / DAY_MS),
        ),
        status: row.status,
        statusLabel:
          row.status === "NEEDS_PROOF" && row.product.authenticity !== "DECLARED_ORIGINAL"
            ? ADMIN_NOT_DECLARED_LABEL
            : ADMIN_AUTHENTICITY_LABELS[row.status],
        riskLevel: row.riskLevel,
        riskLabel: RISK_LABELS[row.riskLevel],
        score: row.score,
        signals: parseSignals(row.signals).map(({ rule, message }) => ({ rule, message })),
        ai: ai
          ? {
              mentionsImitation: ai.mentionsImitation,
              confidence: ai.confidence,
              reason: ai.reason,
              model: ai.model,
            }
          : null,
        proofs:
          row.status === "PROOF_SUBMITTED"
            ? row.proofMediaIds.flatMap((id) => {
                const media = proofMedia.get(id);
                return media
                  ? [{ id, url: proofImageUrl(id), width: media.width, height: media.height }]
                  : [];
              })
            : [],
        reviewNote: row.reviewNote,
        hidden: row.product.moderationStatus === "HIDDEN",
        updatedAt: row.updatedAt,
      };
    })
    .sort((a, b) =>
      a.status === b.status
        ? a.updatedAt.getTime() - b.updatedAt.getTime()
        : a.status === "PROOF_SUBMITTED"
          ? -1
          : 1,
    );

  return {
    reports: reportGroups.sort((a, b) =>
      a.urgent === b.urgent ? a.oldestAt.getTime() - b.oldestAt.getTime() : a.urgent ? -1 : 1,
    ),
    checks,
    hidden: {
      products: hiddenProducts.map((product) => ({
        id: product.id,
        title: product.title,
        href: `/producto/${product.slug}`,
        sellerName: product.seller.displayName,
        at: product.moderatedAt,
      })),
      posts: hiddenPosts.map((post) => ({
        id: post.id,
        excerpt: excerpt(post.body),
        href: `/p/${post.id}`,
        author: post.author.profile?.username ?? null,
        at: post.updatedAt,
      })),
      comments: hiddenComments.map((comment) => ({
        id: comment.id,
        excerpt: excerpt(comment.body),
        href: `/p/${comment.postId}`,
        author: comment.author.profile?.username ?? null,
        at: comment.updatedAt,
      })),
    },
  };
}

/** Rutas públicas que cambian con una acción (para revalidarlas). */
export type ModerationResult = { paths: string[] };

const PUBLIC_LISTS = ["/", "/comprar", "/buscar", "/descubrir"];

const ACTION_TITLES = {
  hide: "Ocultado por moderación",
  restore: "Restaurado por moderación",
  dismiss: "Reportes descartados",
} as const;

/**
 * Acción del equipo. Todas: `assertAdmin`, transacción y una entrada en la bitácora (`logModeration`)
 * con quién, qué, antes, después y la nota.
 */
export async function applyModerationAction(
  actorUserId: string,
  action: ModerationAction,
  now: Date = new Date(),
): Promise<ModerationResult> {
  await assertAdmin(actorUserId);
  const reason = action.note ?? null;

  switch (action.action) {
    case "verify":
    case "reject": {
      const verify = action.action === "verify";
      const slug = await q.withProductTrustLock(action.productId, async (tx) => {
        const check = await q.findCheckForReview(tx, action.productId);
        const state = await q.findProductState(tx, action.productId);
        if (!check || !state) throw new TrustError("NOT_FOUND");
        if (verify) {
          // «Comprobante revisado» solo existe si de verdad hubo un comprobante que revisar: el
          // mismo que el equipo vio (el vendedor no lo reemplazó mientras tanto) y cuyas fotos
          // siguen existiendo.
          const seen = new Set(action.proofIds);
          const stored = check.proofMediaIds;
          const sameProof =
            stored.length > 0 && stored.length === seen.size && stored.every((id) => seen.has(id));
          if (
            check.status !== "PROOF_SUBMITTED" ||
            check.product.authenticity !== "DECLARED_ORIGINAL" ||
            !sameProof ||
            (await q.findMediaByIds(stored)).length !== stored.length
          ) {
            throw new TrustError("NOT_ALLOWED");
          }
          // Un «Comprobante revisado» junto a «réplica», «AAA»… se contradice: primero el vendedor
          // corrige la publicación (la reevaluación lo saca o lo deja en la cola).
          if (parseSignals(check.signals).some((signal) => signal.rule === "counterfeit_terms")) {
            throw new TrustError("IMITATION_TERMS");
          }
        }
        if (!verify) await q.forceGeneric(tx, action.productId);
        await q.markCheckReviewed(tx, action.productId, {
          status: verify ? "VERIFIED_BY_ADMIN" : "REJECTED",
          reviewedById: actorUserId,
          reviewNote: reason,
          now,
        });
        await q.logModeration(tx, {
          kind: verify ? "authenticity.verify" : "authenticity.reject",
          title: verify
            ? `Comprobante revisado: ${state.title}`
            : state.authenticity === "DECLARED_ORIGINAL"
              ? `Declaración de original rechazada: ${state.title}`
              : `Revisión cerrada como genérico: ${state.title}`,
          riskLevel: "MEDIUM",
          actorUserId,
          previousValue: {
            productId: action.productId,
            status: check.status,
            authenticity: state.authenticity,
          },
          newValue: {
            productId: action.productId,
            status: verify ? "VERIFIED_BY_ADMIN" : "REJECTED",
            authenticity: verify ? state.authenticity : "GENERIC",
          },
          reason,
          now,
        });
        return state.slug;
      });
      return { paths: [`/producto/${slug}`, "/studio/productos"] };
    }

    case "hide":
    case "restore":
    case "dismiss": {
      const target = { targetType: action.targetType, targetId: action.targetId };
      if (action.targetType === "USER") {
        // Una cuenta solo se descarta desde aquí (ADR-047); ocultarla no existe en esta versión.
        if (action.action !== "dismiss") throw new TrustError("NOT_ALLOWED");
        await q.inTransaction(async (tx) => {
          const changed = (await q.resolveOpenReports(tx, target, "DISMISSED", actorUserId, now))
            .count;
          if (changed === 0) throw new TrustError("NOT_ALLOWED");
          await q.logModeration(tx, {
            kind: "moderation.dismiss_user",
            title: `${ACTION_TITLES.dismiss}: cuenta ${action.targetId.slice(0, 8)}`,
            riskLevel: "LOW",
            actorUserId,
            previousValue: target,
            newValue: { ...target, reports: "DISMISSED" },
            reason,
            now,
          });
        });
        return { paths: ["/admin/moderacion"] };
      }
      if (action.targetType === "PRODUCT") {
        const slug = await q.withProductTrustLock(action.targetId, async (tx) => {
          const state = await q.findProductState(tx, action.targetId);
          if (!state) throw new TrustError("NOT_FOUND");
          let changed = 0;
          if (action.action === "dismiss") {
            changed = (await q.resolveOpenReports(tx, target, "DISMISSED", actorUserId, now)).count;
          } else {
            const hide = action.action === "hide";
            changed = (
              await q.setProductModeration(tx, action.targetId, hide ? "HIDDEN" : "VISIBLE", now)
            ).count;
            if (hide) await q.resolveOpenReports(tx, target, "ACTIONED", actorUserId, now);
          }
          if (changed === 0) throw new TrustError("NOT_ALLOWED");
          await q.logModeration(tx, {
            kind: `moderation.${action.action}_product`,
            title: `${ACTION_TITLES[action.action]}: ${state.title}`,
            riskLevel: action.action === "dismiss" ? "LOW" : "MEDIUM",
            actorUserId,
            previousValue: { ...target, moderationStatus: state.moderationStatus },
            newValue: {
              ...target,
              moderationStatus:
                action.action === "dismiss"
                  ? state.moderationStatus
                  : action.action === "hide"
                    ? "HIDDEN"
                    : "VISIBLE",
              reports: action.action === "dismiss" ? "DISMISSED" : undefined,
            },
            reason,
            now,
          });
          return state.slug;
        });
        // Descartar reportes de posible falsificación baja su peso en la revisión.
        if (action.action === "dismiss") await evaluateProductAuthenticity(action.targetId, now);
        return { paths: [`/producto/${slug}`, "/studio/productos", ...PUBLIC_LISTS] };
      }
      if (action.targetType === "COMMENT") {
        // Oculto, deja de verse en la publicación, en las notificaciones y en el contador; su autor
        // lo sigue viendo en «Mi contenido». No se refiere a un producto: no reevalúa nada.
        const postId = await q.inTransaction(async (tx) => {
          const state = await q.findCommentState(tx, action.targetId);
          if (!state) throw new TrustError("NOT_FOUND");
          let changed = 0;
          if (action.action === "dismiss") {
            changed = (await q.resolveOpenReports(tx, target, "DISMISSED", actorUserId, now)).count;
          } else {
            const hide = action.action === "hide";
            changed = (await q.setCommentModeration(tx, action.targetId, hide)).count;
            if (hide) await q.resolveOpenReports(tx, target, "ACTIONED", actorUserId, now);
          }
          if (changed === 0) throw new TrustError("NOT_ALLOWED");
          await q.logModeration(tx, {
            kind: `moderation.${action.action}_comment`,
            title: `${ACTION_TITLES[action.action]}: comentario ${action.targetId.slice(0, 8)}`,
            riskLevel: action.action === "dismiss" ? "LOW" : "MEDIUM",
            actorUserId,
            previousValue: { ...target, postId: state.postId, status: state.status },
            newValue: {
              ...target,
              postId: state.postId,
              status:
                action.action === "dismiss"
                  ? state.status
                  : action.action === "hide"
                    ? "HIDDEN"
                    : "PUBLISHED",
              reports: action.action === "dismiss" ? "DISMISSED" : undefined,
            },
            reason,
            now,
          });
          return state.postId;
        });
        return { paths: [`/p/${postId}`] };
      }

      const productId = await q.inTransaction(async (tx) => {
        const state = await q.findPostState(tx, action.targetId);
        if (!state) throw new TrustError("NOT_FOUND");
        let changed = 0;
        if (action.action === "dismiss") {
          changed = (await q.resolveOpenReports(tx, target, "DISMISSED", actorUserId, now)).count;
        } else {
          const hide = action.action === "hide";
          changed = (await q.setPostModeration(tx, action.targetId, hide)).count;
          if (hide) await q.resolveOpenReports(tx, target, "ACTIONED", actorUserId, now);
        }
        if (changed === 0) throw new TrustError("NOT_ALLOWED");
        await q.logModeration(tx, {
          kind: `moderation.${action.action}_post`,
          title: `${ACTION_TITLES[action.action]}: publicación ${action.targetId.slice(0, 8)}`,
          riskLevel: action.action === "dismiss" ? "LOW" : "MEDIUM",
          actorUserId,
          previousValue: { ...target, status: state.status },
          newValue: {
            ...target,
            status:
              action.action === "dismiss"
                ? state.status
                : action.action === "hide"
                  ? "HIDDEN"
                  : "PUBLISHED",
            reports: action.action === "dismiss" ? "DISMISSED" : undefined,
          },
          reason,
          now,
        });
        return state.productId;
      });
      if (action.action === "dismiss" && productId) {
        await evaluateProductAuthenticity(productId, now);
      }
      return { paths: [`/p/${action.targetId}`, ...PUBLIC_LISTS] };
    }
  }
}

// ─────────────────────── Avisos de derechos (ADR-076) ───────────────────────

export type RightsModerationInput = {
  targetType: "POST" | "PRODUCT";
  targetId: string;
  hide: boolean;
  noticeId: string;
  /** «DA-000123», para el título de la bitácora. */
  caseLabel: string;
  note: string | null;
};

/**
 * Oculta o restaura una publicación o un producto por un aviso de derechos (módulo `rights`). Mismo
 * camino que «Ocultar» y «Restaurar» de la cola: mismas escrituras, mismo candado por producto,
 * reportes abiertos atendidos al ocultar y una entrada en la bitácora
 * (`moderation.rights_<hide|restore>_<post|product>`, con el aviso en `newValue.noticeId`). Dos
 * diferencias: lo que ya estaba así no es error (otro aviso o un reporte pudo ocultarlo antes;
 * `changed: false`, sin entrada) y lo que ya no existe tampoco (el caso sigue su curso).
 * `applyModerationAction` no cambia.
 */
export async function moderateForRightsNotice(
  actorUserId: string,
  input: RightsModerationInput,
  now: Date = new Date(),
): Promise<{ changed: boolean; paths: string[] }> {
  await assertAdmin(actorUserId);
  const target = { targetType: input.targetType, targetId: input.targetId };
  const verb = input.hide ? "hide" : "restore";
  const title = `${input.hide ? "Retirado" : "Restaurado"} por el aviso ${input.caseLabel}`;

  if (input.targetType === "PRODUCT") {
    const slug = await q.withProductTrustLock(input.targetId, async (tx) => {
      const state = await q.findProductState(tx, input.targetId);
      if (!state) return null;
      const status = input.hide ? "HIDDEN" : "VISIBLE";
      if ((await q.setProductModeration(tx, input.targetId, status, now)).count === 0) return null;
      if (input.hide) await q.resolveOpenReports(tx, target, "ACTIONED", actorUserId, now);
      await q.logModeration(tx, {
        kind: `moderation.rights_${verb}_product`,
        title: `${title}: ${state.title}`,
        riskLevel: "MEDIUM",
        actorUserId,
        previousValue: { ...target, moderationStatus: state.moderationStatus },
        newValue: { ...target, moderationStatus: status, noticeId: input.noticeId },
        reason: input.note,
        now,
      });
      return state.slug;
    });
    return slug
      ? { changed: true, paths: [`/producto/${slug}`, "/studio/productos", ...PUBLIC_LISTS] }
      : { changed: false, paths: [] };
  }

  const changed = await q.inTransaction(async (tx) => {
    const state = await q.findPostState(tx, input.targetId);
    if (!state) return false;
    if ((await q.setPostModeration(tx, input.targetId, input.hide)).count === 0) return false;
    if (input.hide) await q.resolveOpenReports(tx, target, "ACTIONED", actorUserId, now);
    await q.logModeration(tx, {
      kind: `moderation.rights_${verb}_post`,
      title: `${title}: publicación ${input.targetId.slice(0, 8)}`,
      riskLevel: "MEDIUM",
      actorUserId,
      previousValue: { ...target, status: state.status },
      newValue: {
        ...target,
        status: input.hide ? "HIDDEN" : "PUBLISHED",
        noticeId: input.noticeId,
      },
      reason: input.note,
      now,
    });
    return true;
  });
  return changed
    ? { changed, paths: [`/p/${input.targetId}`, ...PUBLIC_LISTS] }
    : { changed, paths: [] };
}

/** Archivo de una foto de comprobante, solo para ADMIN. `null` si no es una prueba o no existe. */
export async function getProofFileForAdmin(actorUserId: string, mediaId: string) {
  await assertAdmin(actorUserId);
  const media = await q.findProofMedia(mediaId);
  if (!media || media.status !== "READY") return null;
  return getStorage().get(media.storageKey);
}
