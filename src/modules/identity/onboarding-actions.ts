"use server";

import type { Route } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { track } from "@/modules/analytics/track";
import { WELCOME_COOKIE, WELCOME_MAX_AGE_SECONDS } from "@/modules/feed/welcome";
import { onboardingSchema } from "./onboarding-schema";
import { ADULT_REQUIRED_MESSAGE, adultDeclaration } from "./schemas";
import { completeOnboarding, hasLegalConsents, OnboardingError } from "./service";
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

  // Con Google no hubo casillas en el registro (ADR-049): la bienvenida exige aceptar términos y
  // aviso y declarar 18 años o más (ADR-076).
  const legalConsent = !(await hasLegalConsents(viewer.userId));
  if (legalConsent) {
    const fieldErrors: Partial<Record<string, string[]>> = {};
    if (formData.get("acceptLegal") !== "on") {
      fieldErrors.acceptLegal = ["Acepta los términos y el aviso de privacidad para continuar."];
    }
    if (!adultDeclaration.safeParse(formData.get("confirmAge")).success) {
      fieldErrors.confirmAge = [ADULT_REQUIRED_MESSAGE];
    }
    if (Object.keys(fieldErrors).length > 0) {
      return { error: "Revisa los datos marcados.", fieldErrors };
    }
  }

  let joinedCommunityIds: string[];
  try {
    ({ joinedCommunityIds } = await completeOnboarding(viewer.userId, parsed.data, {
      legalConsent,
    }));
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

  // Quien viene a vender entra directo a «¿Qué quieres vender hoy?» (P6, ADR-022).
  if (parsed.data.goals.includes("SELL")) redirect("/studio/sube-y-vende");
  // Quien llegó desde un enlace (una publicación compartida, una comunidad) regresa a él (P1:
  // compartir afuera, descubrir adentro). Solo rutas del sitio (SEC-04).
  const next = safeRedirectPath(formData.get("next"), "");
  if (next && next !== "/") redirect(next as Route);
  // Sin otro destino, el feed abre con el momento «¡Listo, …!».
  (await cookies()).set(WELCOME_COOKIE, "1", {
    maxAge: WELCOME_MAX_AGE_SECONDS,
    path: "/",
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
  });
  redirect("/");
}
