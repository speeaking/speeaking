import "server-only";
import { cache } from "react";
import { Prisma } from "@/generated/prisma/client";
import type {
  AuthenticityStatus,
  ProductCondition,
  ReportReason,
  ReportTargetType,
  RiskLevel,
} from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import {
  DEFAULT_REFERENCE_PRICES,
  type ReferencePrice,
  referencePricesSchema,
} from "./reference-prices";
import { URGENT_REPORT_REASONS } from "./labels";
import { isProofMedia } from "./proof-media";
import { median, type TrustSignal } from "./rules";
import {
  TRUST_AI_SIGNAL_KEY,
  TRUST_REFERENCE_PRICES_KEY,
  trustAiSignalSchema,
  type ReportableTarget,
} from "./schemas";

type Tx = Prisma.TransactionClient;

// ─────────────────────────────── Ajustes ───────────────────────────────

async function readSetting<T>(key: string, parse: (value: unknown) => T | null, fallback: T) {
  const row = await db.platformSetting.findUnique({ where: { key }, select: { value: true } });
  if (!row) return fallback;
  const parsed = parse(row.value);
  if (parsed === null) {
    console.error(`[trust] ajuste inválido "${key}"; se usa el valor por defecto`);
    return fallback;
  }
  return parsed;
}

/** ¿Está encendida la señal de IA? Apagada si el ajuste no existe o es inválido. */
export const readAiSignalEnabled = cache(() =>
  readSetting(
    TRUST_AI_SIGNAL_KEY,
    (value) => {
      const parsed = trustAiSignalSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
    false,
  ),
);

/** Precios de referencia: el ajuste `trust.referencePrices` si existe y es válido; si no, la lista. */
export const readReferencePrices = cache(() =>
  readSetting<readonly ReferencePrice[]>(
    TRUST_REFERENCE_PRICES_KEY,
    (value) => {
      const parsed = referencePricesSchema.safeParse(value);
      return parsed.success ? parsed.data : null;
    },
    DEFAULT_REFERENCE_PRICES,
  ),
);

// ───────────────────────── Evaluación (con candado) ─────────────────────────

/**
 * Corre `work` en una transacción con un candado por producto: dos reevaluaciones del mismo
 * producto (una edición y un reporte al mismo tiempo) van en fila y cada una lee lo último guardado.
 * Es un candado consultivo, no de la fila: el checkout no espera por él.
 */
export function withProductTrustLock<T>(productId: string, work: (tx: Tx) => Promise<T>) {
  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`trust:${productId}`}, 0))`;
    return work(tx);
  });
}

/** Transacción simple (acciones del equipo sobre publicaciones, con su bitácora). */
export function inTransaction<T>(work: (tx: Tx) => Promise<T>) {
  return db.$transaction(work);
}

export function loadProductForEvaluation(tx: Tx, productId: string) {
  return tx.product.findUnique({
    where: { id: productId },
    select: {
      id: true,
      title: true,
      description: true,
      tags: true,
      priceCents: true,
      currency: true,
      condition: true,
      authenticity: true,
      categoryId: true,
      sellerId: true,
      seller: { select: { createdAt: true, userId: true } },
    },
  });
}

export type ProductForEvaluation = NonNullable<
  Awaited<ReturnType<typeof loadProductForEvaluation>>
>;

/** Tope de productos parecidos que se leen para la mediana (los más recientes). */
const COMPARABLE_POOL = 200;
const NEW_CONDITIONS: ProductCondition[] = ["NEW", "LIKE_NEW"];
const USED_CONDITIONS: ProductCondition[] = ["USED_GOOD", "USED_FAIR", "REFURBISHED"];

/**
 * Precios de productos parecidos: misma categoría, la misma marca en el título o las etiquetas,
 * activos y visibles, de OTRAS tiendas, en la misma moneda y del mismo tipo de condición. Devuelve
 * UN precio por tienda (la mediana de los suyos): una cuenta con muchas publicaciones pesa lo mismo
 * que una con una sola, y nadie mueve la mediana publicando de más.
 */
export async function loadComparablePrices(
  tx: Tx,
  {
    productId,
    categoryId,
    sellerId,
    currency,
    condition,
    aliases,
  }: {
    productId: string;
    categoryId: string;
    sellerId: string;
    currency: string;
    condition: ProductCondition;
    aliases: readonly string[];
  },
): Promise<number[]> {
  if (aliases.length === 0) return [];
  const rows = await tx.product.findMany({
    where: {
      id: { not: productId },
      categoryId,
      sellerId: { not: sellerId },
      currency,
      status: "ACTIVE",
      moderationStatus: "VISIBLE",
      condition: { in: NEW_CONDITIONS.includes(condition) ? NEW_CONDITIONS : USED_CONDITIONS },
      OR: [
        ...aliases.map((alias) => ({ title: { contains: alias, mode: "insensitive" as const } })),
        { tags: { hasSome: aliases.filter((alias) => !alias.includes(" ")) } },
      ],
    },
    orderBy: { createdAt: "desc" },
    take: COMPARABLE_POOL,
    select: { priceCents: true, sellerId: true },
  });
  const bySeller = new Map<string, number[]>();
  for (const row of rows) {
    const prices = bySeller.get(row.sellerId);
    if (prices) prices.push(row.priceCents);
    else bySeller.set(row.sellerId, [row.priceCents]);
  }
  return [...bySeller.values()].flatMap((prices) => {
    const middle = median(prices);
    return middle === null ? [] : [middle];
  });
}

/** Ventas entregadas de una tienda. */
export function countCompletedSales(tx: Tx, sellerId: string) {
  return tx.order.count({ where: { sellerId, status: "DELIVERED" } });
}

/**
 * Personas distintas que reportaron posible falsificación del producto o de sus publicaciones
 * (sin contar los reportes descartados). Un reporte sin autor (cuenta borrada) cuenta como uno.
 */
export async function countCounterfeitReporters(tx: Tx, productId: string): Promise<number> {
  const posts = await tx.post.findMany({ where: { productId }, select: { id: true } });
  const reports = await tx.report.findMany({
    where: {
      reason: "COUNTERFEIT",
      status: { not: "DISMISSED" },
      OR: [
        { targetType: "PRODUCT", targetId: productId },
        ...(posts.length > 0
          ? [{ targetType: "POST" as const, targetId: { in: posts.map((post) => post.id) } }]
          : []),
      ],
    },
    select: { id: true, reporterId: true },
  });
  return new Set(reports.map((report) => report.reporterId ?? report.id)).size;
}

export function findCheck(tx: Tx, productId: string) {
  return tx.authenticityCheck.findUnique({
    where: { productId },
    select: {
      status: true,
      riskLevel: true,
      score: true,
      proofMediaIds: true,
      aiSignal: true,
    },
  });
}

/**
 * Revisiones hechas con otra versión de las reglas, por `productId` ascendente (paginación por llave:
 * `afterProductId` es el último de la tanda anterior). Para `scripts/trust-reevaluate.ts`.
 */
export function listOutdatedChecks(
  rulesVersion: string,
  afterProductId: string | null,
  take: number,
) {
  return db.authenticityCheck.findMany({
    where: {
      rulesVersion: { not: rulesVersion },
      ...(afterProductId ? { productId: { gt: afterProductId } } : {}),
    },
    orderBy: { productId: "asc" },
    take,
    select: { productId: true, rulesVersion: true, status: true, riskLevel: true },
  });
}

/** Productos que nunca se evaluaron (sin revisión; p. ej. la evaluación falló al guardarlos). */
export function countProductsWithoutCheck() {
  return db.product.count({ where: { authenticityCheck: { is: null } } });
}

/**
 * Productos sin revisión, por `id` ascendente (paginación por llave, como `listOutdatedChecks`). Para
 * `pnpm trust:reevaluate --include-unchecked`.
 */
export async function listProductsWithoutCheck(afterProductId: string | null, take: number) {
  const rows = await db.product.findMany({
    where: {
      authenticityCheck: { is: null },
      ...(afterProductId ? { id: { gt: afterProductId } } : {}),
    },
    orderBy: { id: "asc" },
    take,
    select: { id: true },
  });
  return rows.map((row) => row.id);
}

export type CheckWrite = {
  riskLevel: RiskLevel;
  score: number;
  signals: TrustSignal[];
  rulesVersion: string;
  status: AuthenticityStatus;
  aiSignal: Prisma.InputJsonValue | null;
};

export function upsertCheck(tx: Tx, productId: string, data: CheckWrite) {
  const values = {
    riskLevel: data.riskLevel,
    score: data.score,
    signals: data.signals as unknown as Prisma.InputJsonValue,
    rulesVersion: data.rulesVersion,
    status: data.status,
    aiSignal: data.aiSignal ?? Prisma.DbNull,
  };
  return tx.authenticityCheck.upsert({
    where: { productId },
    create: { productId, ...values },
    update: values,
    select: { status: true, riskLevel: true, score: true },
  });
}

/** Guarda la señal de la IA (la reevaluación la combina después con las reglas). */
export function saveAiSignal(tx: Tx, productId: string, aiSignal: Prisma.InputJsonValue) {
  return tx.authenticityCheck.updateMany({ where: { productId }, data: { aiSignal } });
}

// ─────────────────────────────── IA ───────────────────────────────

export async function recordAiSuccess(
  requestId: string,
  {
    output,
    inputTokens,
    outputTokens,
    costMicrosUsd,
    latencyMs,
  }: {
    output: Prisma.InputJsonValue;
    inputTokens: number;
    outputTokens: number;
    costMicrosUsd: number;
    latencyMs: number;
  },
) {
  await db.$transaction([
    db.aIResponse.create({
      data: { requestId, output, inputTokens, outputTokens, costMicrosUsd },
      select: { id: true },
    }),
    db.aIRequest.update({
      where: { id: requestId },
      data: { status: "SUCCEEDED", latencyMs },
    }),
  ]);
}

export async function recordAiFailure(
  requestId: string,
  errorCode: "INVALID_OUTPUT" | "PROVIDER_ERROR",
  latencyMs: number,
) {
  await db.aIRequest.update({
    where: { id: requestId },
    data: { status: "FAILED", errorCode, latencyMs },
  });
}

/** Texto del producto y su revisión vigente (para decidir si vale la pena llamar a la IA). */
export function loadProductText(productId: string) {
  return db.product.findUnique({
    where: { id: productId },
    select: {
      title: true,
      description: true,
      tags: true,
      authenticityCheck: { select: { riskLevel: true, signals: true, aiSignal: true } },
    },
  });
}

// ─────────────────────────────── Reportes ───────────────────────────────

export type ReportTarget = {
  ownerUserId: string;
  visible: boolean;
  /** Producto al que se refiere (el mismo, o el de la publicación). */
  productId: string | null;
};

/** Dueño y visibilidad del objetivo de un reporte; `null` si no existe. */
export async function findReportTarget(
  targetType: ReportableTarget,
  targetId: string,
): Promise<ReportTarget | null> {
  if (targetType === "USER") {
    // Una cuenta con perfil terminado (ADR-047): quien reporta es otra persona (se valida arriba).
    const profile = await db.profile.findUnique({
      where: { userId: targetId },
      select: { onboardedAt: true },
    });
    if (!profile) return null;
    return { ownerUserId: targetId, visible: profile.onboardedAt !== null, productId: null };
  }
  if (targetType === "PRODUCT") {
    const product = await db.product.findUnique({
      where: { id: targetId },
      select: { status: true, moderationStatus: true, seller: { select: { userId: true } } },
    });
    if (!product) return null;
    return {
      ownerUserId: product.seller.userId,
      visible:
        product.moderationStatus === "VISIBLE" &&
        product.status !== "DRAFT" &&
        product.status !== "ARCHIVED",
      productId: targetId,
    };
  }
  if (targetType === "COMMENT") {
    // Visible si el comentario y su publicación lo están. No se refiere a un producto: reportar un
    // comentario como «posible falsificación» no pesa en la revisión del producto de la publicación.
    const comment = await db.comment.findUnique({
      where: { id: targetId },
      select: {
        authorId: true,
        status: true,
        post: { select: { status: true, product: { select: { moderationStatus: true } } } },
      },
    });
    if (!comment) return null;
    return {
      ownerUserId: comment.authorId,
      visible:
        comment.status === "PUBLISHED" &&
        comment.post.status === "PUBLISHED" &&
        comment.post.product?.moderationStatus !== "HIDDEN",
      productId: null,
    };
  }
  const post = await db.post.findUnique({
    where: { id: targetId },
    select: {
      authorId: true,
      status: true,
      productId: true,
      product: { select: { moderationStatus: true } },
    },
  });
  if (!post) return null;
  return {
    ownerUserId: post.authorId,
    visible: post.status === "PUBLISHED" && post.product?.moderationStatus !== "HIDDEN",
    productId: post.productId,
  };
}

/** Crea el reporte; `false` si esa persona ya había reportado lo mismo (único en la base). */
export async function insertReport(data: {
  reporterId: string;
  targetType: ReportTargetType;
  targetId: string;
  reason: ReportReason;
  details: string | undefined;
}): Promise<boolean> {
  try {
    await db.report.create({ data, select: { id: true } });
    return true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return false;
    }
    throw error;
  }
}

// ─────────────────────────── Prueba del vendedor ───────────────────────────

/** Producto propio (la propiedad se comprueba en la consulta). */
export function findOwnedProduct(sellerUserId: string, productId: string) {
  return db.product.findFirst({
    where: { id: productId, seller: { userId: sellerUserId } },
    select: { id: true, slug: true, authenticity: true },
  });
}

/**
 * Fotos de comprobante válidas: listas, de quien las sube y SIN adjuntar a ninguna publicación ni
 * producto (así siguen privadas: `/media` solo se las sirve a su dueño).
 */
export async function countPrivateReadyMedia(ownerId: string, mediaIds: readonly string[]) {
  return db.media.count({
    where: {
      id: { in: [...mediaIds] },
      ownerId,
      status: "READY",
      postLinks: { none: {} },
      productLinks: { none: {} },
    },
  });
}

/**
 * Lo mismo que `countPrivateReadyMedia`, dentro de la transacción que guarda el comprobante y con las
 * fotos bloqueadas (FOR UPDATE) hasta que termine, en dos sentencias:
 *
 * 1. Bloquear las fotos propias y listas. El recolector de huérfanas (`media/orphans.ts`, FOR UPDATE
 *    SKIP LOCKED) las salta mientras se guardan, y si ya las estaba borrando, aquí faltan y el
 *    comprobante se rechaza en lugar de quedar sin fotos. FOR UPDATE (y no FOR SHARE) choca con el
 *    FOR KEY SHARE de quien las adjunta (llave foránea y trigger `reject_proof_media_link`): si una
 *    publicación o un producto las está adjuntando, se espera a que confirme.
 * 2. Con el candado ya tomado, comprobar en otra sentencia (otra foto de la base) que sigan sin
 *    adjuntar: ve el adjunto que se confirmó mientras se esperaba. En una sola sentencia, esa condición
 *    se evaluaba con la foto del inicio y la foto quedaba adjunta y como comprobante a la vez.
 *
 * Devuelve cuántas de `mediaIds` son propias, listas y privadas (sin adjuntar).
 */
export async function lockPrivateReadyMedia(
  tx: Tx,
  ownerId: string,
  mediaIds: readonly string[],
): Promise<number> {
  if (mediaIds.length === 0) return 0;
  const ids = [...mediaIds];
  const locked = await tx.$queryRaw<{ id: string }[]>`
    SELECT m."id" FROM "media" m
    WHERE m."id" = ANY(${ids}::uuid[])
      AND m."ownerId" = ${ownerId}::uuid
      AND m."status" = 'READY'
    ORDER BY m."id"
    FOR UPDATE OF m`;
  if (locked.length === 0) return 0;
  const attached = await tx.$queryRaw<{ id: string }[]>`
    SELECT pm."mediaId" AS "id" FROM "post_media" pm WHERE pm."mediaId" = ANY(${ids}::uuid[])
    UNION
    SELECT pr."mediaId" AS "id" FROM "product_media" pr WHERE pr."mediaId" = ANY(${ids}::uuid[])`;
  const linked = new Set(attached.map((row) => row.id));
  return locked.filter((row) => !linked.has(row.id)).length;
}

/**
 * Guarda el comprobante (solo si se pidió o para reemplazar el enviado) y su bitácora: las filas del
 * envío anterior quedan con `replacedAt` (sus fotos siguen protegidas: privadas, sin adjuntar y fuera
 * del recolector, `proof-media.ts`) y cada foto del envío nuevo tiene su fila. `count` 0 = no se pidió.
 */
export async function saveProof(tx: Tx, productId: string, mediaIds: readonly string[], now: Date) {
  const saved = await tx.authenticityCheck.updateMany({
    where: { productId, status: { in: ["NEEDS_PROOF", "PROOF_SUBMITTED"] } },
    data: { proofMediaIds: [...mediaIds], status: "PROOF_SUBMITTED" },
  });
  if (saved.count === 0) return saved;
  await tx.authenticityProofHistory.updateMany({
    where: { productId, replacedAt: null },
    data: { replacedAt: now },
  });
  await tx.authenticityProofHistory.createMany({
    data: mediaIds.map((mediaId) => ({ productId, mediaId, submittedAt: now })),
  });
  return saved;
}

/** El vendedor cambia su declaración a «genérico o compatible». `false` si no es suyo. */
export async function markOwnedProductGeneric(sellerUserId: string, productId: string) {
  const updated = await db.product.updateMany({
    where: { id: productId, seller: { userId: sellerUserId } },
    data: { authenticity: "GENERIC" },
  });
  return updated.count > 0;
}

type MediaRow = { id: string; storageKey: string; width: number; height: number };

function mediaUrls(rows: readonly MediaRow[], order: readonly string[]) {
  const storage = getStorage();
  const byId = new Map(rows.map((row) => [row.id, row]));
  return order.flatMap((id) => {
    const row = byId.get(id);
    return row
      ? [
          {
            id: row.id,
            url: storage.publicUrl(row.storageKey),
            width: row.width,
            height: row.height,
          },
        ]
      : [];
  });
}

/** Caso de autenticidad de un producto propio, para el Studio (solo su dueño). */
export async function findSellerCase(sellerUserId: string, productId: string) {
  const row = await db.product.findFirst({
    where: { id: productId, seller: { userId: sellerUserId } },
    select: {
      id: true,
      slug: true,
      title: true,
      authenticity: true,
      moderationStatus: true,
      authenticityCheck: {
        select: {
          status: true,
          riskLevel: true,
          signals: true,
          proofMediaIds: true,
          reviewNote: true,
          reviewedAt: true,
        },
      },
    },
  });
  if (!row) return null;
  const check = row.authenticityCheck;
  const proofRows = check?.proofMediaIds.length
    ? await db.media.findMany({
        // Solo las fotos que siguen siendo suyas (se muestran con `/media`, que exige al dueño).
        where: { id: { in: check.proofMediaIds }, ownerId: sellerUserId, status: "READY" },
        select: { id: true, storageKey: true, width: true, height: true },
      })
    : [];
  return {
    product: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      authenticity: row.authenticity,
      hidden: row.moderationStatus === "HIDDEN",
    },
    check: check
      ? {
          status: check.status,
          riskLevel: check.riskLevel,
          signals: check.signals,
          proofs: mediaUrls(proofRows, check.proofMediaIds),
          reviewNote: check.reviewNote,
          reviewedAt: check.reviewedAt,
        }
      : null,
  };
}

// ─────────────────────────────── Equipo ───────────────────────────────

const QUEUE_LIMIT = 100;

const OPEN_REPORT_SELECT = {
  id: true,
  targetType: true,
  targetId: true,
  reason: true,
  details: true,
  createdAt: true,
  reporter: { select: { profile: { select: { username: true } } } },
} as const satisfies Prisma.ReportSelect;

/**
 * Reportes abiertos, lo más antiguo primero. Los urgentes (ADR-076) se leen aparte para que el
 * límite nunca los deje fuera aunque haya cientos de reportes anteriores de otros motivos.
 */
export async function listOpenReports() {
  const urgent = [...URGENT_REPORT_REASONS];
  const [urgentReports, otherReports] = await Promise.all([
    db.report.findMany({
      where: { status: "OPEN", reason: { in: urgent } },
      orderBy: { createdAt: "asc" },
      take: 300,
      select: OPEN_REPORT_SELECT,
    }),
    db.report.findMany({
      where: { status: "OPEN", reason: { notIn: urgent } },
      orderBy: { createdAt: "asc" },
      take: 300,
      select: OPEN_REPORT_SELECT,
    }),
  ]);
  return [...urgentReports, ...otherReports];
}

export function listReviewChecks() {
  return db.authenticityCheck.findMany({
    // Un borrador o archivado no se vende: no ocupa la cola (si vuelve a la venta, reaparece).
    where: {
      status: { in: ["NEEDS_PROOF", "PROOF_SUBMITTED"] },
      product: { status: { notIn: ["DRAFT", "ARCHIVED"] } },
    },
    orderBy: { updatedAt: "asc" },
    take: QUEUE_LIMIT,
    select: {
      id: true,
      status: true,
      riskLevel: true,
      score: true,
      signals: true,
      aiSignal: true,
      proofMediaIds: true,
      reviewNote: true,
      updatedAt: true,
      product: {
        select: {
          id: true,
          slug: true,
          title: true,
          priceCents: true,
          currency: true,
          authenticity: true,
          moderationStatus: true,
          seller: {
            select: {
              displayName: true,
              createdAt: true,
              user: { select: { profile: { select: { username: true } } } },
            },
          },
        },
      },
    },
  });
}

export function findMediaByIds(ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return db.media.findMany({
    where: { id: { in: [...ids] }, status: "READY" },
    select: { id: true, storageKey: true, width: true, height: true },
  });
}

export function findProductsForQueue(ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return db.product.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      currency: true,
      moderationStatus: true,
      seller: { select: { displayName: true } },
    },
  });
}

/** Cuentas reportadas (ADR-047): nombre y usuario para la cola. */
export function findProfilesForQueue(userIds: readonly string[]) {
  if (userIds.length === 0) return Promise.resolve([]);
  return db.profile.findMany({
    where: { userId: { in: [...userIds] } },
    select: { userId: true, username: true, displayName: true },
  });
}

export function findPostsForQueue(ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return db.post.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true,
      body: true,
      status: true,
      author: { select: { profile: { select: { username: true, displayName: true } } } },
    },
  });
}

/** Comentarios reportados: texto, autor y su publicación (el enlace de la cola). */
export function findCommentsForQueue(ids: readonly string[]) {
  if (ids.length === 0) return Promise.resolve([]);
  return db.comment.findMany({
    where: { id: { in: [...ids] } },
    select: {
      id: true,
      body: true,
      status: true,
      postId: true,
      author: { select: { profile: { select: { username: true } } } },
    },
  });
}

/** Lo oculto por el equipo: productos, publicaciones y comentarios (en ese orden). */
export function listHiddenContent() {
  return Promise.all([
    db.product.findMany({
      where: { moderationStatus: "HIDDEN" },
      orderBy: { moderatedAt: { sort: "desc", nulls: "last" } },
      take: QUEUE_LIMIT,
      select: {
        id: true,
        slug: true,
        title: true,
        moderatedAt: true,
        seller: { select: { displayName: true } },
      },
    }),
    db.post.findMany({
      where: { status: "HIDDEN" },
      orderBy: { updatedAt: "desc" },
      take: QUEUE_LIMIT,
      select: {
        id: true,
        body: true,
        updatedAt: true,
        author: { select: { profile: { select: { username: true } } } },
      },
    }),
    db.comment.findMany({
      where: { status: "HIDDEN" },
      orderBy: { updatedAt: "desc" },
      take: QUEUE_LIMIT,
      select: {
        id: true,
        body: true,
        postId: true,
        updatedAt: true,
        author: { select: { profile: { select: { username: true } } } },
      },
    }),
  ]);
}

/**
 * ¿Es `mediaId` una foto de comprobante de algún producto, vigente o de un envío anterior (el equipo
 * también revisa los reemplazados)? Devuelve su archivo.
 */
export async function findProofMedia(mediaId: string) {
  if (!(await isProofMedia(db, mediaId))) return null;
  return db.media.findUnique({
    where: { id: mediaId },
    select: { storageKey: true, status: true },
  });
}

// Escrituras del equipo (siempre dentro de una transacción con la bitácora).

export function resolveOpenReports(
  tx: Tx,
  target: { targetType: ReportableTarget; targetId: string },
  status: "ACTIONED" | "DISMISSED",
  resolvedById: string,
  now: Date,
) {
  return tx.report.updateMany({
    where: { targetType: target.targetType, targetId: target.targetId, status: "OPEN" },
    data: { status, resolvedById, resolvedAt: now },
  });
}

export function setProductModeration(
  tx: Tx,
  productId: string,
  moderationStatus: "VISIBLE" | "HIDDEN",
  now: Date,
) {
  return tx.product.updateMany({
    where: { id: productId, moderationStatus: { not: moderationStatus } },
    data: { moderationStatus, moderatedAt: now },
  });
}

/** Oculta o restaura una publicación. Nunca toca las retiradas (REMOVED). */
export function setPostModeration(tx: Tx, postId: string, hidden: boolean) {
  return tx.post.updateMany({
    where: { id: postId, status: hidden ? "PUBLISHED" : "HIDDEN" },
    data: { status: hidden ? "HIDDEN" : "PUBLISHED" },
  });
}

/**
 * Oculta o restaura un comentario y ajusta el contador de su publicación (cuenta solo los
 * publicados, como al borrarlo su autor). Nunca toca los retirados (REMOVED).
 */
export async function setCommentModeration(tx: Tx, commentId: string, hidden: boolean) {
  const comment = await tx.comment.findUnique({
    where: { id: commentId },
    select: { postId: true },
  });
  if (!comment) return { count: 0 };
  const result = await tx.comment.updateMany({
    where: { id: commentId, status: hidden ? "PUBLISHED" : "HIDDEN" },
    data: { status: hidden ? "HIDDEN" : "PUBLISHED" },
  });
  if (result.count > 0) {
    await tx.post.updateMany({
      where: hidden ? { id: comment.postId, commentCount: { gt: 0 } } : { id: comment.postId },
      data: { commentCount: hidden ? { decrement: 1 } : { increment: 1 } },
    });
  }
  return result;
}

export function findCheckForReview(tx: Tx, productId: string) {
  return tx.authenticityCheck.findUnique({
    where: { productId },
    select: {
      status: true,
      proofMediaIds: true,
      signals: true,
      product: { select: { authenticity: true, title: true } },
    },
  });
}

export function markCheckReviewed(
  tx: Tx,
  productId: string,
  data: {
    status: "VERIFIED_BY_ADMIN" | "REJECTED";
    reviewedById: string;
    reviewNote: string | null;
    now: Date;
  },
) {
  return tx.authenticityCheck.update({
    where: { productId },
    data: {
      status: data.status,
      reviewedById: data.reviewedById,
      reviewedAt: data.now,
      reviewNote: data.reviewNote,
    },
  });
}

export function forceGeneric(tx: Tx, productId: string) {
  return tx.product.update({ where: { id: productId }, data: { authenticity: "GENERIC" } });
}

/**
 * Bitácora de moderación: cada acción del equipo queda como `PlatformDecision` aplicada por una
 * persona (quién, qué, antes y después, motivo). `kind` empieza con `moderation.` o
 * `authenticity.` para separarla de las decisiones del motor de automejora.
 */
export function logModeration(
  tx: Tx,
  entry: {
    kind: string;
    title: string;
    riskLevel: RiskLevel;
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
      kind: entry.kind,
      title: entry.title,
      hypothesis: "Acción de moderación del equipo (no es una propuesta del motor de automejora).",
      riskLevel: entry.riskLevel,
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

/** Datos de un producto u objetivo antes de una acción (para la bitácora y para revalidar). */
export function findProductState(tx: Tx, productId: string) {
  return tx.product.findUnique({
    where: { id: productId },
    select: { slug: true, title: true, moderationStatus: true, authenticity: true },
  });
}

export function findPostState(tx: Tx, postId: string) {
  return tx.post.findUnique({
    where: { id: postId },
    select: { id: true, status: true, productId: true },
  });
}

export function findCommentState(tx: Tx, commentId: string) {
  return tx.comment.findUnique({
    where: { id: commentId },
    select: { id: true, status: true, postId: true },
  });
}
