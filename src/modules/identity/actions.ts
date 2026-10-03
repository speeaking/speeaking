"use server";

import { isAPIError } from "better-auth/api";
import type { Route } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { track } from "@/modules/analytics/track";
import { auth } from "@/server/auth";
import { clientIp, withClientIpHeader } from "@/server/client-ip";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { forgiveSignIn, limitSignIn, limitSignUp } from "./auth-limits";
import { authErrorMessage } from "./auth-errors";
import { LEGAL_VERSIONS } from "./constants";
import { signInSchema, signUpSchema } from "./schemas";
import { requireViewer } from "./session";
import { googleSignInEnabled } from "./social";

export type AuthFormState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  values?: { name?: string; email?: string };
};

/** Códigos de Better Auth cuando el correo ya tiene cuenta. */
const EXISTING_ACCOUNT_CODES = new Set([
  "USER_ALREADY_EXISTS",
  "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL",
]);

function formValues(formData: FormData) {
  return {
    name: String(formData.get("name") ?? ""),
    email: String(formData.get("email") ?? ""),
  };
}

function errorCode(error: unknown) {
  return isAPIError(error) && typeof error.body?.code === "string" ? error.body.code : undefined;
}

function apiErrorState(error: unknown, values: AuthFormState["values"]): AuthFormState {
  if (isAPIError(error)) {
    return {
      error: authErrorMessage({ code: errorCode(error), status: error.statusCode }),
      values,
    };
  }
  throw error;
}

export async function signUpAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = formValues(formData);
  const parsed = signUpSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const requestHeaders = await headers();
  const limit = await limitSignUp(requestHeaders, parsed.data.email);
  if (limit.error) return { error: limit.error, values };

  let userId: string;
  try {
    const result = await auth.api.signUpEmail({
      body: { name: parsed.data.name, email: parsed.data.email, password: parsed.data.password },
      // La IP de la sesión sale de la política de proxies de confianza (SEC-07).
      headers: withClientIpHeader(requestHeaders),
    });
    userId = result.user.id;
  } catch (error) {
    // SEC-11: con un correo ya registrado Better Auth responde sin calcular el hash de la contraseña,
    // así que respondería más rápido. Se calcula aquí con el mismo algoritmo para igualar el tiempo.
    if (EXISTING_ACCOUNT_CODES.has(errorCode(error) ?? "")) {
      await (await auth.$context).password.hash(parsed.data.password);
    }
    return apiErrorState(error, values);
  }

  // Consentimiento versionado: términos y aviso de privacidad aceptados al registrarse.
  await db.userConsent.createMany({
    data: [
      { userId, type: "TERMS", version: LEGAL_VERSIONS.terms, granted: true },
      { userId, type: "PRIVACY_NOTICE", version: LEGAL_VERSIONS.privacyNotice, granted: true },
    ],
  });
  track({ type: "SIGN_UP", userId, surface: "ONBOARDING" });

  const next = safeRedirectPath(formData.get("next"), "");
  redirect((next ? `/bienvenida?next=${encodeURIComponent(next)}` : "/bienvenida") as Route);
}

export async function signInAction(
  _previous: AuthFormState,
  formData: FormData,
): Promise<AuthFormState> {
  const values = formValues(formData);
  const parsed = signInSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { fieldErrors: z.flattenError(parsed.error).fieldErrors, values };
  }

  const requestHeaders = await headers();
  const limit = await limitSignIn(requestHeaders, parsed.data.email);
  if (limit.error) return { error: limit.error, values };

  try {
    await auth.api.signInEmail({ body: parsed.data, headers: withClientIpHeader(requestHeaders) });
  } catch (error) {
    return apiErrorState(error, values);
  }
  await forgiveSignIn(limit.keys);

  redirect(safeRedirectPath(formData.get("next")) as Route);
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/");
}

/**
 * «Cerrar sesión en todos los dispositivos» (SEC-10): borra todas las sesiones de la cuenta,
 * incluida esta, y manda a iniciar sesión de nuevo.
 */
export async function signOutEverywhereAction() {
  await requireViewer("/ajustes");
  const requestHeaders = await headers();
  await auth.api.revokeSessions({ headers: requestHeaders });
  // La sesión actual ya no existe; esto solo borra la cookie del navegador.
  await auth.api.signOut({ headers: requestHeaders });
  redirect("/entrar");
}

/**
 * «Continuar con Google» (ADR-049): pide a Better Auth la URL de autorización y manda ahí. Al
 * volver, Google entra por `/api/auth/callback/google`; una cuenta nueva cae en la bienvenida (donde
 * acepta términos y aviso) y una existente regresa a `next`. Sin credenciales configuradas, la
 * acción no existe para la interfaz (el botón no se pinta) y aquí responde 404.
 */
export async function signInWithGoogleAction(formData: FormData): Promise<void> {
  if (!googleSignInEnabled()) redirect("/entrar?error=google" as Route);
  const requestHeaders = await headers();
  const ip = clientIp(requestHeaders);
  const key = rateLimitKey("auth.google", "ip", ip);
  if (key) {
    const limited = limitOrError(await rateLimit({ key, limit: 20, windowSeconds: 10 * 60 }));
    if (limited) redirect("/entrar?error=google" as Route);
  }
  const next = safeRedirectPath(formData.get("next"), "/");
  let url: string | undefined;
  try {
    const result = await auth.api.signInSocial({
      body: {
        provider: "google",
        callbackURL: new URL(next, env.APP_URL).href,
        newUserCallbackURL: new URL(`/bienvenida?next=${encodeURIComponent(next)}`, env.APP_URL)
          .href,
        errorCallbackURL: new URL(`/entrar?next=${encodeURIComponent(next)}`, env.APP_URL).href,
        disableRedirect: true,
      },
      headers: withClientIpHeader(requestHeaders),
    });
    url = result?.url ?? undefined;
  } catch (error) {
    console.error("[identity] no se pudo iniciar el flujo de Google", {
      code: errorCode(error) ?? "GOOGLE_START_FAILED",
    });
  }
  redirect((url ?? "/entrar?error=google") as Route);
}
