"use client";

import { Ellipsis, Trash2 } from "lucide-react";
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

export function PostOwnerMenu({
  postId,
  hasProduct,
  onDeleted,
}: {
  postId: string;
  hasProduct: boolean;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  function remove() {
    setError(undefined);
    startTransition(async () => {
      try {
        const result = await deletePostAction(postId);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setOpen(false);
        onDeleted();
        toast.success("Publicación eliminada");
        if (pathname === `/p/${postId}`) router.replace("/");
        router.refresh();
      } catch {
        setError("No pudimos eliminarla. Intenta de nuevo.");
      }
    });
  }
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-10 shrink-0 rounded-full text-muted-foreground"
              aria-label="Opciones de tu publicación"
            />
          }
        >
          <Ellipsis />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            variant="destructive"
            onClick={() => {
              setError(undefined);
              setOpen(true);
            }}
          >
            <Trash2 />
            Eliminar publicación
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <Dialog
        open={open}
        onOpenChange={(value) => {
          if (!pending) setOpen(value);
        }}
      >
        <DialogContent showCloseButton={!pending}>
          <DialogHeader>
            <DialogTitle>¿Eliminar esta publicación?</DialogTitle>
            <DialogDescription>
              Dejará de aparecer en tu perfil y en las comunidades. Esta acción no se puede
              deshacer.
              {hasProduct ? " El producto seguirá disponible en la tienda del vendedor." : ""}
            </DialogDescription>
          </DialogHeader>
          {error ? (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          ) : null}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={remove} disabled={pending}>
              <Trash2 />
              {pending ? "Eliminando…" : "Eliminar publicación"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
