"use client";

import { useActionState, useId } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { type ModerationFormState, moderationAction } from "../actions";
import { MODERATION_NOTE_MAX } from "../schemas";

/**
 * Una acción del equipo en /admin/moderacion (verificar, rechazar, ocultar, restaurar, descartar).
 * El servidor vuelve a comprobar el rol y deja la bitácora; aquí solo se arma el formulario.
 */
export function ModerationActionForm({
  action,
  fields,
  label,
  variant = "outline",
  note,
  confirm,
}: {
  action: "verify" | "reject" | "hide" | "restore" | "dismiss";
  fields: Record<string, string>;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
  /** Nota opcional (para el vendedor al verificar o rechazar; interna en lo demás). */
  note?: { label: string; placeholder?: string };
  /** Casilla obligatoria antes de enviar (p. ej. «Revisé el comprobante»). */
  confirm?: string;
}) {
  const id = useId();
  const [state, formAction, pending] = useActionState<ModerationFormState, FormData>(
    async (previous, formData) => {
      const result = await moderationAction(previous, formData);
      if (result.ok && result.message) toast.success(result.message);
      return result;
    },
    {},
  );

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="action" value={action} />
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
            maxLength={MODERATION_NOTE_MAX}
            placeholder={note.placeholder}
          />
        </div>
      ) : null}
      {confirm ? (
        <label className="flex min-h-11 items-center gap-2 text-sm">
          <input type="checkbox" name="confirmed" required className="size-4 accent-primary" />
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
