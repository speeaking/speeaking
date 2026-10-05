"use client";

import { Eye, MoreHorizontal, Trash2 } from "lucide-react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { deletePostAction } from "../delete-post-action";
import { changePostAudienceAction } from "../audience-actions";
import { audienceFromDTO, audienceToDTO, type PostAudienceDTO } from "../audience";
import { AudienceOptions } from "./post-audience-picker";

export function PostOwnerMenu({
  postId,
  hasProduct,
  audience,
  onAudienceChanged,
  onDeleted,
}: {
  postId: string;
  hasProduct: boolean;
  audience: PostAudienceDTO;
  onAudienceChanged: (value: PostAudienceDTO) => void;
  onDeleted: () => void;
}) {
  const [dialog, setDialog] = useState<"delete" | "audience" | null>(null);
  const [draft, setDraft] = useState(audienceFromDTO(audience));
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  function show(value: "delete" | "audience") {
    setError(undefined);
    setDraft(audienceFromDTO(audience));
    setDialog(value);
  }
  function remove() {
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await deletePostAction(postId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setDialog(null);
        onDeleted();
        toast.success("Publicación eliminada");
        if (pathname === `/p/${postId}`) router.replace("/");
        router.refresh();
      } catch {
        setError("No pudimos eliminarla. Intenta de nuevo.");
      }
    });
  }
  function saveAudience() {
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await changePostAudienceAction(postId, draft);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        onAudienceChanged(audienceToDTO(draft));
        setDialog(null);
        toast.success("Audiencia actualizada");
        router.refresh();
      } catch {
        setError("No pudimos guardar la audiencia. Intenta de nuevo.");
      }
    });
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="shrink-0 text-muted-foreground"
              aria-label="Opciones de la publicación"
              disabled={pending}
            />
          }
        >
          <MoreHorizontal className="size-5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onClick={() => show("audience")}>
            <Eye />
            Cambiar audiencia
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onClick={() => show("delete")}>
            <Trash2 />
            Eliminar publicación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={dialog !== null}
        onOpenChange={(open) => {
          if (!open && !pending) setDialog(null);
        }}
      >
        <DialogContent showCloseButton={!pending} className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {dialog === "audience"
                ? "¿Quién puede ver tu publicación?"
                : "¿Eliminar esta publicación?"}
            </DialogTitle>
            <DialogDescription>
              {dialog === "audience"
                ? "La audiencia se aplica también a las fotos, el video y sus comentarios. Puedes cambiarla cuando quieras."
                : "Dejará de aparecer en tu perfil y en las comunidades. Esta acción no se puede deshacer."}
              {hasProduct ? " El producto seguirá disponible en la tienda del vendedor." : ""}
            </DialogDescription>
          </DialogHeader>
          {dialog === "audience" ? (
            <AudienceOptions value={draft} onChange={setDraft} disabled={pending} />
          ) : null}
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDialog(null)}
              disabled={pending}
            >
              Cancelar
            </Button>
            {dialog === "audience" ? (
              <Button type="button" onClick={saveAudience} disabled={pending}>
                {pending ? "Guardando…" : "Guardar audiencia"}
              </Button>
            ) : (
              <Button type="button" variant="destructive" onClick={remove} disabled={pending}>
                <Trash2 />
                {pending ? "Eliminando…" : "Eliminar publicación"}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
