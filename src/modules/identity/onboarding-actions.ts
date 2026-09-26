"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { track } from "@/modules/analytics/track";
import { WELCOME_COOKIE, WELCOME_MAX_AGE_SECONDS } from "@/modules/feed/welcome";
import { onboardingSchema } from "./onboarding-schema";
import { completeOnboarding, OnboardingError } from "./service";
import { requireViewer } from "./session";

export type OnboardingFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

export async function completeOnboardingAction(
  _previous: OnboardingFormState,
  formData: FormData,
): Promise<OnboardingFormState> {
  const viewer = await requireViewer("/bienvenida");
  const parsed = onboardingSchema.fromFormData(formData);
  if (!parsed.success) {
    return {
      error: "Revisa los datos marcados.",
      fieldErrors: z.flattenError(parsed.error).fieldErrors,
    };
  }

  let joinedCommunityIds: string[];
  try {
    ({ joinedCommunityIds } = await completeOnboarding(viewer.userId, parsed.data));
  } catch (error) {
    if (error instanceof OnboardingError) {
      return error.code === "USERNAME_TAKEN"
        ? { fieldErrors: { username: ["Ese nombre de usuario ya está ocupado."] } }
        : { fieldErrors: { communities: ["Elige al menos 3 comunidades."] } };
    }
    throw error;
  }

  track(
    { type: "ONBOARDING_COMPLETED", userId: viewer.userId, surface: "ONBOARDING" },
    ...joinedCommunityIds.map((communityId) => ({
      type: "COMMUNITY_JOIN" as const,
      userId: viewer.userId,
      entityType: "COMMUNITY" as const,
      entityId: communityId,
      surface: "ONBOARDING" as const,
    })),
  );

  // Quien viene a vender entra directo a "¿Qué quieres vender hoy?" (P6).
  if (parsed.data.goals.includes("SELL")) {
    redirect("/studio/vende-con-ia");
  }
  // Sin otro destino (o de vuelta al inicio), el inicio abre con el momento «¡Listo, …!». Si llegó
  // desde un enlace (p. ej. una publicación compartida), regresa a él.
  const next = safeRedirectPath(formData.get("next"), "");
  if (next && next !== "/") redirect(next as Route);
  (await cookies()).set(WELCOME_COOKIE, "1", {
    maxAge: WELCOME_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}
