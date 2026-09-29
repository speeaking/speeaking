"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { parsePesosToCents } from "@/modules/catalog/pricing";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { z } from "zod";
import { FEATURED_MAX_DAYS, FEATURED_MIN_DAYS, MIN_SPONSOR_DAILY_CAP_CENTS } from "./pricing";
import { BillingError, featureProduct, setSponsorTryOn, topUpSimulated } from "./service";

export type BillingFormState = { error?: string; ok?: string };

async function billingLimit(userId: string) {
  return limitOrError(
    await rateLimit({
      key: rateLimitKey("billing.actions", "user", userId)!,
      limit: 20,
      windowSeconds: 60 * 60,
    }),
  );
}

/** Recarga simulada (ADR-032): sin cobro real; el saldo queda marcado como simulado. */
export async function topUpAction(
  _previous: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const viewer = await requireOnboardedViewer("/studio/saldo");
  const limited = await billingLimit(viewer.userId);
  if (limited) return { error: limited };
  if (!viewer.sellerProfileId)
    return { error: "El saldo es de las tiendas: abre la tuya primero." };
  const packId = String(formData.get("packId") ?? "");
  try {
    const result = await topUpSimulated(viewer.userId, packId);
    revalidatePath("/studio/saldo");
    revalidatePath("/saldo");
    revalidatePath("/probar");
    return {
      ok: `Recarga simulada aplicada: tu saldo es ${(result.balanceCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}. En esta etapa no se cobra nada.`,
    };
  } catch (error) {
    if (error instanceof BillingError) {
      return {
        error:
          error.code === "PAYMENTS_UNAVAILABLE"
            ? "Las recargas todavía no están disponibles."
            : "Esa recarga no existe.",
      };
    }
    throw error;
  }
}

const featureSchema = z.object({
  productId: z.uuid(),
  days: z.coerce.number().int().min(FEATURED_MIN_DAYS).max(FEATURED_MAX_DAYS),
});

const FEATURE_MESSAGES: Record<string, string> = {
  INVALID_DAYS: `Elige entre ${FEATURED_MIN_DAYS} y ${FEATURED_MAX_DAYS} días.`,
  NOT_SELLER: "Activa tu tienda para destacar productos.",
  PRODUCT_NOT_FOUND: "Ese producto no es tuyo o ya no existe.",
  PRODUCT_NOT_SELLABLE: "Solo se destacan productos activos, con existencias y visibles.",
  INSUFFICIENT_BALANCE: "Te falta saldo para esos días. Recarga en Saldo.",
};

const untilFormat = new Intl.DateTimeFormat("es-MX", {
  dateStyle: "medium",
  timeZone: "America/Mexico_City",
});

/** «Destacar» un producto N días desde el saldo de la tienda (ADR-046). */
export async function featureProductAction(
  _previous: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const viewer = await requireOnboardedViewer("/studio/campanas");
  const limited = await billingLimit(viewer.userId);
  if (limited) return { error: limited };
  const parsed = featureSchema.safeParse({
    productId: formData.get("productId"),
    days: formData.get("days"),
  });
  if (!parsed.success) return { error: FEATURE_MESSAGES.INVALID_DAYS };
  try {
    const result = await featureProduct(viewer.userId, parsed.data.productId, parsed.data.days);
    revalidatePath("/studio/campanas");
    revalidatePath("/studio/saldo");
    revalidatePath("/comprar");
    return {
      ok: `Listo: destacado hasta el ${untilFormat.format(result.until)}. Saldo: ${(result.balanceCents / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`,
    };
  } catch (error) {
    if (error instanceof BillingError) {
      return { error: FEATURE_MESSAGES[error.code] ?? "No se pudo destacar el producto." };
    }
    throw error;
  }
}

/** «Ver cómo me veo» en mis productos: el vendedor la enciende con un tope diario en pesos. */
export async function setSponsorAction(
  _previous: BillingFormState,
  formData: FormData,
): Promise<BillingFormState> {
  const viewer = await requireOnboardedViewer("/studio/saldo");
  const limited = await billingLimit(viewer.userId);
  if (limited) return { error: limited };
  const enabled = formData.get("enabled") === "on";
  const capCents = parsePesosToCents(String(formData.get("dailyCap") ?? "0")) ?? 0;
  if (enabled && capCents < MIN_SPONSOR_DAILY_CAP_CENTS) {
    return {
      error: `El tope diario mínimo es ${(MIN_SPONSOR_DAILY_CAP_CENTS / 100).toLocaleString("es-MX", { style: "currency", currency: "MXN" })}.`,
    };
  }
  try {
    await setSponsorTryOn(viewer.userId, { enabled, dailyCapCents: enabled ? capCents : 0 });
  } catch (error) {
    if (error instanceof BillingError) {
      return {
        error:
          error.code === "NOT_SELLER"
            ? "Activa tu tienda para patrocinar pruebas."
            : "Revisa el tope diario.",
      };
    }
    throw error;
  }
  revalidatePath("/studio/saldo");
  return {
    ok: enabled
      ? "Listo: «Ver cómo me veo» está activo en tus productos."
      : "«Ver cómo me veo» apagado: quedan solo las pruebas de cortesía de tu tienda.",
  };
}
