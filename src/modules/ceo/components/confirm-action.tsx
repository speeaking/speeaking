"use client";

import { type ReactNode, useActionState, useId, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import type { CeoFormState } from "../actions";

type ServerAction = (state: CeoFormState, formData: FormData) => Promise<CeoFormState>;

/**
 * Botón con confirmación para las acciones del equipo (aprobar, rechazar, revertir, iniciar o detener
 * un experimento, cambiar la autonomía). Nada se ejecuta sin confirmar en el diálogo. El resultado se
 * anuncia con un aviso; los errores se quedan en el diálogo.
 */
export function ConfirmAction({
  action,
  fields,
  triggerLabel,
  triggerVariant = "outline",
  title,
  description,
  confirmLabel,
  confirmVariant = "default",
  withNote = false,
  children,
}: {
  action: ServerAction;
  fields: Record<string, string>;
  triggerLabel: string;
  triggerVariant?: "default" | "outline" | "secondary" | "destructive" | "ghost";
  title: string;
  description: string;
  confirmLabel: string;
  confirmVariant?: "default" | "destructive";
  withNote?: boolean;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const noteId = useId();
  const [state, formAction, pending] = useActionState(
    async (previous: CeoFormState, formData: FormData) => {
      const result = await action(previous, formData);
      if (result.ok) {
        setOpen(false);
        toast.success(result.message ?? "Listo.");
      }
      return result;
    },
    {},
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger
        render={<Button type="button" variant={triggerVariant} className="h-9 px-3" />}
      >
        {triggerLabel}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form action={formAction} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
            <DialogDescription>{description}</DialogDescription>
          </DialogHeader>
          {children}
          {Object.entries(fields).map(([name, value]) => (
            <input key={name} type="hidden" name={name} value={value} />
          ))}
          {withNote ? (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={noteId} className="text-sm font-medium">
                Nota para la bitácora (opcional)
              </label>
              <Textarea id={noteId} name="note" maxLength={300} rows={2} />
            </div>
          ) : null}
          {state.error ? (
            <p
              role="alert"
              className="rounded-xl bg-destructive/10 px-3 py-2 text-sm text-destructive"
            >
              {state.error}
            </p>
          ) : null}
          <DialogFooter>
            <DialogClose render={<Button type="button" variant="outline" className="h-9" />}>
              Cancelar
            </DialogClose>
            <Button type="submit" variant={confirmVariant} className="h-9" disabled={pending}>
              {pending ? "Procesando…" : confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
