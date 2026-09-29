import "server-only";
import { createHash } from "node:crypto";
import { z } from "zod";
import { track } from "@/modules/analytics/track";
import { AIError, providerFailure, withTimeout, SERVICE_TIMEOUT_MS } from "@/modules/ai/service";
import { recordedCost } from "@/modules/ai/cost";
import { isFeatureOn, requireFeature } from "@/modules/ai/features-store";
import { redactPersonalData } from "@/modules/ai/personal-data";
import { reserveAiRequest } from "@/modules/ai/reservation";
import { aiAvailability, simulatedRecord } from "@/modules/ai/tasks/availability";
import type { MediaDTO } from "@/modules/catalog/dto";
import { siteConfig } from "@/config/site";
import { db } from "@/server/db";
import { getAIProvider } from "@/server/providers/ai";
import {
  type ComposedLook,
  COMPOSER_VERSION,
  composeLooks,
  type LookCandidate,
  swapSlot,
} from "./composer";
import { ruleBasedLookCopy } from "./look-copy";
import {
  describeNeed,
  mergeNeed,
  type Need,
  NEED_TEXT_MAX,
  needSchema,
  needTask,
  parseNeedByRules,
} from "./need";
import {
  type CandidateRow,
  getSellableProductBySlug,
  listLookCandidates,
  listSellableProductsByIds,
} from "./queries";
import { classifySlot, type OutfitSlot, SLOT_LABELS } from "./slots";

/** Cuotas propias de «¿Qué necesitas?» (además de las generales de IA). */
export const NEED_LIMITS = { key: "need", perHour: 20, perDay: 60 } as const;

export type LookItemDTO = {
  slot: OutfitSlot;
  slotLabel: string;
  product: {
    id: string;
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    city: string;
    sellerName: string;
    image: MediaDTO | null;
  };
};

export type LookDTO = {
  /** `null` para visitantes (no se guarda). */
  id: string | null;
  title: string;
  explanation: string | null;
  copySource: "rules" | "ai" | "simulated";
  template: ComposedLook["template"];
  totalCents: number;
  currency: string;
  withinBudget: boolean;
  items: LookItemDTO[];
};

export type NeedResult = {
  need: Need;
  summary: string;
  source: "ai" | "rules" | "simulated";
};

export type LooksResult = NeedResult & {
  looks: LookDTO[];
  /** Cuántos productos de moda había para armar looks (para explicar un resultado vacío). */
  candidates: number;
};

export class StylistError extends Error {
  override name = "StylistError";
  constructor(readonly code: "PRODUCT_NOT_FOUND" | "NOT_A_GARMENT" | "LOOK_NOT_FOUND") {
    super(code);
  }
}

function toLookCandidate(row: CandidateRow): LookCandidate | null {
  const slot = classifySlot({
    categorySlug: row.categorySlug,
    parentSlug: row.parentSlug,
    title: row.title,
    tags: row.tags,
  });
  if (!slot) return null;
  return {
    id: row.id,
    slot,
    priceCents: row.priceCents,
    title: row.title,
    tags: row.tags,
    sellerId: row.sellerId,
    publishedAt: row.publishedAt,
  };
}

function toItemDTO(slot: OutfitSlot, row: CandidateRow): LookItemDTO {
  return {
    slot,
    slotLabel: SLOT_LABELS[slot],
    product: {
      id: row.id,
      slug: row.slug,
      title: row.title,
      priceCents: row.priceCents,
      currency: row.currency,
      city: row.city,
      sellerName: row.sellerName,
      image: row.image,
    },
  };
}

/**
 * Interpreta la necesidad. Con sesión, función encendida e IA disponible: una llamada al modelo
 * (`shopping_intent`) con cuota propia; el presupuesto siempre lo pone el código. Sin sesión, o si
 * el modelo falla o no cabe en la cuota, el intérprete de reglas, y se dice (`source`).
 */
export async function interpretNeed(userId: string | null, rawText: string): Promise<NeedResult> {
  const text = redactPersonalData(rawText).slice(0, NEED_TEXT_MAX);
  const rules = parseNeedByRules(text);
  const fallback: NeedResult = { need: rules, summary: describeNeed(rules), source: "rules" };
  if (!userId || !(await isFeatureOn("shoppingIntent"))) return fallback;
  if ((await aiAvailability("shopping_intent")) === "unavailable") return fallback;

  let requestId: string;
  let provider;
  try {
    provider = await getAIProvider("shopping_intent");
    ({ requestId } = await reserveAiRequest({
      userId,
      feature: "SHOPPING_INTENT",
      provider: { id: provider.id, model: provider.model, promptVersion: needTask.promptVersion },
      input: { text },
      limits: NEED_LIMITS,
    }));
  } catch (error) {
    if (error instanceof AIError) return fallback;
    throw error;
  }
  const started = Date.now();
  try {
    const result = await withTimeout(provider.generate(needTask, { text }), SERVICE_TIMEOUT_MS);
    const need = needSchema.parse(mergeNeed(text, result.output));
    const cost = recordedCost(provider.model, result.usage);
    await db.$transaction([
      db.aIResponse.create({
        data: {
          requestId,
          output: need,
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
    return {
      need,
      summary: describeNeed(need),
      source: simulatedRecord(provider.id) ? "simulated" : "ai",
    };
  } catch (error) {
    const code = providerFailure(error);
    await db.aIRequest
      .update({
        where: { id: requestId },
        data: { status: "FAILED", errorCode: code, latencyMs: Date.now() - started },
      })
      .catch(() => undefined);
    return fallback;
  }
}

function lookKey(look: ComposedLook) {
  return createHash("sha256")
    .update(look.items.map((item) => item.productId).join("|"))
    .digest("hex")
    .slice(0, 16);
}

/** Convierte looks armados en DTOs y, con sesión, los guarda para volver a verlos o probárselos. */
async function materialize({
  userId,
  needText,
  need,
  interpretedBy,
  copySource,
  looks,
  rows,
  anchorProductId,
}: {
  userId: string | null;
  needText: string;
  need: Need;
  /** Quién interpretó la necesidad; se guarda con ella para decirlo igual al reutilizar el look. */
  interpretedBy: LooksResult["source"];
  copySource: LookDTO["copySource"];
  looks: ComposedLook[];
  rows: Map<string, CandidateRow>;
  anchorProductId: string | null;
}): Promise<LookDTO[]> {
  const dtos: LookDTO[] = [];
  for (const [index, look] of looks.entries()) {
    const items = look.items.flatMap((item) => {
      const row = rows.get(item.productId);
      return row ? [toItemDTO(item.slot, row)] : [];
    });
    const copy = ruleBasedLookCopy({
      need,
      items: items.map((item) => ({ slot: item.slot, title: item.product.title })),
      index,
    });
    const withinBudget = need.budgetMaxCents === null || look.totalCents <= need.budgetMaxCents;
    let id: string | null = null;
    if (userId) {
      const saved = await db.styleLook.create({
        data: {
          userId,
          needText,
          need: { ...need, interpretedBy },
          items: look.items,
          totalCents: look.totalCents,
          currency: siteConfig.currency,
          title: copy.title,
          explanation: copy.explanation,
          copySource,
          anchorProductId,
          algorithmVersion: COMPOSER_VERSION,
        },
        select: { id: true },
      });
      id = saved.id;
    }
    dtos.push({
      id,
      title: copy.title,
      explanation: copy.explanation,
      copySource,
      template: look.template,
      totalCents: look.totalCents,
      currency: siteConfig.currency,
      withinBudget,
      items,
    });
  }
  return dtos;
}

/** Looks de la misma necesidad que se reutilizan en vez de armar otros. */
const REUSE_WINDOW_MS = 60 * 60 * 1000;

const storedNeedSchema = needSchema.extend({
  interpretedBy: z.enum(["ai", "rules", "simulated"]).optional(),
});

/**
 * Los looks que la persona ya pidió para esta misma necesidad en la última hora (con las piezas
 * que haya cambiado). `null` si no hay, si ya no se pueden pintar o si el presupuesto de «Completa
 * mi look» cambió (entonces se arman de nuevo).
 */
async function reuseRecentLooks({
  userId,
  needText,
  anchorProductId,
  budgetMaxCents,
}: {
  userId: string;
  needText: string;
  anchorProductId: string | null;
  budgetMaxCents?: number | null;
}): Promise<LooksResult | null> {
  const rows = await db.styleLook.findMany({
    where: {
      userId,
      needText,
      anchorProductId,
      createdAt: { gte: new Date(Date.now() - REUSE_WINDOW_MS) },
    },
    orderBy: { createdAt: "asc" },
    take: 3,
    select: { id: true, need: true },
  });
  const stored = rows[0] ? storedNeedSchema.safeParse(rows[0].need) : null;
  if (!stored?.success) return null;
  const { interpretedBy = "rules", ...need } = stored.data;
  if (anchorProductId !== null && (budgetMaxCents ?? null) !== need.budgetMaxCents) return null;
  const looks = (await Promise.all(rows.map((row) => getLook(row.id, userId)))).filter(
    (look): look is LookDTO => look !== null && look.items.length > 0,
  );
  if (looks.length === 0) return null;
  return {
    need,
    summary: describeNeed(need),
    source: interpretedBy,
    looks,
    candidates: looks.length,
  };
}

/**
 * «Crea mi look»: necesidad → productos reales de moda → looks completos dentro del presupuesto
 * (código, P2) con nombre honesto. Cada look lleva `productId`, precio y vendedor reales (P4).
 */
export async function createLooks({
  userId,
  text,
}: {
  userId: string | null;
  text: string;
}): Promise<LooksResult> {
  await requireFeature("createLook");
  const needText = redactPersonalData(text).slice(0, NEED_TEXT_MAX);
  // La misma necesidad en la última hora: los looks guardados (con los cambios de piezas), sin
  // volver a llamar al modelo ni duplicar filas (recargar o revalidar la página no arma otros).
  const reused = userId
    ? await reuseRecentLooks({ userId, needText, anchorProductId: null })
    : null;
  if (reused) return reused;
  const interpreted = await interpretNeed(userId, text);
  const rows = await listLookCandidates({ excludeUserId: userId });
  const byId = new Map(rows.map((row) => [row.id, row]));
  const candidates = rows.flatMap((row) => {
    const candidate = toLookCandidate(row);
    return candidate ? [candidate] : [];
  });
  const composed = composeLooks({ candidates, need: interpreted.need });
  const looks = await materialize({
    userId,
    needText,
    need: interpreted.need,
    interpretedBy: interpreted.source,
    copySource:
      interpreted.source === "ai"
        ? "rules"
        : interpreted.source === "simulated"
          ? "simulated"
          : "rules",
    looks: composed,
    rows: byId,
    anchorProductId: null,
  });
  track(
    {
      type: "NEED_SUBMITTED",
      userId,
      surface: "STYLIST",
      metadata: { source: interpreted.source },
    },
    ...looks.map((look) => ({
      type: "LOOK_GENERATED" as const,
      userId,
      surface: "STYLIST" as const,
      metadata: { items: look.items.length, key: lookKey({ ...composed[0]!, items: [] }) },
    })),
  );
  return { ...interpreted, looks, candidates: candidates.length };
}

/**
 * «Completa mi look»: parte de un producto y busca lo que combina (código) con el presupuesto que
 * la persona indique. El producto fijo va en todos los looks.
 */
export async function completeLook({
  userId,
  productSlug,
  budgetMaxCents = null,
}: {
  userId: string | null;
  productSlug: string;
  budgetMaxCents?: number | null;
}): Promise<LooksResult & { anchor: LookItemDTO }> {
  await requireFeature("completeLook");
  const anchorRow = await getSellableProductBySlug(productSlug);
  if (!anchorRow) throw new StylistError("PRODUCT_NOT_FOUND");
  const anchor = toLookCandidate(anchorRow);
  if (!anchor) throw new StylistError("NOT_A_GARMENT");
  const need: Need = {
    ...parseNeedByRules(`${anchorRow.title} ${anchorRow.tags.join(" ")}`),
    budgetMaxCents,
  };
  const needText = `Completa mi look: ${anchorRow.title}`.slice(0, NEED_TEXT_MAX);
  const reused = userId
    ? await reuseRecentLooks({ userId, needText, anchorProductId: anchorRow.id, budgetMaxCents })
    : null;
  if (reused) return { ...reused, anchor: toItemDTO(anchor.slot, anchorRow) };
  const rows = await listLookCandidates({ excludeUserId: userId });
  const byId = new Map(rows.map((row) => [row.id, row]));
  byId.set(anchorRow.id, anchorRow);
  const candidates = rows.flatMap((row) => {
    const candidate = toLookCandidate(row);
    return candidate ? [candidate] : [];
  });
  const composed = composeLooks({ candidates, need, anchor });
  const looks = await materialize({
    userId,
    needText,
    need,
    interpretedBy: "rules",
    copySource: "rules",
    looks: composed,
    rows: byId,
    anchorProductId: anchorRow.id,
  });
  track({
    type: "LOOK_GENERATED",
    userId,
    surface: "STYLIST",
    entityType: "PRODUCT",
    entityId: anchorRow.id,
    metadata: { items: looks[0]?.items.length ?? 0, anchor: "product" },
  });
  return {
    need,
    summary: describeNeed(need),
    source: "rules",
    looks,
    candidates: candidates.length,
    anchor: toItemDTO(anchor.slot, anchorRow),
  };
}

/** Un look guardado (solo su dueña o dueño), con los productos que siguen a la venta. */
export async function getLook(lookId: string, userId: string): Promise<LookDTO | null> {
  const row = await db.styleLook.findFirst({
    where: { id: lookId, userId },
    select: {
      id: true,
      title: true,
      explanation: true,
      copySource: true,
      totalCents: true,
      currency: true,
      items: true,
      need: true,
    },
  });
  if (!row) return null;
  const items = (row.items as ComposedLook["items"]) ?? [];
  const products = await listSellableProductsByIds(items.map((item) => item.productId));
  const byId = new Map(products.map((product) => [product.id, product]));
  const need = needSchema.safeParse(row.need);
  const budget = need.success ? need.data.budgetMaxCents : null;
  return {
    id: row.id,
    title: row.title,
    explanation: row.explanation,
    copySource: row.copySource as LookDTO["copySource"],
    template: items.some((item) => item.slot === "dress") ? "dress-shoes" : "top-bottom-shoes",
    totalCents: row.totalCents,
    currency: row.currency,
    withinBudget: budget === null || row.totalCents <= budget,
    items: items.flatMap((item) => {
      const product = byId.get(item.productId);
      return product ? [toItemDTO(item.slot, product)] : [];
    }),
  };
}

/**
 * «Quiero otros zapatos»: cambia la pieza de un hueco por la siguiente opción (o una más barata)
 * con productos reales, dentro del presupuesto del look. Devuelve el look actualizado.
 */
export async function swapLookItem({
  lookId,
  userId,
  slot,
  direction = "next",
}: {
  lookId: string;
  userId: string;
  slot: OutfitSlot;
  direction?: "next" | "cheaper";
}): Promise<LookDTO | null> {
  const row = await db.styleLook.findFirst({
    where: { id: lookId, userId },
    select: { id: true, items: true, need: true, totalCents: true, anchorProductId: true },
  });
  if (!row) throw new StylistError("LOOK_NOT_FOUND");
  const parsedNeed = needSchema.safeParse(row.need);
  const need: Need = parsedNeed.success ? parsedNeed.data : parseNeedByRules("");
  const items = (row.items as ComposedLook["items"]) ?? [];
  if (
    row.anchorProductId &&
    items.find((item) => item.slot === slot)?.productId === row.anchorProductId
  ) {
    return getLook(lookId, userId);
  }
  const rows = await listLookCandidates({ excludeUserId: userId });
  const candidates = rows.flatMap((candidateRow) => {
    const candidate = toLookCandidate(candidateRow);
    return candidate ? [candidate] : [];
  });
  const current: ComposedLook = {
    template: items.some((item) => item.slot === "dress") ? "dress-shoes" : "top-bottom-shoes",
    items,
    totalCents: row.totalCents,
    score: 0,
  };
  const swapped = swapSlot(current, slot, candidates, need, direction);
  if (!swapped) return null;
  await db.styleLook.update({
    where: { id: row.id },
    data: { items: swapped.items, totalCents: swapped.totalCents },
  });
  track({
    type: "LOOK_ITEM_SWAPPED",
    userId,
    surface: "STYLIST",
    metadata: { slot, direction },
  });
  return getLook(lookId, userId);
}

/** Últimos looks de la persona («Mis looks»). */
export async function listMyLooks(userId: string, limit = 12) {
  const rows = await db.styleLook.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      title: true,
      totalCents: true,
      currency: true,
      createdAt: true,
      items: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    totalCents: row.totalCents,
    currency: row.currency,
    createdAt: row.createdAt.toISOString(),
    items: ((row.items as ComposedLook["items"]) ?? []).length,
  }));
}

/**
 * Guarda la necesidad como intención de compra («Lo que buscas», ADR-043 matching): con presupuesto
 * y vigencia de 30 días. Una por sesión del estilista; la anterior del estilista se cierra.
 */
export async function saveNeedAsIntent(userId: string, text: string, need: Need) {
  const query = redactPersonalData(text).slice(0, 120).trim();
  if (query.length < 3) return;
  await db.$transaction([
    db.shoppingIntent.updateMany({
      where: { userId, source: "AI_COMPANION", status: "ACTIVE" },
      data: { status: "DISMISSED" },
    }),
    db.shoppingIntent.create({
      data: {
        userId,
        query,
        budgetMaxCents: need.budgetMaxCents,
        source: "AI_COMPANION",
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    }),
  ]);
}
