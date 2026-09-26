"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { ImageUploader } from "@/modules/media/components/image-uploader";
import { type ProofFormState, submitProofAction } from "../actions";
import { MAX_PROOF_IMAGES } from "../schemas";

/**
 * Fotos del comprobante de autenticidad (ticket, factura, empaque con número de serie). Se suben
 * como cualquier foto (el servidor quita metadatos) pero NO se adjuntan al producto: quedan
 * privadas, solo para quien vende y para el equipo.
 */
export function ProofForm({
  productId,
  initial = [],
  submitLabel = "Enviar comprobante",
}: {
  productId: string;
  initial?: { id: string; url: string; width: number; height: number }[];
  submitLabel?: string;
}) {
  const [state, formAction, pending] = useActionState<ProofFormState, FormData>(
    submitProofAction,
    {},
  );
  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      <ImageUploader name="proofMediaIds" max={MAX_PROOF_IMAGES} initial={initial} />
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" className="h-11 self-start px-4" disabled={pending}>
        {pending ? "Enviando…" : submitLabel}
      </Button>
    </form>
  );
}
