"use client";

import Image from "next/image";
import { useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { deleteTryOnPhotoAction } from "../actions";
import type { TryOnPhotoDTO } from "../service";

const dateFormat = new Intl.DateTimeFormat("es-MX", { dateStyle: "medium" });

/** «Mis fotos de prueba» en Ajustes (ADR-045): ver cuándo se borran y borrarlas antes. */
export function TryOnPhotoList({ photos }: { photos: TryOnPhotoDTO[] }) {
  const [pending, startTransition] = useTransition();
  if (photos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">No tienes fotos guardadas para Pruébatelo.</p>
    );
  }
  return (
    <ul className="flex flex-wrap gap-3" aria-label="Fotos de Pruébatelo">
      {photos.map((photo) => (
        <li key={photo.id} className="flex flex-col items-start gap-1.5">
          <span className="relative size-24 overflow-hidden rounded-2xl bg-muted">
            <Image
              src={photo.url}
              alt="Tu foto de Pruébatelo"
              fill
              sizes="96px"
              style={{ objectFit: "cover" }}
            />
          </span>
          <span className="text-[11px] text-muted-foreground">
            Se borra el {dateFormat.format(new Date(photo.expiresAt))}
          </span>
          <Button
            type="button"
            variant="link"
            size="xs"
            className="h-auto px-0 text-xs text-destructive"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await deleteTryOnPhotoAction(photo.id);
                if (result.error) toast.error(result.error);
                else toast.success(result.ok ?? "Foto borrada.");
              })
            }
          >
            Borrar foto y simulaciones
          </Button>
        </li>
      ))}
    </ul>
  );
}
