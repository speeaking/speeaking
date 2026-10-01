import "server-only";
import { recordedCost } from "@/modules/ai/cost";
import { AIError } from "@/modules/ai/errors";
import { isFeatureOn } from "@/modules/ai/features-store";
import { type FeatureLimits, reserveAiRequest } from "@/modules/ai/reservation";
import { providerFailure, SERVICE_TIMEOUT_MS, withTimeout } from "@/modules/ai/service";
import { simulatedRecord } from "@/modules/ai/tasks/availability";
import { track } from "@/modules/analytics/track";
import { type ProductCardDTO, listShopProducts } from "@/modules/catalog/queries";
import {
  ImageBusyError,
  ImageValidationError,
  resizeForVision,
} from "@/modules/media/image-processing";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { getAIRoute, providerForRoute } from "@/server/providers/ai";
import type { AIProvider } from "@/server/providers/ai/types";
import { parseSearchQuery } from "./normalize";
import { itemsToQueries, type PhotoItem, photoSearchTask } from "./photo-search";

/** Búsquedas por foto por persona (ADR-061), además de las cuotas generales de IA. */
export const PHOTO_SEARCH_LIMITS: FeatureLimits = { key: "photo", perHour: 10, perDay: 20 };
/** Productos por cada cosa que se vio. */
const RESULTS_PER_ITEM = 12;

export type PhotoSearchResult =
  | {
      ok: true;
      /** Cada cosa que se vio, con sus productos parecidos del catálogo. */
      results: { label: string; query: string; products: ProductCardDTO[] }[];
      simulated: boolean;
    }
  | {
      ok: false;
      reason: "invalid_image" | "busy" | "unavailable" | "limited" | "failed" | "nothing";
      message?: string;
    };

const IMAGE_MESSAGES: Record<string, string> = {
  TOO_LARGE: "La foto pesa demasiado. Prueba con otra.",
  TOO_COMPLEX: "La foto es demasiado grande. Prueba con otra.",
  UNSUPPORTED_FORMAT: "Ese archivo no es una foto que podamos leer (JPG, PNG, WebP o AVIF).",
  CORRUPT: "No pudimos leer la foto. Prueba con otra.",
};

/**
 * El modelo que ve fotos: la ruta de `ai.routing` si la hay; si no, `AI_VISION_MODEL` (el modelo de
 * texto por omisión no ve imágenes); con la IA simulada, el simulador. `null`: no disponible.
 */
async function visionProvider(): Promise<AIProvider | null> {
  const route = await getAIRoute("image_search");
  if (route.source === "routing" || route.provider === "mock") return providerForRoute(route);
  if (!env.AI_VISION_MODEL) return null;
  return providerForRoute({ provider: "openai_compatible", model: env.AI_VISION_MODEL });
}

/**
 * Parecidos de la búsqueda más precisa a la más general («camisa de lino blanca» → «camisa»), sin
 * repetir, hasta juntar `RESULTS_PER_ITEM`: los más parecidos quedan primero.
 */
async function similarProducts(queries: string[]): Promise<ProductCardDTO[]> {
  const found = new Map<string, ProductCardDTO>();
  for (const text of queries) {
    const query = parseSearchQuery(text);
    if (!query) continue;
    for (const product of await listShopProducts({ query, limit: RESULTS_PER_ITEM })) {
      if (!found.has(product.id)) found.set(product.id, product);
    }
    if (found.size >= RESULTS_PER_ITEM) break;
  }
  return [...found.values()].slice(0, RESULTS_PER_ITEM);
}

/**
 * Buscar por foto (ADR-061): reduce la foto (768 px, JPEG, sin metadatos), pide al modelo que
 * describa lo que se puede comprar y busca cada cosa en el catálogo. La foto no se guarda y en el
 * registro de IA solo queda que hubo una foto, nunca la foto.
 */
export async function searchByPhoto(userId: string, photo: Buffer): Promise<PhotoSearchResult> {
  if (!(await isFeatureOn("imageSearch"))) return { ok: false, reason: "unavailable" };
  const provider = await visionProvider();
  if (!provider) return { ok: false, reason: "unavailable" };

  let image: Buffer;
  try {
    image = await resizeForVision(photo);
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return { ok: false, reason: "invalid_image", message: IMAGE_MESSAGES[error.code] };
    }
    if (error instanceof ImageBusyError) return { ok: false, reason: "busy" };
    throw error;
  }

  let requestId: string;
  try {
    ({ requestId } = await reserveAiRequest({
      userId,
      feature: "IMAGE_SEARCH",
      provider: {
        id: provider.id,
        model: provider.model,
        promptVersion: photoSearchTask.promptVersion,
      },
      input: { photo: "no se guarda" },
      limits: PHOTO_SEARCH_LIMITS,
    }));
  } catch (error) {
    if (error instanceof AIError) {
      return error.code === "RATE_LIMITED" || error.code === "QUOTA_EXCEEDED"
        ? { ok: false, reason: "limited" }
        : { ok: false, reason: "unavailable" };
    }
    throw error;
  }

  const started = Date.now();
  let items: PhotoItem[];
  try {
    const result = await withTimeout(
      provider.generate(photoSearchTask, {
        image: `data:image/jpeg;base64,${image.toString("base64")}`,
      }),
      SERVICE_TIMEOUT_MS,
    );
    items = itemsToQueries(result.output);
    const cost = recordedCost(provider.model, result.usage);
    await db.$transaction([
      db.aIResponse.create({
        data: {
          requestId,
          output: { items },
          inputTokens: result.usage.inputTokens,
          outputTokens: result.usage.outputTokens,
          costMicrosUsd: cost.micros,
        },
      }),
      db.aIRequest.update({
        where: { id: requestId },
        data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
      }),
    ]);
  } catch (error) {
    await db.aIRequest
      .update({
        where: { id: requestId },
        data: {
          status: "FAILED",
          errorCode: providerFailure(error),
          latencyMs: Date.now() - started,
        },
      })
      .catch(() => undefined);
    console.error("[búsqueda por foto] no se pudo describir la foto", error);
    return { ok: false, reason: "failed" };
  }
  if (items.length === 0) return { ok: false, reason: "nothing" };

  const results = await Promise.all(
    items.map(async (item) => ({
      label: item.label,
      query: item.queries[0]!,
      products: await similarProducts(item.queries),
    })),
  );
  // P5: lo que se buscó (las cosas que se vieron, nunca la foto) y cuánto se encontró.
  track({
    type: "SEARCH",
    userId,
    query: results.map((result) => result.query).join(", "),
    surface: "DISCOVER",
    metadata: {
      scope: "photo",
      products: results.reduce((total, result) => total + result.products.length, 0),
    },
  });
  return { ok: true, results, simulated: simulatedRecord(provider.id) };
}
