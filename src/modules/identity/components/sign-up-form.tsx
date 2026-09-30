"use client";

import Link from "next/link";
import { useActionState } from "react";
import { PasswordField } from "@/components/forms/password-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { signUpAction, type AuthFormState } from "../actions";
import { MIN_PASSWORD_LENGTH } from "../schemas";

export function SignUpForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signUpAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <TextField
        label="Nombre"
        name="name"
        autoComplete="name"
        required
        defaultValue={state.values?.name}
        errors={state.fieldErrors?.name}
      />
      <TextField
        label="Correo"
        name="email"
        type="email"
        autoComplete="email"
        inputMode="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <PasswordField
        label="Contraseña"
        name="password"
        autoComplete="new-password"
        required
        minLength={MIN_PASSWORD_LENGTH}
        description={`Al menos ${MIN_PASSWORD_LENGTH} caracteres. Una frase fácil de recordar funciona muy bien.`}
        errors={state.fieldErrors?.password}
      />

      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm leading-snug">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
            aria-invalid={state.fieldErrors?.acceptTerms ? true : undefined}
          />
          <span>
            Acepto los{" "}
            <Link
              href="/terminos"
              className="font-medium underline underline-offset-2"
              target="_blank"
            >
              términos
            </Link>{" "}
            y el{" "}
            <Link
              href="/privacidad"
              className="font-medium underline underline-offset-2"
              target="_blank"
            >
              aviso de privacidad
            </Link>
            .{" "}
            <Link
              href="/seguridad"
              className="font-medium underline underline-offset-2"
              target="_blank"
            >
              Cómo cuidamos tus datos
            </Link>
          </span>
        </label>
        {state.fieldErrors?.acceptTerms ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.acceptTerms[0]}
          </p>
        ) : null}
      </div>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? "Creando tu cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
