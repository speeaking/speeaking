"use server";

import { isAPIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/server/auth";
import { withClientIpHeader } from "@/server/client-ip";
import { env } from "@/server/env";
import { passwordRecoveryEnabled } from "@/server/providers/email";
import { limitPasswordRecovery, limitPasswordReset } from "./auth-limits";
import { passwordRecoverySchema, passwordResetSchema } from "./schemas";
import { verifyTurnstile } from "./turnstile";

export type PasswordFormState = {
  error?: string;
  sent?: boolean;
  fieldErrors?: Partial<Record<string, string[]>>;
  email?: string;
};

export async function requestPasswordResetAction(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const email = String(formData.get("email") ?? "");
  const parsed = passwordRecoverySchema.safeParse({ email });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors, email };
  if (!passwordRecoveryEnabled())
    return {
      error: "La recuperación por correo aún no está disponible. Intenta más tarde.",
      email,
    };
  const requestHeaders = await headers();
  const limit = await limitPasswordRecovery(requestHeaders, parsed.data.email);
  if (limit.error) return { error: limit.error, email };
  const verificationError = await verifyTurnstile(formData, requestHeaders, "password-recovery");
  if (verificationError) return { error: verificationError, email };
  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: new URL("/restablecer-contrasena", env.APP_URL).href,
      },
      headers: withClientIpHeader(requestHeaders),
    });
  } catch {
    console.error("[identity] no se pudo solicitar la recuperación de contraseña");
    return { error: "No pudimos procesar la solicitud. Intenta más tarde.", email };
  }
  // Mismo mensaje exista o no la cuenta: no sirve para buscar correos registrados.
  return { sent: true, email: parsed.data.email };
}

export async function resetPasswordAction(
  _previous: PasswordFormState,
  formData: FormData,
): Promise<PasswordFormState> {
  const parsed = passwordResetSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };
  if (!passwordRecoveryEnabled())
    return { error: "La recuperación por correo aún no está disponible. Intenta más tarde." };
  const requestHeaders = await headers();
  const limit = await limitPasswordReset(requestHeaders, parsed.data.token);
  if (limit.error) return { error: limit.error };
  try {
    await auth.api.resetPassword({
      body: { token: parsed.data.token, newPassword: parsed.data.password },
      headers: withClientIpHeader(requestHeaders),
    });
  } catch (error) {
    if (isAPIError(error) && error.body?.code === "INVALID_TOKEN")
      return { error: "Este enlace ya se usó o caducó. Solicita uno nuevo." };
    console.error("[identity] no se pudo restablecer la contraseña");
    return {
      error: "No pudimos cambiar la contraseña. Solicita un nuevo enlace e intenta otra vez.",
    };
  }
  redirect("/entrar?password=actualizada");
}
