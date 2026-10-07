"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { PasswordField } from "@/components/forms/password-field";
import { TextField } from "@/components/forms/text-field";
import { Button } from "@/components/ui/button";
import { signUpAction, type AuthFormState } from "../actions";
import { MIN_PASSWORD_LENGTH } from "../schemas";
import { TurnstileField } from "./turnstile-field";

export function SignUpForm({
  next,
  turnstileSiteKey,
  nonce,
}: {
  next?: string;
  turnstileSiteKey?: string;
  nonce?: string;
}) {
  const [verified, setVerified] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [state, formAction, pending] = useActionState<AuthFormState, FormData>(
    async (previous, data) => {
      const result = await signUpAction(previous, data);
      // Cada respuesta vuelve a emitir un token: el anterior puede haberse consumido en Siteverify.
      setVerified(false);
      setAttempt((value) => value + 1);
      return result;
    },
    {},
  );

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

      {/* Solo personas adultas (ADR-076): casilla sin marcar; se guarda con la fecha y la versión. */}
      <div className="flex flex-col gap-1">
        <label className="flex items-start gap-3 text-sm leading-snug">
          <input
            type="checkbox"
            name="confirmAge"
            required
            className="mt-0.5 size-4 shrink-0 accent-primary"
            aria-invalid={state.fieldErrors?.confirmAge ? true : undefined}
          />
          <span>Tengo 18 años o más</span>
        </label>
        {state.fieldErrors?.confirmAge ? (
          <p role="alert" className="text-sm text-destructive">
            {state.fieldErrors.confirmAge[0]}
          </p>
        ) : null}
      </div>

      {turnstileSiteKey ? (
        <TurnstileField
          key={attempt}
          siteKey={turnstileSiteKey}
          nonce={nonce}
          action="signup"
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
        className="h-11 text-base"
        disabled={pending || Boolean(turnstileSiteKey && !verified)}
      >
        {pending ? "Creando tu cuenta…" : "Crear cuenta"}
      </Button>
    </form>
  );
}
