"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordField } from "@/components/forms/password-field";
import { Button } from "@/components/ui/button";
import { resetPasswordAction, type PasswordFormState } from "../password-actions";
import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from "../schemas";

export function PasswordResetForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(
    resetPasswordAction,
    {},
  );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <input type="hidden" name="token" value={token} />
      <PasswordField
        name="password"
        label="Nueva contraseña"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        maxLength={MAX_PASSWORD_LENGTH}
        description={`Al menos ${MIN_PASSWORD_LENGTH} caracteres. Usa una frase que solo tú conozcas.`}
        errors={state.fieldErrors?.password}
      />
      <PasswordField
        name="confirmPassword"
        label="Repite la contraseña"
        autoComplete="new-password"
        required
        maxLength={MAX_PASSWORD_LENGTH}
        errors={state.fieldErrors?.confirmPassword}
      />
      {state.error || state.fieldErrors?.token ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error ?? state.fieldErrors?.token?.[0]}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "Guardando contraseña…" : "Guardar nueva contraseña"}
      </Button>
      <Link
        href="/recuperar-contrasena"
        className="text-center text-sm text-primary-text hover:underline"
      >
        Solicitar otro enlace
      </Link>
    </form>
  );
}
