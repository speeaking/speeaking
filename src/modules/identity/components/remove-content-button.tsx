"use client";

import { Trash2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { removeOwnContentAction } from "../content-removal-actions";
import type { OwnContentKind } from "../content-removal-types";

export function RemoveContentButton({
  kind,
  id,
  label = "Eliminar",
  description,
  onRemoved,
  compact = false,
}: {
  kind: OwnContentKind;
  id: string | string[];
  label?: string;
  description?: string;
  onRemoved?: () => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, start] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  function remove() {
    setError(undefined);
    start(async () => {
      try {
        const result = await removeOwnContentAction(kind, id);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        onRemoved?.();
        toast.success(
          kind === "purchase" ? "Compra eliminada de tu historial" : "Contenido eliminado",
        );
        if (kind === "purchase" && pathname === `/pedidos/${id}`) router.replace("/pedidos");
        if (kind === "conversation") router.replace("/mensajes");
        router.refresh();
      } catch {
        setError("No pudimos completar la acción. Intenta de nuevo.");
      }
    });
  }
  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size={compact ? "icon" : "sm"}
        className="shrink-0 text-muted-foreground hover:text-destructive"
        aria-label={label}
        onClick={() => {
          setError(undefined);
          setOpen(true);
        }}
      >
        <Trash2 className="size-4" />
        {compact ? null : label}
      </Button>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
            <DialogDescription>
              {description ??
                "Este contenido dejará de aparecer. Esta acción no se puede deshacer."}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" disabled={pending} onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button variant="destructive" disabled={pending} onClick={remove}>
              {pending ? "Eliminando…" : "Confirmar eliminación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
