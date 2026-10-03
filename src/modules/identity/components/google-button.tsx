"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { signInWithGoogleAction } from "../actions";

/** Logotipo de Google en sus cuatro colores (guía de marca «Sign in with Google»). */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" className="size-5">
      <path
        fill="#4285F4"
        d="M23.5 12.3c0-.9-.1-1.7-.2-2.5H12v4.7h6.5c-.3 1.5-1.1 2.8-2.4 3.7v3h3.9c2.3-2.1 3.5-5.2 3.5-8.9Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.2 0 6-1.1 8-2.9l-3.9-3c-1.1.7-2.5 1.2-4.1 1.2-3.1 0-5.8-2.1-6.7-5H1.2v3.1C3.2 21.3 7.3 24 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.3 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3V6.6H1.2C.4 8.2 0 10 0 12s.4 3.8 1.2 5.4l4.1-3.1Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.8c1.8 0 3.3.6 4.6 1.8l3.4-3.4C18 1.2 15.2 0 12 0 7.3 0 3.2 2.7 1.2 6.6l4.1 3.1c.9-2.9 3.6-4.9 6.7-4.9Z"
      />
    </svg>
  );
}

/**
 * «Continuar con Google» (ADR-049): un formulario que llama a la Server Action; el navegador va a
 * Google y vuelve por el callback. Solo se pinta cuando hay credenciales (`googleSignInEnabled`).
 * En el registro, la frase de abajo es el consentimiento por acción; la cuenta nueva pasa además
 * por la bienvenida, donde acepta términos y aviso con una casilla.
 */
export function GoogleButton({ next, intent }: { next?: string; intent: "signin" | "signup" }) {
  return (
    <form action={signInWithGoogleAction} className="flex flex-col gap-2">
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <GoogleSubmit />
      {intent === "signup" ? (
        <p className="text-center text-xs text-muted-foreground">
          Google solo nos da tu nombre y tu correo. Tu perfil y lo que aceptas se completan en el
          siguiente paso.
        </p>
      ) : null}
    </form>
  );
}

function GoogleSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant="outline"
      size="lg"
      className="h-11 text-base font-bold"
      disabled={pending}
    >
      <GoogleMark />
      {pending ? "Conectando con Google…" : "Continuar con Google"}
    </Button>
  );
}
