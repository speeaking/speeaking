"use client";

import { useActionState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type DiscardProposalState, discardAiRoutingProposalAction } from "../admin-actions";

/**
 * La acción, y al descartar un aviso que sobrevive a la recarga: con `revalidatePath` la propuesta
 * sale de la lista en la misma respuesta y este formulario se desmonta antes de mostrar `state.ok`.
 */
async function discardAndNotify(previous: DiscardProposalState, formData: FormData) {
  const next = await discardAiRoutingProposalAction(previous, formData);
  if (next.ok) toast.success(next.ok);
  return next;
}

/**
 * Descartar una propuesta de la IA para cambiar el modelo (/admin/ia). El motivo es obligatorio y
 * queda en la bitácora; la ruta no cambia. Para aplicarla se elige ese modelo en «Modelo por tarea».
 */
export function ProposalDiscardForm({ proposalId }: { proposalId: string }) {
  const [state, formAction, pending] = useActionState<DiscardProposalState, FormData>(
    discardAndNotify,
    {},
  );
  const fieldId = `descartar-${proposalId}`;
  const errorId = `${fieldId}-error`;
  const reasonErrors = state.fieldErrors?.reason;

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="decisionId" value={proposalId} />
      <label htmlFor={fieldId} className="text-sm font-medium">
        Motivo para descartar
      </label>
      <Textarea
        id={fieldId}
        name="reason"
        rows={2}
        maxLength={300}
        placeholder="Por ejemplo: ya no aplica, el modelo cambió por otra razón."
        aria-invalid={reasonErrors ? true : undefined}
        aria-describedby={reasonErrors ? errorId : undefined}
        className="text-base"
      />
      {reasonErrors?.length ? (
        <p id={errorId} role="alert" className="text-sm text-destructive">
          {reasonErrors[0]}
        </p>
      ) : null}
      {state.error ? (
        <p role="alert" className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button
        type="submit"
        variant="outline"
        size="lg"
        className="h-11 self-start px-4"
        disabled={pending}
      >
        {pending ? "Descartando…" : "Descartar propuesta"}
      </Button>
    </form>
  );
}
