"use client";

import { useActionState, useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type RightsAdminFormState, rightsAdminAction } from "../actions";
import { RIGHTS_DECISION_NOTE_MAX } from "../schemas";

/**
 * Una acción del equipo sobre un caso en /admin/avisos (retirar, restaurar, mantener, rechazar,
 * retirado por quien avisó, copia enviada). El servidor vuelve a comprobar el rol y la etapa del
 * caso y deja la bitácora; aquí solo se arma el formulario.
 */
export function RightsActionForm({
  action,
  noticeId,
  fields = {},
  label,
  variant = "outline",
  note,
  confirm,
}: {
  action: "remove" | "restore" | "keep_down" | "reject" | "withdraw" | "mark_forwarded";
  noticeId: string;
  fields?: Record<string, string>;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  /** Nota para el expediente; `required` si la acción la exige. */
  note?: { label: string; placeholder?: string; required?: boolean };
  /** Casilla obligatoria antes de enviar (`manualDone`). */
  confirm?: string;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState<RightsAdminFormState, FormData>(
    async (previous, formData) => {
      const result = await rightsAdminAction(previous, formData);
      if (result.ok && result.message) toast.success(result.message);
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="noticeId" value={noticeId} />
      {Object.entries(fields).map(([name, value]) => (
        <input key={name} type="hidden" name={name} value={value} />
      ))}
      {note ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`${id}-nota`} className="text-sm font-medium">
            {note.label}
          </label>
          <Textarea
            id={`${id}-nota`}
            name="note"
            rows={2}
            maxLength={RIGHTS_DECISION_NOTE_MAX}
            required={note.required}
            placeholder={note.placeholder}
          />
        </div>
      ) : null}
      {confirm ? (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="manualDone" required className="size-4 accent-primary" />
          {confirm}
        </label>
      ) : null}
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : null}
      <Button type="submit" variant={variant} className="h-11 self-start px-4" disabled={pending}>
        {pending ? "Guardando…" : label}
      </Button>
    </form>
  );
}
