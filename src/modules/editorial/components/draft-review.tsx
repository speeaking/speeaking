"use client";

import { useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { MAX_POST_LENGTH } from "@/modules/social/schemas";
import { type DeskFormState, discardDraftAction, publishDraftAction } from "../actions";

/**
 * Revisar un borrador de la redacción (ADR-066): el texto se puede ajustar antes de publicarlo.
 * «Publicar» es la única acción primaria; «Descartar» va discreto. El servidor vuelve a comprobar el
 * rol y que el borrador siga pendiente.
 */
export function DraftReview({ draftId, body }: { draftId: string; body: string }) {
  const id = useId();
  // Controlado: si publicar falla, lo que se editó no se pierde al reiniciarse el formulario.
  const [text, setText] = useState(body);
  const [published, publish, publishing] = useActionState<DeskFormState, FormData>(
    async (previous, formData) => {
      const result = await publishDraftAction(previous, formData);
      if (result.ok) toast.success(result.ok);
      return result;
    },
    {},
  );
  const [discarded, discard, discarding] = useActionState<DeskFormState, FormData>(
    async (previous, formData) => {
      const result = await discardDraftAction(previous, formData);
      if (result.ok) toast.success(result.ok);
      return result;
    },
    {},
  );
  const busy = publishing || discarding;
  const error = published.error ?? discarded.error;

  return (
    <div className="flex flex-col gap-2">
      <form id={`${id}-publicar`} action={publish} className="flex flex-col gap-1.5">
        <input type="hidden" name="draftId" value={draftId} />
        <label htmlFor={`${id}-texto`} className="sr-only">
          Texto de la publicación
        </label>
        <Textarea
          id={`${id}-texto`}
          name="body"
          value={text}
          onChange={(event) => setText(event.target.value)}
          rows={4}
          maxLength={MAX_POST_LENGTH}
          required
        />
      </form>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" form={`${id}-publicar`} className="h-11 px-5" disabled={busy}>
          {publishing ? "Publicando…" : "Publicar"}
        </Button>
        <form action={discard}>
          <input type="hidden" name="draftId" value={draftId} />
          <Button type="submit" variant="ghost" className="h-11 px-4" disabled={busy}>
            {discarding ? "Descartando…" : "Descartar"}
          </Button>
        </form>
      </div>
    </div>
  );
}
