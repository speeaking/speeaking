"use client";

import { Handshake, X } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type CollaborationState,
  markCollaborationAction,
  removeProductTagAction,
} from "../actions";

/**
 * Acciones sobre una publicación que etiqueta un producto (ADR-063): marcarla como «Colaboración»
 * (quien publicó o la tienda) y, solo la tienda, quitar la etiqueta de su producto. Quitar pide
 * confirmar en el mismo lugar: la publicación de otra persona pierde el producto.
 */
export function CollaborationActions({
  postId,
  collaboration,
  canRemove = false,
}: {
  postId: string;
  collaboration: boolean;
  /** La tienda dueña del producto puede quitar la etiqueta. */
  canRemove?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);

  const run = (action: (postId: string) => Promise<CollaborationState>) =>
    startTransition(async () => {
      const result = await action(postId).catch((): CollaborationState => ({
        error: "No pudimos guardar el cambio. Intenta de nuevo.",
      }));
      if (result.error) toast.error(result.error);
      else if (result.ok) toast.success(result.ok);
      setConfirming(false);
    });

  if (confirming) {
    return (
      <div role="group" aria-label="Confirmar quitar etiqueta" className="flex flex-wrap gap-2">
        <Button
          type="button"
          className="h-10 md:h-9"
          variant="destructive"
          disabled={pending}
          onClick={() => run(removeProductTagAction)}
        >
          Sí, quitar etiqueta
        </Button>
        <Button
          type="button"
          className="h-10 md:h-9"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(false)}
        >
          Cancelar
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      {collaboration ? null : (
        <Button
          type="button"
          className="h-10 md:h-9"
          variant="outline"
          disabled={pending}
          onClick={() => run(markCollaborationAction)}
        >
          <Handshake data-icon="inline-start" />
          Marcar como colaboración
        </Button>
      )}
      {canRemove ? (
        <Button
          type="button"
          className="h-10 md:h-9"
          variant="ghost"
          disabled={pending}
          onClick={() => setConfirming(true)}
        >
          <X data-icon="inline-start" />
          Quitar etiqueta
        </Button>
      ) : null}
    </div>
  );
}
