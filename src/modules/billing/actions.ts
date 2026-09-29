"use server";

import { revalidatePath } from "next/cache";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { parsePesosToCents } from "@/modules/catalog/pricing";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { MIN_SPONSOR_DAILY_CAP_CENTS } from "./pricing";
import { BillingError, setSponsorTryOn, topUpSimulated } from "./service";

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
  const viewer = await requireOnboardedViewer("/saldo");
  const limited = await billingLimit(viewer.userId);
  if (limited) return { error: limited };
  const packId = String(formData.get("packId") ?? "");
  try {
    const result = await topUpSimulated(viewer.userId, packId);
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

/** «Pruebas gratis en mis productos»: el vendedor la enciende con un tope diario en pesos. */
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
  return { ok: enabled ? "Listo: tus productos tienen pruebas gratis." : "Patrocinio apagado." };
}
