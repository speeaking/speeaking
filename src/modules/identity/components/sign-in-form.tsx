"use client";

import { useActionState } from "react";
import type { Route } from "next";
import Link from "next/link";
import { PasswordField } from "@/components/forms/password-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { signInAction, type AuthFormState } from "../actions";

export function SignInForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(signInAction, {});

  return (
    <form action={formAction} className="flex flex-col gap-4" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
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
        autoComplete="current-password"
        required
        errors={state.fieldErrors?.password}
      />
      <Link
        href={
          (next
            ? `/recuperar-contrasena?next=${encodeURIComponent(next)}`
            : "/recuperar-contrasena") as Route
        }
        className="-mt-1 self-end text-sm font-medium text-primary-text underline-offset-4 hover:underline"
      >
        ¿Olvidaste tu contraseña?
      </Link>

      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}

      <Button type="submit" size="lg" className="h-11 text-base" disabled={pending}>
        {pending ? "Entrando…" : "Entrar"}
      </Button>
    </form>
  );
}
