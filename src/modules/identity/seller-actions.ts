"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PaymentMethod } from "@/generated/prisma/enums";
import { db } from "@/server/db";
import { isPlatformImpersonation } from "./reserved-names";
import { RESERVED_NAME_MESSAGE } from "./schemas";
import { requireOnboardedViewer } from "./session";

const sellerSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(2, "Escribe el nombre de tu tienda.")
    .max(60, { abort: true })
    // Una tienda tampoco puede llamarse «speeaking Oficial» o «Soporte» (SEC-18).
    .refine((value) => !isPlatformImpersonation(value), RESERVED_NAME_MESSAGE),
  city: z.string().trim().min(2, "Escribe tu ciudad.").max(60),
  state: z.string().trim().min(2, "Escribe tu estado.").max(60),
  paymentMethods: z.array(z.enum(PaymentMethod)).min(1, "Elige al menos un método de pago."),
});

export type SellerFormState = { error?: string; fieldErrors?: Partial<Record<string, string[]>> };

/** P6: vender se activa en el momento, sin haber elegido "tipo de cuenta" al registrarse. */
export async function activateSellerAction(
  _previous: SellerFormState,
  formData: FormData,
): Promise<SellerFormState> {
  const viewer = await requireOnboardedViewer("/studio");
  const parsed = sellerSchema.safeParse({
    displayName: formData.get("displayName"),
    city: formData.get("city"),
    state: formData.get("state"),
    paymentMethods: formData.getAll("paymentMethods"),
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  await db.sellerProfile.upsert({
    where: { userId: viewer.userId },
    create: {
      userId: viewer.userId,
      displayName: parsed.data.displayName,
      city: parsed.data.city,
      state: parsed.data.state,
      acceptedPaymentMethods: parsed.data.paymentMethods,
    },
    update: {},
  });
  revalidatePath("/studio", "layout");
  return {};
}
