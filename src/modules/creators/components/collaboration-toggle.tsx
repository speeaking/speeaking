"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { type CollaborationState, setCollaborationsAction } from "../actions";

/**
 * «Aceptar colaboraciones» (ADR-063): la tienda decide si otras personas pueden etiquetar sus
 * productos en fotos y videos. Apagado por omisión.
 */
export function CollaborationToggle({ enabled }: { enabled: boolean }) {
  const [state, formAction, pending] = useActionState<CollaborationState, FormData>(
    setCollaborationsAction,
    {},
  );
  const [on, setOn] = useState(enabled);
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label className="flex items-start gap-2 text-sm">
        <input
          type="checkbox"
          name="enabled"
          checked={on}
          onChange={(event) => setOn(event.target.checked)}
          className="mt-0.5 size-4 shrink-0"
        />
        <span>
          <span className="font-semibold">Aceptar colaboraciones.</span> Otras personas pueden
          etiquetar tus productos en sus fotos y videos. Quien los ve puede probárselos y comprarlos
          desde ahí, y tú ves qué logró cada publicación.
        </span>
      </label>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p role="status" className="text-sm text-success">
          {state.ok}
        </p>
      ) : null}
      <Button type="submit" variant="outline" disabled={pending} className="self-start">
        Guardar
      </Button>
    </form>
  );
}
