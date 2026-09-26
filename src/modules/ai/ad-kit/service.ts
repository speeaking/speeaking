import "server-only";
import { z } from "zod";
import type { ProductStatus } from "@/generated/prisma/enums";
import { buyerAuthenticityOf } from "@/modules/catalog/dto";
import { getAiBudget } from "@/modules/platform/settings";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { type AIResult, getAIProvider } from "@/server/providers/ai";
import { monthStart } from "../budget-ledger";
import { POLICY_MESSAGES, policyViolation } from "../content-policy";
import { recordedCost } from "../cost";
import { AIError } from "../errors";
import type { GuardFinding } from "../output-guard";
import { reserveAiRequest } from "../reservation";
import { maybeRedactExpiredAiInputs } from "../retention";
import { providerFailure, SERVICE_TIMEOUT_MS, withTimeout } from "../service";
import { type AdCopy, adCopySchema, adCopyTask } from "../tasks/ad-copy";
import { assertAiAvailable, simulatedRecord } from "../tasks/availability";
import { type AdKitVariant, composeAdKit } from "./compose";
import { type AdKitProduct, adCopyInput, adKitAuthenticityClaim, factsFingerprint } from "./facts";
import { guardAdCopy, priceLabel } from "./guard";

/**
 * Kit de anuncios (Studio → Contenido). Autorización en el servicio: cada función recibe a quien
 * actúa y solo ve productos de SU tienda (`seller.userId`). Un producto ajeno o inexistente es
 * «no encontrado», sin distinguirlos.
 */

/**
 * Selección del producto: datos públicos y estructurados, y la revisión de autenticidad vigente
 * (P14) para que el kit diga de la originalidad lo mismo que la ficha. Sin `cost` (no se consulta).
 */
const productSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  priceCents: true,
  currency: true,
  condition: true,
  tags: true,
  status: true,
  stock: true,
  moderationStatus: true,
  city: true,
  state: true,
  pickupAvailable: true,
  localDeliveryAvailable: true,
  localDeliveryZones: true,
  nationalShippingAvailable: true,
  shippingPriceCents: true,
  deliveryMinDays: true,
  deliveryMaxDays: true,
  warrantyType: true,
  warrantyDays: true,
  returnWindowDays: true,
  authenticity: true,
  authenticityCheck: { select: { status: true, riskLevel: true, signals: true } },
  category: { select: { name: true } },
  seller: { select: { acceptedPaymentMethods: true } },
} as const;

type ProductRow = NonNullable<
  Awaited<ReturnType<typeof db.product.findFirst<{ select: typeof productSelect }>>>
>;

function toAdKitProduct(row: ProductRow): AdKitProduct {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    categoryName: row.category.name,
    condition: row.condition,
    tags: row.tags,
    facts: {
      status: row.status,
      stock: row.stock,
      city: row.city,
      state: row.state,
      pickupAvailable: row.pickupAvailable,
      localDeliveryAvailable: row.localDeliveryAvailable,
      localDeliveryZones: row.localDeliveryZones,
      nationalShippingAvailable: row.nationalShippingAvailable,
      shippingPriceCents: row.shippingPriceCents,
      currency: row.currency,
      deliveryMinDays: row.deliveryMinDays,
      deliveryMaxDays: row.deliveryMaxDays,
      warrantyType: row.warrantyType,
      warrantyDays: row.warrantyDays,
      returnWindowDays: row.returnWindowDays,
      authenticity: row.authenticity,
      // Lo que ve quien compra (ficha y «¿Es original?»): «original» solo con lo declarado de riesgo
      // bajo o con el comprobante revisado (`adKitAuthenticityClaim`, `mayClaimOriginal`).
      authenticityClaim: adKitAuthenticityClaim(
        buyerAuthenticityOf(row.authenticity, row.authenticityCheck),
      ),
      acceptedPaymentMethods: row.seller.acceptedPaymentMethods,
    },
  };
}

/** Por qué un producto no puede llevar kit (su liga pública no vendería), o `null` si puede. */
export function ineligibleReason(row: {
  status: ProductStatus;
  stock: number;
  moderationStatus: "VISIBLE" | "HIDDEN";
}): string | null {
  if (row.moderationStatus === "HIDDEN") return "Oculto por moderación";
  if (row.status === "PAUSED") return "Pausado";
  if (row.status !== "ACTIVE") return "No está publicado";
  if (row.stock <= 0) return "Agotado";
  return null;
}

async function findOwnProduct(userId: string, productId: string) {
  if (!z.uuid().safeParse(productId).success) return null;
  return db.product.findFirst({
    where: { id: productId, seller: { userId } },
    select: productSelect,
  });
}

/** ¿El producto es de la tienda de esta persona? (para registrar lo que comparte). */
export async function ownsProduct(userId: string, productId: string) {
  if (!z.uuid().safeParse(productId).success) return false;
  const count = await db.product.count({ where: { id: productId, seller: { userId } } });
  return count > 0;
}

export type AdKitProductOption = {
  id: string;
  title: string;
  priceLabel: string;
  /** `null` si puede llevar kit. */
  unavailable: string | null;
};

/** Productos de la tienda para elegir (los activos primero). DTO sin costo. */
export async function listAdKitProducts(userId: string): Promise<AdKitProductOption[]> {
  const rows = await db.product.findMany({
    where: { seller: { userId }, status: { notIn: ["DRAFT", "ARCHIVED"] } },
    orderBy: [{ updatedAt: "desc" }],
    take: 60,
    select: {
      id: true,
      title: true,
      priceCents: true,
      currency: true,
      status: true,
      stock: true,
      moderationStatus: true,
    },
  });
  return rows
    .map((row) => ({
      id: row.id,
      title: row.title,
      priceLabel: priceLabel(row),
      unavailable: ineligibleReason(row),
    }))
    .sort((a, b) => Number(a.unavailable !== null) - Number(b.unavailable !== null));
}

/** Lo que se guarda en `AIResponse.output`: los textos revisados, con `[PRECIO]`. */
const storedKitSchema = z.object({
  version: z.literal(1),
  copy: adCopySchema,
  factsHash: z.string(),
  guard: z.object({
    removed: z.int().min(0),
    findings: z.array(z.enum(["contact", "payment", "urgency", "claim", "number"])),
  }),
});

export type AdKitView = {
  product: { id: string; title: string; priceLabel: string; unavailable: string | null };
  kit: {
    variants: AdKitVariant[];
    /**
     * Lo armó el simulador (piloto, ADR-038): «Texto de ejemplo (IA simulada)». Sale del proveedor
     * que lo escribió (`AIRequest.provider`), no de la ruta de hoy.
     */
    simulated: boolean;
    /** Fecha ya formateada en el servidor (hora de la Ciudad de México): sin desajustes al hidratar. */
    createdAtLabel: string;
    /** El producto cambió desde que se creó (precio, envío, garantía…): conviene uno nuevo. */
    stale: boolean;
    guard: { removed: number; findings: GuardFinding[] };
  } | null;
  usage: { used: number; limit: number };
};

async function monthlyUsage(userId: string, now = new Date()) {
  const [used, budget] = await Promise.all([
    db.aIRequest.count({
      where: {
        userId,
        createdAt: { gte: monthStart(now) },
        status: { in: ["PENDING", "SUCCEEDED", "FAILED"] },
      },
    }),
    getAiBudget(),
  ]);
  return { used, limit: budget.maxRequestsPerUserPerMonth };
}

type StoredKit = z.infer<typeof storedKitSchema> & { createdAt: Date; provider: string };

const CREATED_AT = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Mexico_City",
});

/**
 * Vista del kit con los datos VIGENTES del producto. Los textos guardados se revisan otra vez con
 * el guardián contra los datos de hoy (P4): si el vendedor quitó el envío gratis o la garantía
 * después de crear el kit, esas frases ya no se muestran ni se copian. Un producto que hoy no se
 * puede comprar (pausado, agotado, oculto) no muestra su kit: su liga no vendería.
 */
function viewOf(
  product: AdKitProduct,
  unavailable: string | null,
  stored: StoredKit | null,
  usage: AdKitView["usage"],
): AdKitView {
  let kit: AdKitView["kit"] = null;
  if (stored && !unavailable) {
    const current = guardAdCopy(stored.copy, product);
    kit = {
      variants: composeAdKit(current.copy, product, env.APP_URL),
      simulated: simulatedRecord(stored.provider),
      createdAtLabel: CREATED_AT.format(stored.createdAt),
      stale: stored.factsHash !== factsFingerprint(product),
      guard: {
        removed: stored.guard.removed + current.removed,
        findings: [...new Set([...stored.guard.findings, ...current.findings])],
      },
    };
  }
  return {
    product: {
      id: product.id,
      title: product.title,
      priceLabel: priceLabel(product),
      unavailable,
    },
    kit,
    usage,
  };
}

/** El último kit guardado del producto (se compone con el precio y los datos VIGENTES). */
async function latestStoredKit(userId: string, productId: string) {
  const request = await db.aIRequest.findFirst({
    where: {
      userId,
      feature: "CONTENT_GENERATION",
      status: "SUCCEEDED",
      input: { path: ["productId"], equals: productId },
    },
    orderBy: { createdAt: "desc" },
    select: { provider: true, response: { select: { output: true, createdAt: true } } },
  });
  if (!request?.response) return null;
  const parsed = storedKitSchema.safeParse(request.response.output);
  return parsed.success
    ? { ...parsed.data, createdAt: request.response.createdAt, provider: request.provider }
    : null;
}

/** Vista del kit de un producto propio, o `null` si no existe o no es de esta persona. */
export async function getAdKitView(userId: string, productId: string): Promise<AdKitView | null> {
  const row = await findOwnProduct(userId, productId);
  if (!row) return null;
  const [stored, usage] = await Promise.all([
    latestStoredKit(userId, row.id),
    monthlyUsage(userId),
  ]);
  return viewOf(toAdKitProduct(row), ineligibleReason(row), stored, usage);
}

export class AdKitError extends Error {
  override name = "AdKitError";
  constructor(
    readonly code: "NOT_FOUND" | "NOT_ELIGIBLE" | "NOT_ALLOWED",
    readonly userMessage: string,
  ) {
    super(code);
  }
}

/**
 * Genera un kit nuevo para un producto propio, activo y visible (uno oculto por moderación no lleva
 * kit): revisa la política de productos y que haya IA disponible (ADR-038; si no, `UNAVAILABLE` sin
 * gastar la cuota), reserva cuota y presupuesto (las cuotas del vendedor: 10 al día y 30 al mes,
 * ADR-033), llama al modelo de `ad_copy`, revisa los textos contra los datos del producto (P2, P4)
 * y los guarda con el proveedor que los escribió (la etiqueta sigue a ese registro).
 */
export async function generateAdKit(userId: string, productId: string): Promise<AdKitView> {
  const row = await findOwnProduct(userId, productId);
  if (!row) throw new AdKitError("NOT_FOUND", "No encontramos ese producto en tu tienda.");
  const unavailable = ineligibleReason(row);
  if (unavailable) {
    throw new AdKitError(
      "NOT_ELIGIBLE",
      `No podemos crear un kit para este producto (${unavailable.toLowerCase()}): su liga no vendería.`,
    );
  }
  const product = toAdKitProduct(row);
  const violation = policyViolation(product.title, product.description, product.tags.join(" "));
  if (violation) throw new AdKitError("NOT_ALLOWED", POLICY_MESSAGES[violation]);

  await assertAiAvailable("ad_copy");
  const provider = await getAIProvider("ad_copy");
  const task = adCopyTask;
  const factsHash = factsFingerprint(product);
  await maybeRedactExpiredAiInputs();
  const { requestId } = await reserveAiRequest({
    userId,
    feature: "CONTENT_GENERATION",
    provider: { id: provider.id, model: provider.model, promptVersion: task.promptVersion },
    // Solo el id y la huella de los datos (públicos): la descripción ya está en el producto.
    input: { kind: "ad_kit", productId: product.id, factsHash },
  });

  const started = Date.now();
  const fail = (errorCode: "INVALID_OUTPUT" | "PROVIDER_ERROR") =>
    db.aIRequest.update({
      where: { id: requestId },
      data: { status: "FAILED", errorCode, latencyMs: Date.now() - started },
    });

  let result: AIResult<AdCopy>;
  try {
    result = await withTimeout(provider.generate(task, adCopyInput(product)), SERVICE_TIMEOUT_MS);
  } catch (error) {
    const code = providerFailure(error);
    await fail(code);
    throw new AIError(code);
  }

  const guarded = guardAdCopy(result.output, product);
  const cost = recordedCost(provider.model, result.usage);
  if (!cost.known) console.error(`[ai] costo desconocido para ${provider.model}`);
  const stored = {
    version: 1 as const,
    copy: guarded.copy,
    factsHash,
    guard: { removed: guarded.removed, findings: guarded.findings },
  };
  const [response] = await db.$transaction([
    db.aIResponse.create({
      data: {
        requestId,
        output: stored,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costMicrosUsd: cost.micros,
      },
      select: { createdAt: true },
    }),
    db.aIRequest.update({
      where: { id: requestId },
      data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
    }),
  ]);
  return viewOf(
    product,
    null,
    { ...stored, createdAt: response.createdAt, provider: provider.id },
    await monthlyUsage(userId),
  );
}
