"use client";

import { Flag } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { type ReactNode, useActionState, useState } from "react";
import { toast } from "sonner";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { type ReportFormState, reportAction } from "../actions";
import { REPORT_REASON_LABELS, REPORT_REASONS } from "../labels";
import { REPORT_DETAILS_MAX, type ReportableTarget } from "../schemas";

const TARGET_NOUNS: Record<ReportableTarget, string> = {
  PRODUCT: "este producto",
  POST: "esta publicación",
  USER: "a esta persona",
};

/**
 * El diálogo para reportar, controlado desde afuera: lo abre su botón (`ReportButton`) o una opción
 * de un menú (la conversación, ADR-069). `children` va dentro del diálogo (p. ej. su disparador).
 */
export function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  onSent,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: ReportableTarget;
  targetId: string;
  onSent?: () => void;
  children?: ReactNode;
}) {
  const [state, formAction, pending] = useActionState<ReportFormState, FormData>(
    async (previous, formData) => {
      const result = await reportAction(previous, formData);
      if (result.ok) {
        onSent?.();
        onOpenChange(false);
        toast.success(result.message);
      }
      return result;
    },
    {},
  );
  const noun = TARGET_NOUNS[targetType];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Reportar {noun}</DialogTitle>
          <DialogDescription>
            Lo revisa el equipo. Quien lo publicó no sabrá quién lo reportó.
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-4">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">¿Qué pasa?</legend>
            {REPORT_REASONS.map((reason) => (
              <label
                key={reason}
                className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-[15px] hover:bg-muted"
              >
                <input
                  type="radio"
                  name="reason"
                  value={reason}
                  required
                  className="size-4 accent-primary"
                />
                {REPORT_REASON_LABELS[reason]}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2">
            <label htmlFor={`reporte-${targetId}`} className="text-sm font-medium">
              Detalles (opcional)
            </label>
            <Textarea
              id={`reporte-${targetId}`}
              name="details"
              rows={3}
              maxLength={REPORT_DETAILS_MAX}
              placeholder="Cuéntanos qué viste. No incluyas datos personales."
            />
          </div>
          {state.error ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" className="h-11 px-4" disabled={pending}>
              {pending ? "Enviando…" : "Enviar reporte"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * «Reportar» un producto o una publicación. El reporte es anónimo para quien publicó y llega a la
 * cola del equipo. Sin sesión, lleva a iniciar sesión y regresa aquí.
 */
export function ReportButton({
  targetType,
  targetId,
  isSignedIn,
  returnTo,
  className,
}: {
  targetType: ReportableTarget;
  targetId: string;
  isSignedIn: boolean;
  /** Ruta a la que se regresa después de iniciar sesión. */
  returnTo: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const triggerClass = cn(
    buttonVariants({ variant: "ghost" }),
    "h-11 px-3 text-muted-foreground",
    className,
  );

  if (!isSignedIn) {
    return (
      <Link href={`/entrar?next=${encodeURIComponent(returnTo)}` as Route} className={triggerClass}>
        <Flag data-icon="inline-start" />
        Reportar
      </Link>
    );
  }

  if (sent) {
    return (
      <span className={cn(triggerClass, "pointer-events-none")} aria-live="polite">
        <Flag data-icon="inline-start" />
        Reportado
      </span>
    );
  }

  return (
    <ReportDialog
      open={open}
      onOpenChange={setOpen}
      targetType={targetType}
      targetId={targetId}
      onSent={() => setSent(true)}
    >
      <DialogTrigger render={<Button type="button" variant="ghost" className={triggerClass} />}>
        <Flag data-icon="inline-start" />
        Reportar
      </DialogTrigger>
    </ReportDialog>
  );
}
