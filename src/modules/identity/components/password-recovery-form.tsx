"use client";

import Link from "next/link";
import { useActionState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction, type PasswordFormState } from "../password-actions";

export function PasswordRecoveryForm() {
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(
    requestPasswordResetAction,
    {},
  );
  if (state.sent)
    return (
      <div className="flex flex-col gap-4">
        <p role="status" className="rounded-2xl bg-secondary p-4 text-sm leading-relaxed">
          Si hay una cuenta con ese correo, recibirás un enlace para cambiar tu contraseña. Revisa
          también la carpeta de spam. El enlace dura una hora.
        </p>
        <Link
          href="/entrar"
          className="text-center text-sm font-medium text-primary-text hover:underline"
        >
          Volver a entrar
        </Link>
        <Button variant="ghost" onClick={() => window.location.reload()}>
          Usar otro correo
        </Button>
      </div>
    );
  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      <TextField
        name="email"
        label="Correo de tu cuenta"
        type="email"
        autoComplete="email"
        inputMode="email"
        defaultValue={state.email}
        required
        errors={state.fieldErrors?.email}
      />
      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" size="lg" className="h-11" disabled={pending}>
        {pending ? "Solicitando enlace…" : "Enviar enlace de recuperación"}
      </Button>
    </form>
  );
}
