"use client";

import { Flag } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { type FormEvent, type ReactNode, startTransition, useActionState, useState } from "react";
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
import { siteConfig } from "@/config/site";
import type { ReportReason } from "@/generated/prisma/enums";
import { cn } from "@/lib/utils";
import { type ReportFormState, reportAction } from "../actions";
import { isUrgentReportReason, REPORT_REASON_LABELS, reportReasonsFor } from "../labels";
import { REPORT_DETAILS_MAX, type ReportableTarget } from "../schemas";

const TARGET_NOUNS: Record<ReportableTarget, string> = {
  PRODUCT: "este producto",
  POST: "esta publicación",
  USER: "a esta persona",
  COMMENT: "este comentario",
};

/**
 * Opción del diálogo que NO crea un reporte: un aviso de derechos de autor o de marca es el aviso
 * formal de /derechos-de-autor (LFDA art. 114 Octies), que no es anónimo.
 */
const RIGHTS_CHOICE = "RIGHTS";
const RIGHTS_LABEL = "Infringe mis derechos de autor o mi marca";
type Choice = ReportReason | typeof RIGHTS_CHOICE;

/**
 * Enlace al aviso formal con la dirección pública de lo reportado (`?url=`): una publicación por la
 * suya; un producto, por su página. Una persona solo desde su perfil: la dirección de un hilo de
 * mensajes es privada. Un comentario no tiene dirección propia: la de su publicación apuntaría el
 * aviso (y los datos de quien avisa) a quien la publicó, así que quien avisa lo describe.
 */
function rightsNoticeHref(targetType: ReportableTarget, targetId: string, pathname: string | null) {
  const path =
    targetType === "POST"
      ? `/p/${targetId}`
      : (targetType === "PRODUCT" && pathname?.startsWith("/producto/")) ||
          (targetType === "USER" && pathname?.startsWith("/u/"))
        ? pathname
        : null;
  const query = path ? `?url=${encodeURIComponent(new URL(path, siteConfig.url).href)}` : "";
  return `/derechos-de-autor${query}#aviso`;
}

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
  const pathname = usePathname();
  // Controlado: el diálogo desmonta su contenido al cerrarse, y al volver a abrirlo no debe seguir
  // el aviso de una opción que ya no está marcada.
  const [choice, setChoice] = useState<Choice | null>(null);
  const changeOpen = (next: boolean) => {
    if (!next) setChoice(null);
    onOpenChange(next);
  };
  const [state, formAction, pending] = useActionState<ReportFormState, FormData>(
    async (previous, formData) => {
      const result = await reportAction(previous, formData);
      if (result.ok) {
        onSent?.();
        changeOpen(false);
        toast.success(result.message);
      }
      return result;
    },
    {},
  );
  const noun = TARGET_NOUNS[targetType];
  const reasons = reportReasonsFor(targetType);
  // «Otro motivo» siempre al final, después del aviso de derechos.
  const choices: Choice[] = [
    ...reasons.filter((reason) => reason !== "OTHER"),
    RIGHTS_CHOICE,
    ...reasons.filter((reason) => reason === "OTHER"),
  ];
  const rights = choice === RIGHTS_CHOICE;
  const urgent = choice !== null && choice !== RIGHTS_CHOICE && isUrgentReportReason(choice);

  // Se envía desde aquí y no con la acción del formulario: React reinicia los campos al terminar una
  // acción, y un error (p. ej. el límite de reportes) dejaría el motivo sin marcar con su aviso a la
  // vista y borraría los detalles. El aviso de derechos no se envía: es un enlace.
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (rights) return;
    const data = new FormData(event.currentTarget);
    startTransition(() => formAction(data));
  };

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      {children}
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">Reportar {noun}</DialogTitle>
          <DialogDescription>
            {rights
              ? "Los derechos de autor y de marca se reclaman con un aviso formal."
              : "Lo revisa el equipo. Quien lo publicó no sabrá quién lo reportó."}
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} onSubmit={submit} className="flex flex-col gap-4">
          <input type="hidden" name="targetType" value={targetType} />
          <input type="hidden" name="targetId" value={targetId} />
          <fieldset className="flex flex-col gap-1">
            <legend className="mb-1 text-sm font-medium">¿Qué pasa?</legend>
            {choices.map((value) => (
              <label
                key={value}
                className="flex min-h-11 items-center gap-3 rounded-lg px-2 text-[15px] hover:bg-muted"
              >
                <input
                  type="radio"
                  name="reason"
                  value={value}
                  required
                  checked={choice === value}
                  onChange={() => setChoice(value)}
                  className="size-4 accent-primary"
                />
                {value === RIGHTS_CHOICE ? RIGHTS_LABEL : REPORT_REASON_LABELS[value]}
              </label>
            ))}
            {/* Siempre presente para que el lector de pantalla anuncie el aviso al aparecer. */}
            <div aria-live="polite">
              {urgent ? (
                <div className="mt-2 flex flex-col gap-1 rounded-2xl bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  <p className="font-semibold">
                    Si alguien está en peligro inmediato, llama al 911.
                  </p>
                  <p>Lo revisamos con prioridad. No lo descargues ni lo compartas.</p>
                </div>
              ) : null}
            </div>
          </fieldset>
          {rights ? (
            <div className="flex flex-col gap-2 rounded-2xl bg-muted px-3 py-3 text-sm">
              <p>
                Los avisos por derechos de autor o de marca no son anónimos: quien publicó recibe tu
                nombre, tu correo y la descripción de tu aviso, y puede responder con un
                contra-aviso.
              </p>
              <p>
                Llena el aviso formal; ahí te explicamos qué pasa después. Es gratis y no necesitas
                cuenta.
              </p>
            </div>
          ) : (
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
          )}
          {state.error && !rights ? (
            <p role="alert" className="text-sm text-destructive">
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="outline"
              className="h-11 px-4"
              onClick={() => changeOpen(false)}
            >
              Cancelar
            </Button>
            {rights ? (
              <Link
                href={rightsNoticeHref(targetType, targetId, pathname) as Route}
                className={cn(buttonVariants(), "h-11 px-4")}
                onClick={() => changeOpen(false)}
              >
                Ir al aviso formal
              </Link>
            ) : (
              <Button type="submit" className="h-11 px-4" disabled={pending}>
                {pending ? "Enviando…" : "Enviar reporte"}
              </Button>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * «Reportar» un producto, una publicación o un comentario. El reporte es anónimo para quien publicó
 * y llega a la cola del equipo. Sin sesión, lleva a iniciar sesión y regresa aquí. `compact` deja
 * solo el ícono (con `label` como nombre accesible), para cada comentario.
 */
export function ReportButton({
  targetType,
  targetId,
  isSignedIn,
  returnTo,
  className,
  compact = false,
  label = "Reportar",
}: {
  targetType: ReportableTarget;
  targetId: string;
  isSignedIn: boolean;
  /** Ruta a la que se regresa después de iniciar sesión. */
  returnTo: string;
  className?: string;
  compact?: boolean;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState(false);
  const triggerClass = cn(
    buttonVariants({ variant: "ghost", size: compact ? "icon" : "default" }),
    compact ? "shrink-0 text-muted-foreground" : "h-11 px-3 text-muted-foreground",
    className,
  );
  const content = compact ? (
    <Flag className="size-4" />
  ) : (
    <>
      <Flag data-icon="inline-start" />
      {label}
    </>
  );

  if (!isSignedIn) {
    return (
      <Link
        href={`/entrar?next=${encodeURIComponent(returnTo)}` as Route}
        className={triggerClass}
        aria-label={compact ? label : undefined}
      >
        {content}
      </Link>
    );
  }

  if (sent) {
    return (
      <span className={cn(triggerClass, "pointer-events-none")} aria-live="polite">
        {compact ? <Flag className="size-4" /> : <Flag data-icon="inline-start" />}
        <span className={compact ? "sr-only" : undefined}>Reportado</span>
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
      <DialogTrigger
        render={<Button type="button" variant="ghost" className={triggerClass} />}
        aria-label={compact ? label : undefined}
      >
        {content}
      </DialogTrigger>
    </ReportDialog>
  );
}
