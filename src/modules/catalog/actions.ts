"use server";

import { randomBytes } from "node:crypto";
import type { Route } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { formatCount } from "@/lib/format";
import { track } from "@/modules/analytics/track";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { scheduleAuthenticityAiSignal } from "@/modules/trust/background";
import { isProofMediaLinkError, proofMediaIdsAmong } from "@/modules/trust/proof-media";
import { evaluateProductAuthenticity } from "@/modules/trust/service";
import { db } from "@/server/db";
import { parseProductForm, productEditMetaSchema, productSlug } from "./schemas";
import { ProductEditError, setProductStatus, updateProduct } from "./service";
import type { ToggleTarget } from "./status";

export type ProductFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  /** Edición: inventario vigente cuando cambió mientras se editaba (reemplaza el que se mostró). */
  stockShown?: string;
};

/** Una foto de comprobante de autenticidad (P14) nunca se adjunta a un producto. */
const PROOF_PHOTO =
  "Esa foto no se puede usar en un producto: es un comprobante de autenticidad. Elige otra.";

/** Crea un producto (con su costo privado y datos P4) y, si se pide, su publicación en el feed. */
export async function createProductAction(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const viewer = await requireOnboardedViewer("/studio/productos/nuevo");
  if (!viewer.sellerProfileId) return { error: "Activa tu perfil de vendedor primero." };

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisa los campos marcados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }
  const input = parsed.data;

  // Autorización: fotos propias que no sean de un comprobante (P14); categoría y comunidad
  // existentes. Toda foto enviada como comprobante tiene su fila en la bitácora (`proofHistory`).
  const [media, category, community] = await Promise.all([
    db.media.findMany({
      where: {
        id: { in: input.mediaIds },
        ownerId: viewer.userId,
        status: "READY",
        proofHistory: { none: {} },
      },
      select: { id: true },
    }),
    db.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }),
    input.communitySlug
      ? db.community.findUnique({ where: { slug: input.communitySlug }, select: { id: true } })
      : null,
  ]);
  if (media.length !== input.mediaIds.length) {
    // Una foto de comprobante (vigente o reemplazada) se explica aparte, sin un error de servidor.
    const proofs = await proofMediaIdsAmong(db, input.mediaIds);
    return { error: proofs.size > 0 ? PROOF_PHOTO : "Alguna foto no es válida." };
  }
  if (!category) return { fieldErrors: { categoryId: ["Elige una categoría válida."] } };

  const slug = productSlug(input.title, randomBytes(4).toString("hex").slice(0, 6));
  const sellerProfileId = viewer.sellerProfileId;
  const now = new Date();

  let createdId: string;
  try {
    createdId = await db.$transaction(async (tx) => {
      const product = await tx.product.create({
        data: {
          sellerId: sellerProfileId,
          slug,
          title: input.title,
          description: input.description,
          priceCents: input.priceCents,
          stock: input.stock,
          status: input.stock > 0 ? "ACTIVE" : "SOLD_OUT",
          categoryId: input.categoryId,
          condition: input.condition,
          tags: input.tags.map((tag) => tag.toLowerCase()),
          city: input.city,
          state: input.state,
          pickupAvailable: input.pickupAvailable,
          localDeliveryAvailable: input.localDeliveryAvailable,
          localDeliveryZones: input.localDeliveryZones,
          nationalShippingAvailable: input.nationalShippingAvailable,
          shippingPriceCents: input.shippingPriceCents,
          deliveryMinDays: input.deliveryMinDays,
          deliveryMaxDays: input.deliveryMaxDays,
          warrantyType: input.warrantyType,
          warrantyDays: input.warrantyDays,
          returnWindowDays: input.returnWindowDays,
          authenticity: input.authenticity,
          publishedAt: now,
          cost: { create: { unitCostCents: input.unitCostCents } },
          media: {
            create: input.mediaIds.map((mediaId, position) => ({ mediaId, position })),
          },
        },
        select: { id: true },
      });

      if (input.publishToFeed) {
        await tx.post.create({
          data: {
            authorId: viewer.userId,
            type: "PRODUCT",
            body: input.postBody ?? `¡Nuevo! ${input.title}`,
            productId: product.id,
            communityId: community?.id ?? null,
            publishedAt: now,
            media: {
              create: input.mediaIds.map((mediaId, position) => ({ mediaId, position })),
            },
          },
        });
      }
      return product.id;
    });
  } catch (error) {
    // Se guardó como comprobante entre la validación y el INSERT: el trigger
    // `reject_proof_media_link` lo rechaza y la transacción se deshace (nada quedó creado).
    if (isProofMediaLinkError(error)) return { error: PROOF_PHOTO };
    throw error;
  }

  // Revisión de riesgo de falsificación (P14) antes de mostrar el producto: si el riesgo es alto,
  // quien compra ya ve «Autenticidad sin verificar» y el vendedor la petición de comprobante. La
  // señal opcional de la IA va después de responder.
  await evaluateProductAuthenticity(createdId);
  scheduleAuthenticityAiSignal(createdId);

  // P3: la propuesta de IA se convirtió en producto (se mide la utilidad real de la IA).
  const proposalId = formData.get("proposalId");
  if (typeof proposalId === "string" && z.uuid().safeParse(proposalId).success) {
    track({
      type: "AI_PROPOSAL_ACCEPTED",
      userId: viewer.userId,
      entityType: "PRODUCT",
      entityId: createdId,
      surface: "STUDIO",
      metadata: { responseId: proposalId },
    });
  }

  redirect(`/producto/${slug}?nuevo=1` as Route);
}

const EDIT_MESSAGES: Record<ProductEditError["code"], string> = {
  NOT_FOUND: "No encontramos este producto en tu tienda.",
  INVALID_MEDIA: "Alguna foto no es válida. Quítala y vuelve a subirla.",
  INVALID_CATEGORY: "Elige una categoría válida.",
  NOT_TOGGLEABLE: "Este producto no se puede pausar ni reactivar.",
  STOCK_CHANGED: "Tus piezas disponibles cambiaron mientras editabas. Revisa el inventario.",
};

/** Guarda los cambios de un producto propio (el servicio comprueba que sea de quien edita). */
export async function updateProductAction(
  _previous: ProductFormState,
  formData: FormData,
): Promise<ProductFormState> {
  const meta = productEditMetaSchema.safeParse({
    productId: formData.get("productId"),
    stockShown: formData.get("stockShown") || undefined,
  });
  if (!meta.success) return { error: EDIT_MESSAGES.NOT_FOUND };
  const { productId, stockShown } = meta.data;
  const viewer = await requireOnboardedViewer(`/studio/productos/${productId}/editar`);
  // Con cualquier error se devuelve la referencia de inventario recibida: si venía de un aviso de
  // `STOCK_CHANGED`, el formulario no regresa a la vieja y el reintento no vuelve a chocar.
  const keep = stockShown === undefined ? {} : { stockShown: String(stockShown) };

  const parsed = parseProductForm(formData);
  if (!parsed.success) {
    return {
      error: "Revisa los campos marcados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
      ...keep,
    };
  }

  let slug: string;
  try {
    ({ slug } = await updateProduct(viewer.userId, productId, parsed.data, { stockShown }));
  } catch (error) {
    if (!(error instanceof ProductEditError)) throw error;
    if (error.code === "STOCK_CHANGED") {
      // Nada se guardó: el vendedor ve el número real y decide (lo que escribió se conserva).
      const current = error.currentStock ?? 0;
      return {
        error: EDIT_MESSAGES.STOCK_CHANGED,
        fieldErrors: {
          stock: [
            `Se vendieron o liberaron piezas: ahora tienes ${formatCount(current, "disponible", "disponibles")}. Corrige el número si hace falta y guarda de nuevo.`,
          ],
        },
        stockShown: String(current),
      };
    }
    return error.code === "INVALID_CATEGORY"
      ? { fieldErrors: { categoryId: [EDIT_MESSAGES.INVALID_CATEGORY] }, ...keep }
      : { error: EDIT_MESSAGES[error.code], ...keep };
  }

  scheduleAuthenticityAiSignal(productId);
  revalidatePath("/studio/productos");
  revalidatePath(`/producto/${slug}`);
  redirect("/studio/productos?guardado=1" as Route);
}

export type ToggleStatusResult =
  { ok: true; status: "ACTIVE" | "PAUSED" | "SOLD_OUT" } | { ok: false; error: string };

const toggleSchema = z.object({ productId: z.uuid(), target: z.enum(["ACTIVE", "PAUSED"]) });

/** Pausa o reactiva un producto propio desde el Studio. */
export async function toggleProductStatusAction(
  productId: string,
  target: ToggleTarget,
): Promise<ToggleStatusResult> {
  const viewer = await requireOnboardedViewer("/studio/productos");
  const parsed = toggleSchema.safeParse({ productId, target });
  if (!parsed.success) return { ok: false, error: EDIT_MESSAGES.NOT_FOUND };

  try {
    const result = await setProductStatus(viewer.userId, parsed.data.productId, parsed.data.target);
    revalidatePath("/studio/productos");
    revalidatePath(`/producto/${result.slug}`);
    return { ok: true, status: result.status };
  } catch (error) {
    if (error instanceof ProductEditError) return { ok: false, error: EDIT_MESSAGES[error.code] };
    throw error;
  }
}
