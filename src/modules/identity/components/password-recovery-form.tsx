"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { requestPasswordResetAction, type PasswordFormState } from "../password-actions";
import { TurnstileField } from "./turnstile-field";

export function PasswordRecoveryForm({
  turnstileSiteKey,
  nonce,
}: {
  turnstileSiteKey?: string;
  nonce?: string;
}) {
  const [verified, setVerified] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, action, pending] = useActionState<PasswordFormState, FormData>(
    async (previous, data) => {
      const result = await requestPasswordResetAction(previous, data);
      setVerified(false);
      setAttempt((value) => value + 1);
      return result;
    },
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
      {turnstileSiteKey ? (
        <TurnstileField
          key={attempt}
          siteKey={turnstileSiteKey}
          nonce={nonce}
          action="password-recovery"
          onVerifiedChange={setVerified}
        />
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        size="lg"
        className="h-11"
        disabled={pending || Boolean(turnstileSiteKey && !verified)}
      >
        {pending ? "Solicitando enlace…" : "Enviar enlace de recuperación"}
      </Button>
    </form>
  );
}
