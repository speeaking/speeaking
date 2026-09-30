import "server-only";
import { createHash, randomUUID } from "node:crypto";
import type { AIFunding } from "@/generated/prisma/enums";
import { Prisma } from "@/generated/prisma/client";
import { track } from "@/modules/analytics/track";
import { recordedImageCost } from "@/modules/ai/cost";
import { AIError } from "@/modules/ai/errors";
import { isFeatureOn, requireFeature } from "@/modules/ai/features-store";
import { reserveAiRequest } from "@/modules/ai/reservation";
import { providerFailure, withTimeout } from "@/modules/ai/service";
import { simulatedRecord } from "@/modules/ai/tasks/availability";
import { getTryOnPricing } from "@/modules/billing/service";
import { STORE_TRIAL_TRY_ONS } from "@/modules/billing/pricing";
import { chargedTodayCents, creditWallet, debitWallet } from "@/modules/billing/wallet";
import { processImage } from "@/modules/media/image-processing";
import { deleteStoredMedia } from "@/modules/media/variant-keys";
import {
  type CandidateRow,
  listLookCandidates,
  listSellableProductsByIds,
} from "@/modules/stylist/queries";
import { classifySlot, type OutfitSlot } from "@/modules/stylist/slots";
import { isProofMedia } from "@/modules/trust/proof-media";
import type { Database } from "@/server/db-client";
import { db } from "@/server/db";
import { getImageProvider, imageAvailability } from "@/server/providers/image";
import { IMAGE_CALL_TIMEOUT_MS } from "@/server/providers/image/openai-compatible-image";
import { getStorage } from "@/server/providers/storage";
import type { StorageProvider } from "@/server/providers/storage/types";
import { type ComplementDTO, suggestComplements } from "./complements";
import { TRY_ON_CONSENT_VERSION, TRY_ON_RETENTION_DAYS } from "./consent";
import {
  type FundingContext,
  type FundingOption,
  type FundingStatus,
  fundingOptions,
  fundingStatus,
} from "./funding";
import { MAX_TRY_ON_GARMENTS, MAX_TRY_ON_PHOTOS } from "./limits";
import { type TryOnGarment, tryOnTask } from "./task";

/** Cuotas propias de Pruébatelo (además de las generales de IA y del saldo). */
export const TRY_ON_LIMITS = { key: "tryon", perHour: 10, perDay: 30 } as const;

export { MAX_TRY_ON_PHOTOS } from "./limits";

const DAY_MS = 24 * 60 * 60 * 1000;

export type TryOnErrorCode =
  | "PHOTO_NOT_FOUND"
  | "PHOTO_INVALID"
  | "TOO_MANY_PHOTOS"
  | "PRODUCT_NOT_FOUND"
  | "NOT_A_GARMENT"
  | "TOO_MANY_GARMENTS"
  | "NEEDS_BALANCE"
  | "STORE_NOT_FUNDED"
  | "IN_PROGRESS";

export class TryOnError extends Error {
  override name = "TryOnError";
  constructor(
    readonly code: TryOnErrorCode,
    readonly detail: { priceCents?: number; balanceCents?: number } = {},
  ) {
    super(code);
  }
}

export type TryOnPhotoDTO = { id: string; url: string; createdAt: string; expiresAt: string };

export type TryOnResultDTO = {
  id: string;
  status: "PENDING" | "READY" | "FAILED";
  image: { url: string; width: number; height: number; blurDataUrl: string | null } | null;
  createdAt: string;
  expiresAt: string;
  funding: AIFunding;
  chargedCents: number;
  /** La generó el simulador (piloto o desarrollo): se muestra como ejemplo. */
  simulated: boolean;
  cached: boolean;
  products: { id: string; slug: string; title: string; priceCents: number; currency: string }[];
};

function expiresAt(now: Date) {
  return new Date(now.getTime() + TRY_ON_RETENTION_DAYS * DAY_MS);
}

function newStorageKey(now: Date) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `images/${now.getUTCFullYear()}/${month}/${randomUUID()}.webp`;
}

// ───────────────────────────── Fotos de la persona ─────────────────────────────

/**
 * Registra una foto ya subida (por `/api/uploads`, que la validó y le quitó metadatos) como foto de
 * Pruébatelo: privada, con consentimiento versionado y borrado a los 30 días. Solo fotos propias,
 * listas y sin adjuntar a nada.
 */
export async function registerTryOnPhoto(userId: string, mediaId: string, now = new Date()) {
  await requireFeature("virtualTryOn");
  const media = await db.media.findFirst({
    where: { id: mediaId, ownerId: userId, status: "READY", kind: "IMAGE" },
    select: {
      id: true,
      _count: { select: { postLinks: true, productLinks: true } },
      tryOnPhoto: { select: { id: true } },
    },
  });
  if (!media) throw new TryOnError("PHOTO_NOT_FOUND");
  if (media.tryOnPhoto) return { photoId: media.tryOnPhoto.id };
  if (
    media._count.postLinks > 0 ||
    media._count.productLinks > 0 ||
    (await isProofMedia(db, mediaId))
  ) {
    throw new TryOnError("PHOTO_INVALID");
  }
  const live = await db.tryOnPhoto.count({ where: { userId, expiresAt: { gt: now } } });
  if (live >= MAX_TRY_ON_PHOTOS) throw new TryOnError("TOO_MANY_PHOTOS");

  const latestConsent = await db.userConsent.findFirst({
    where: { userId, type: "TRY_ON_PHOTOS" },
    orderBy: { createdAt: "desc" },
    select: { version: true, granted: true },
  });
  const photo = await db.$transaction(async (tx) => {
    if (!latestConsent?.granted || latestConsent.version !== TRY_ON_CONSENT_VERSION) {
      await tx.userConsent.create({
        data: { userId, type: "TRY_ON_PHOTOS", version: TRY_ON_CONSENT_VERSION, granted: true },
      });
    }
    return tx.tryOnPhoto.create({
      data: { userId, mediaId, consentVersion: TRY_ON_CONSENT_VERSION, expiresAt: expiresAt(now) },
      select: { id: true },
    });
  });
  return { photoId: photo.id };
}

/** Fotos vigentes de la persona, la más reciente primero. */
export async function listTryOnPhotos(userId: string, now = new Date()): Promise<TryOnPhotoDTO[]> {
  const rows = await db.tryOnPhoto.findMany({
    where: { userId, expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdAt: true, expiresAt: true, media: { select: { storageKey: true } } },
  });
  const storage = getStorage();
  return rows.map((row) => ({
    id: row.id,
    url: storage.publicUrl(row.media.storageKey),
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
  }));
}

/** Borra una foto y todas sus simulaciones (filas y archivos). Solo su dueña o dueño. */
export async function deleteTryOnPhoto(userId: string, photoId: string) {
  const photo = await db.tryOnPhoto.findFirst({
    where: { id: photoId, userId },
    select: {
      mediaId: true,
      media: { select: { storageKey: true } },
      results: { select: { resultMedia: { select: { id: true, storageKey: true } } } },
    },
  });
  if (!photo) return false;
  const resultMedia = photo.results.flatMap((result) =>
    result.resultMedia ? [result.resultMedia] : [],
  );
  await db.$transaction([
    db.tryOnPhoto.delete({ where: { id: photoId } }),
    db.media.deleteMany({
      where: { id: { in: [photo.mediaId, ...resultMedia.map((m) => m.id)] } },
    }),
  ]);
  const storage = getStorage();
  for (const key of [photo.media.storageKey, ...resultMedia.map((m) => m.storageKey)]) {
    await deleteStoredMedia(storage, key).catch((error: unknown) => {
      console.error("[tryon] no se pudo borrar un archivo", error);
    });
  }
  return true;
}

// ───────────────────────────── Simulaciones ─────────────────────────────

function cacheKeyFor(photoId: string, products: CandidateRow[], model: string) {
  const parts = products.map((product) => `${product.id}:${product.image?.url ?? ""}`).sort();
  return createHash("sha256")
    .update([photoId, ...parts, tryOnTask.promptVersion, model].join("|"))
    .digest("hex");
}

async function readImage(storage: StorageProvider, url: string) {
  const key = url.replace(/^\/media\//, "");
  const file = await storage.get(key);
  if (!file) throw new TryOnError("PRODUCT_NOT_FOUND");
  return { data: file.data, mimeType: file.contentType };
}

async function toDTO(
  row: {
    id: string;
    status: "PENDING" | "READY" | "FAILED";
    createdAt: Date;
    expiresAt: Date;
    funding: AIFunding;
    chargedCents: number;
    productIds: string[];
    sellerId: string | null;
    resultMedia: {
      storageKey: string;
      width: number;
      height: number;
      blurDataUrl: string | null;
    } | null;
    aiRequest: { provider: string } | null;
  },
  cached: boolean,
): Promise<TryOnResultDTO> {
  const products = await listSellableProductsByIds(row.productIds);
  return {
    id: row.id,
    status: row.status,
    image: row.resultMedia
      ? {
          url: getStorage().publicUrl(row.resultMedia.storageKey),
          width: row.resultMedia.width,
          height: row.resultMedia.height,
          blurDataUrl: row.resultMedia.blurDataUrl,
        }
      : null,
    createdAt: row.createdAt.toISOString(),
    expiresAt: row.expiresAt.toISOString(),
    funding: row.funding,
    chargedCents: row.chargedCents,
    simulated: row.aiRequest ? simulatedRecord(row.aiRequest.provider) : false,
    cached,
    products: products.map((product) => ({
      id: product.id,
      slug: product.slug,
      title: product.title,
      priceCents: product.priceCents,
      currency: product.currency,
    })),
  };
}

const resultSelect = {
  id: true,
  status: true,
  createdAt: true,
  expiresAt: true,
  funding: true,
  chargedCents: true,
  productIds: true,
  sellerId: true,
  resultMedia: { select: { storageKey: true, width: true, height: true, blurDataUrl: true } },
  aiRequest: { select: { provider: true } },
} as const;

/** Pruebas de cortesía ya usadas por una tienda (las paga Estreno; no vencen por mes). */
async function storeTrialUsed(sellerId: string) {
  return db.tryOnResult.count({
    where: { sellerId, funding: "PLATFORM", status: { in: ["PENDING", "READY"] } },
  });
}

/** Contexto de financiamiento de la tienda de un producto (ADR-046). */
async function fundingContextFor(sellerId: string, now: Date): Promise<FundingContext> {
  const [seller, pricing, trialUsed] = await Promise.all([
    db.sellerProfile.findUnique({
      where: { id: sellerId },
      select: {
        id: true,
        userId: true,
        sponsorsTryOn: true,
        tryOnDailyCapCents: true,
        user: { select: { wallet: { select: { balanceCents: true } } } },
      },
    }),
    getTryOnPricing(),
    storeTrialUsed(sellerId),
  ]);
  return {
    priceCents: pricing.priceCents,
    sponsor: seller
      ? {
          sellerId: seller.id,
          userId: seller.userId,
          enabled: seller.sponsorsTryOn,
          dailyCapCents: seller.tryOnDailyCapCents,
          spentTodayCents: await chargedTodayCents(db, seller.userId, "SPONSORED_TRY_ON", now),
          balanceCents: seller.user.wallet?.balanceCents ?? 0,
        }
      : null,
    trialUsed,
    trialLimit: STORE_TRIAL_TRY_ONS,
  };
}

export type TryOnAvailability = {
  /** Función encendida y proveedor disponible. */
  available: boolean;
  /** Quién pagaría la siguiente prueba sobre productos de esta tienda. */
  status: FundingStatus;
  /** El proveedor es el simulador: el resultado será un ejemplo. */
  simulated: boolean;
  priceCents: number;
  trialLeft: number;
};

/** Lo que la persona puede saber antes de generar sobre un producto: si hay prueba y quién la paga. */
export async function tryOnAvailabilityFor(
  sellerId: string,
  now = new Date(),
): Promise<TryOnAvailability> {
  const availability = imageAvailability();
  const available = (await isFeatureOn("virtualTryOn")) && availability !== "unavailable";
  const context = await fundingContextFor(sellerId, now);
  return {
    available,
    status: fundingStatus(context),
    simulated: availability !== "real",
    priceCents: context.priceCents,
    trialLeft: Math.max(0, context.trialLimit - context.trialUsed),
  };
}

/**
 * Alguien quiso probarse un producto cuya tienda no tiene pruebas activas: se registra como demanda
 * (solo un número agregado para quien vende; nunca quién).
 */
export function recordTryOnDemand(userId: string, productId: string) {
  track({
    type: "TRY_ON_REQUESTED",
    userId,
    surface: "PRODUCT_PAGE",
    entityType: "PRODUCT",
    entityId: productId,
  });
}

/** «Agrégale…»: complementos reales para la prenda de un diálogo (ADR-046). */
export async function listComplementsFor(product: {
  id: string;
  slot: OutfitSlot;
  sellerId: string;
}): Promise<ComplementDTO[]> {
  const candidates = await listLookCandidates({ excludeUserId: null, limit: 200 });
  return suggestComplements(product, candidates);
}

export type SellerTryOnStats = {
  /** Pruebas generadas sobre productos de la tienda en los últimos 7 y 30 días. */
  last7Days: number;
  last30Days: number;
  /** Veces que alguien quiso probarse algo y no pudo (sin pruebas activas), últimos 7 días. */
  requestedLast7Days: number;
  trialLeft: number;
  trialLimit: number;
};

/** Lo que ve quien vende en su Studio: cuánto se prueban sus productos y cuánta demanda dejó pasar. */
export async function sellerTryOnStats(
  sellerId: string,
  now = new Date(),
): Promise<SellerTryOnStats> {
  const since = (days: number) => new Date(now.getTime() - days * DAY_MS);
  const productIds = (await db.product.findMany({ where: { sellerId }, select: { id: true } })).map(
    (product) => product.id,
  );
  const [last7Days, last30Days, requestedLast7Days, trialUsed] = await Promise.all([
    db.tryOnResult.count({ where: { sellerId, status: "READY", createdAt: { gte: since(7) } } }),
    db.tryOnResult.count({ where: { sellerId, status: "READY", createdAt: { gte: since(30) } } }),
    productIds.length === 0
      ? Promise.resolve(0)
      : db.analyticsEvent.count({
          where: {
            type: "TRY_ON_REQUESTED",
            entityType: "PRODUCT",
            entityId: { in: productIds },
            createdAt: { gte: since(7) },
          },
        }),
    storeTrialUsed(sellerId),
  ]);
  return {
    last7Days,
    last30Days,
    requestedLast7Days,
    trialLeft: Math.max(0, STORE_TRIAL_TRY_ONS - trialUsed),
    trialLimit: STORE_TRIAL_TRY_ONS,
  };
}

/** Pruebas generadas por producto de una tienda en los últimos 30 días (para su lista del Studio). */
export async function countTryOnsByProduct(
  sellerId: string,
  now = new Date(),
): Promise<Map<string, number>> {
  const rows = await db.tryOnResult.findMany({
    where: { sellerId, status: "READY", createdAt: { gte: new Date(now.getTime() - 30 * DAY_MS) } },
    select: { productIds: true },
  });
  const counts = new Map<string, number>();
  for (const row of rows) {
    const main = row.productIds[0];
    if (main) counts.set(main, (counts.get(main) ?? 0) + 1);
  }
  return counts;
}

/**
 * Genera (o reutiliza) una simulación: la foto de la persona con hasta 4 productos. Orden: función
 * encendida y proveedor disponible → productos vendibles y de moda → caché → quién paga
 * (patrocinio, gratis, saldo) → reserva atómica (cuota, presupuesto o cobro del saldo en la misma
 * transacción) → proveedor → resultado privado con fecha de borrado. Si el proveedor falla, la
 * solicitud queda FAILED y el cobro se devuelve.
 */
export async function generateTryOn({
  userId,
  photoId,
  productIds,
  now = new Date(),
}: {
  userId: string;
  photoId: string;
  productIds: string[];
  now?: Date;
}): Promise<TryOnResultDTO> {
  await requireFeature("virtualTryOn");
  if (imageAvailability() === "unavailable") throw new AIError("UNAVAILABLE");
  if (productIds.length === 0 || productIds.length > MAX_TRY_ON_GARMENTS) {
    throw new TryOnError("TOO_MANY_GARMENTS");
  }
  const photo = await db.tryOnPhoto.findFirst({
    where: { id: photoId, userId, expiresAt: { gt: now } },
    select: { id: true, media: { select: { storageKey: true, mimeType: true } } },
  });
  if (!photo) throw new TryOnError("PHOTO_NOT_FOUND");
  const products = await listSellableProductsByIds([...new Set(productIds)]);
  if (products.length !== new Set(productIds).size) throw new TryOnError("PRODUCT_NOT_FOUND");
  const garments = products.map((product) => {
    const slot = classifySlot({
      categorySlug: product.categorySlug,
      parentSlug: product.parentSlug,
      title: product.title,
      tags: product.tags,
    });
    if (!slot || !product.image) throw new TryOnError("NOT_A_GARMENT");
    return { product, slot };
  });

  const provider = getImageProvider();
  const cacheKey = cacheKeyFor(photo.id, products, provider.model);
  const existing = await db.tryOnResult.findUnique({ where: { cacheKey }, select: resultSelect });
  if (existing && existing.status === "READY" && existing.expiresAt > now) {
    track({ type: "TRY_ON_GENERATED", userId, surface: "STYLIST", metadata: { cached: true } });
    return toDTO(existing, true);
  }
  if (existing && existing.status === "PENDING") throw new TryOnError("IN_PROGRESS");
  // Un intento fallido o un resultado vencido guarda la misma `cacheKey` (única): sin borrarlo, el
  // `create` del reintento fallaría y la gente vería «ya se está generando» para siempre.
  if (existing) await discardResult(existing.id);

  // Quién paga, en orden (ADR-046): la tienda del producto principal o su cortesía; nunca quien compra.
  const main = garments[0]!.product;
  const [context, budget] = await Promise.all([
    fundingContextFor(main.sellerId, now),
    import("@/modules/platform/settings").then((m) => m.getAiBudget()),
  ]);
  const options = fundingOptions(context);
  if (options.length === 0) {
    recordTryOnDemand(userId, main.id);
    throw new TryOnError("STORE_NOT_FUNDED", { priceCents: context.priceCents });
  }

  const target = { id: provider.id, model: provider.model, promptVersion: tryOnTask.promptVersion };
  const reserved = await reserveWithFunding({
    userId,
    options,
    target,
    photoId: photo.id,
    productIds: products.map((product) => product.id),
    sellerId: main.sellerId,
    cacheKey,
    tryOnDailyCapMicros: Math.round(budget.tryOnDailyCapUsd * 1_000_000),
    now,
  });

  // Llamada al proveedor: la foto, las fotos públicas de los productos y sus nombres. Nada más.
  const storage = getStorage();
  const started = Date.now();
  let result;
  try {
    const person = await readImage(storage, `/media/${photo.media.storageKey}`);
    const garmentInputs: TryOnGarment[] = await Promise.all(
      garments.map(async ({ product, slot }) => ({
        image: await readImage(storage, product.image!.url),
        title: product.title,
        slot,
      })),
    );
    result = await withTimeout(
      provider.generate(tryOnTask, { person, garments: garmentInputs }),
      IMAGE_CALL_TIMEOUT_MS + 5_000,
    );
  } catch (error) {
    await failGeneration(reserved, error, started, now);
    throw error instanceof TryOnError ? error : new AIError(providerFailure(error));
  }

  // El resultado se normaliza como cualquier foto (webp, sin metadatos, tamaño acotado).
  const image = await processImage(result.image.data);
  const storageKey = newStorageKey(now);
  const media = await db.media.create({
    data: {
      ownerId: userId,
      storageKey,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      sizeBytes: image.sizeBytes,
      blurDataUrl: image.blurDataUrl,
      status: "PROCESSING",
    },
    select: { id: true },
  });
  await storage.put(storageKey, image.buffer);
  const cost = recordedImageCost(provider.model, result.usage.images);
  if (!cost.known) console.error(`[tryon] costo desconocido para ${provider.model}`);
  const [row] = await db.$transaction([
    db.tryOnResult.update({
      where: { id: reserved.resultId },
      data: { status: "READY", resultMediaId: media.id },
      select: resultSelect,
    }),
    db.media.update({ where: { id: media.id }, data: { status: "READY" } }),
    db.aIResponse.create({
      data: {
        requestId: reserved.requestId,
        output: { resultId: reserved.resultId, images: result.usage.images },
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costMicrosUsd: cost.micros,
      },
    }),
    db.aIRequest.update({
      where: { id: reserved.requestId },
      data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
    }),
  ]);
  track({
    type: "TRY_ON_GENERATED",
    userId,
    surface: "STYLIST",
    entityType: "PRODUCT",
    entityId: main.id,
    metadata: { funding: reserved.funding, cached: false, garments: garments.length },
  });
  return toDTO(row, false);
}

type Reserved = {
  requestId: string;
  resultId: string;
  funding: AIFunding;
  chargedCents: number;
  payerUserId: string | null;
};

/**
 * Intenta cada opción de financiamiento en orden. Para las pagadas, el cobro del saldo y la fila
 * del resultado van en la MISMA transacción que la reserva de la solicitud: o queda todo o nada.
 */
async function reserveWithFunding({
  userId,
  options,
  target,
  photoId,
  productIds,
  sellerId,
  cacheKey,
  tryOnDailyCapMicros,
  now,
}: {
  userId: string;
  options: FundingOption[];
  target: { id: string; model: string; promptVersion: string };
  photoId: string;
  productIds: string[];
  sellerId: string;
  cacheKey: string;
  tryOnDailyCapMicros: number;
  now: Date;
}): Promise<Reserved> {
  let lastError: unknown = null;
  for (const option of options) {
    const payerUserId = option.funding === "SELLER_PAID" ? option.sponsorUserId : null;
    let resultId = "";
    try {
      const { requestId } = await reserveAiRequest({
        userId,
        feature: "VIRTUAL_TRY_ON",
        provider: target,
        input: { photoId, productIds, cacheKey },
        funding: option.funding,
        limits: TRY_ON_LIMITS,
        featureDailyCapMicros: option.funding === "PLATFORM" ? tryOnDailyCapMicros : null,
        now,
        reserve: async (tx, requestId) => {
          if (payerUserId) {
            const debit = await debitWallet(tx, {
              userId: payerUserId,
              amountCents: option.chargedCents,
              kind: "SPONSORED_TRY_ON",
              reference: requestId,
            });
            if (!debit.ok)
              throw new TryOnError("NEEDS_BALANCE", { balanceCents: debit.balanceCents });
          }
          const created = await tx.tryOnResult.create({
            data: {
              userId,
              photoId,
              productIds,
              sellerId,
              cacheKey,
              aiRequestId: requestId,
              funding: option.funding,
              sponsorSellerId: option.funding === "SELLER_PAID" ? option.sponsorSellerId : null,
              chargedCents: option.chargedCents,
              expiresAt: expiresAt(now),
            },
            select: { id: true },
          });
          resultId = created.id;
        },
      });
      return {
        requestId,
        resultId,
        funding: option.funding,
        chargedCents: option.chargedCents,
        payerUserId,
      };
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new TryOnError("IN_PROGRESS");
      }
      // Sin saldo de la tienda o sin subsidio del día: la siguiente opción. Las cuotas por
      // persona y el resto de errores sí detienen.
      const skippable =
        (error instanceof TryOnError && error.code === "NEEDS_BALANCE") ||
        (error instanceof AIError && error.code === "DAILY_CAP") ||
        (error instanceof AIError &&
          error.code === "BUDGET_EXCEEDED" &&
          option.funding === "PLATFORM");
      if (!skippable) throw error;
      lastError = error;
    }
  }
  if (lastError instanceof AIError) throw lastError;
  throw new TryOnError("STORE_NOT_FUNDED");
}

/**
 * Borra una simulación fallida o vencida (fila y archivo) para que la misma foto con las mismas
 * prendas se pueda volver a generar. Idempotente: si ya no existe, no hace nada.
 */
async function discardResult(id: string) {
  const row = await db.tryOnResult.findUnique({
    where: { id },
    select: { resultMedia: { select: { id: true, storageKey: true } } },
  });
  if (!row) return;
  await db.$transaction([
    db.tryOnResult.deleteMany({ where: { id } }),
    ...(row.resultMedia ? [db.media.deleteMany({ where: { id: row.resultMedia.id } })] : []),
  ]);
  if (row.resultMedia) {
    try {
      await deleteStoredMedia(getStorage(), row.resultMedia.storageKey);
    } catch (cause) {
      console.error("[tryon] no se pudo borrar el archivo de una simulación vencida", cause);
    }
  }
}

/** El proveedor falló: la solicitud queda FAILED, el resultado FAILED y el cobro se devuelve. */
async function failGeneration(reserved: Reserved, error: unknown, started: number, now: Date) {
  const code = error instanceof TryOnError ? error.code : providerFailure(error);
  await db
    .$transaction(async (tx) => {
      await tx.aIRequest.update({
        where: { id: reserved.requestId },
        data: { status: "FAILED", errorCode: code, latencyMs: Date.now() - started },
      });
      await tx.tryOnResult.update({
        where: { id: reserved.resultId },
        data: { status: "FAILED", errorCode: code.slice(0, 40) },
      });
      if (reserved.payerUserId && reserved.chargedCents > 0) {
        await creditWallet(tx, {
          userId: reserved.payerUserId,
          amountCents: reserved.chargedCents,
          kind: "REFUND",
          reference: reserved.requestId,
        });
      }
    })
    .catch((cause: unknown) => {
      console.error("[tryon] no se pudo registrar la falla", cause, now.toISOString());
    });
}

/** Una simulación (solo su dueña o dueño). */
export async function getTryOnResult(
  userId: string,
  resultId: string,
): Promise<TryOnResultDTO | null> {
  const row = await db.tryOnResult.findFirst({
    where: { id: resultId, userId },
    select: resultSelect,
  });
  return row ? toDTO(row, false) : null;
}

/** Últimas simulaciones listas de la persona («Mis pruebas»). */
export async function listTryOnResults(userId: string, now = new Date(), limit = 12) {
  const rows = await db.tryOnResult.findMany({
    where: { userId, status: "READY", expiresAt: { gt: now } },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: resultSelect,
  });
  return Promise.all(rows.map((row) => toDTO(row, false)));
}

/**
 * Retención (ADR-045): borra fotos y simulaciones vencidas, filas y archivos. Idempotente; para la
 * operación diaria. Devuelve cuántas borró.
 */
export async function deleteExpiredTryOnMedia(
  client: Database,
  storage: Pick<StorageProvider, "delete">,
  now = new Date(),
  batchSize = 200,
): Promise<{ photos: number; results: number; failedFiles: string[] }> {
  const failedFiles: string[] = [];
  const drop = async (key: string) => {
    try {
      await deleteStoredMedia(storage, key);
    } catch {
      failedFiles.push(key);
    }
  };

  const results = await client.tryOnResult.findMany({
    where: { expiresAt: { lte: now } },
    take: batchSize,
    select: { id: true, resultMedia: { select: { id: true, storageKey: true } } },
  });
  if (results.length > 0) {
    const mediaIds = results.flatMap((row) => (row.resultMedia ? [row.resultMedia.id] : []));
    await client.$transaction([
      client.tryOnResult.deleteMany({ where: { id: { in: results.map((row) => row.id) } } }),
      client.media.deleteMany({ where: { id: { in: mediaIds } } }),
    ]);
    for (const row of results) if (row.resultMedia) await drop(row.resultMedia.storageKey);
  }

  const photos = await client.tryOnPhoto.findMany({
    where: { expiresAt: { lte: now } },
    take: batchSize,
    select: {
      id: true,
      media: { select: { id: true, storageKey: true } },
      results: { select: { resultMedia: { select: { id: true, storageKey: true } } } },
    },
  });
  if (photos.length > 0) {
    const media = photos.flatMap((photo) => [
      photo.media,
      ...photo.results.flatMap((result) => (result.resultMedia ? [result.resultMedia] : [])),
    ]);
    await client.$transaction([
      client.tryOnPhoto.deleteMany({ where: { id: { in: photos.map((photo) => photo.id) } } }),
      client.media.deleteMany({ where: { id: { in: media.map((m) => m.id) } } }),
    ]);
    for (const m of media) await drop(m.storageKey);
  }
  return { photos: photos.length, results: results.length, failedFiles };
}
