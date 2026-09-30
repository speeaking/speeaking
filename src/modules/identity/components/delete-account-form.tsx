"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { type DeleteAccountState, deleteAccountAction } from "../account-actions";

/** «Eliminar mi cuenta»: casilla de confirmación y botón destructivo (ADR-048). */
export function DeleteAccountForm() {
  const [state, formAction, pending] = useActionState<DeleteAccountState, FormData>(
    deleteAccountAction,
    {},
  );
  const [confirmed, setConfirmed] = useState(false);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="confirm"
          checked={confirmed}
          onChange={(event) => setConfirmed(event.target.checked)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          Entiendo que se borra todo y no se puede deshacer: mi perfil, mis publicaciones, mis
          productos, mis fotos, mis mensajes y mi saldo. Si tengo pedidos, se conservan sin mis
          datos.
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="destructive"
        disabled={!confirmed || pending}
        className="self-start"
      >
        {pending ? "Eliminando…" : "Eliminar mi cuenta"}
      </Button>
    </form>
  );
}
