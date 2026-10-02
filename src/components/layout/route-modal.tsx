"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

/**
 * Una ruta abierta en capa sobre la página anterior (ADR-052): la URL cambia (se puede compartir,
 * recargar abre la página completa) y cerrar o «atrás» regresa a donde estabas, con el scroll intacto.
 * En teléfono ocupa la pantalla; en escritorio es una ventana centrada con scroll propio. Si adentro
 * hay un visor (`data-layout="theater"`, ADR-064), en pantallas anchas la ventana se ensancha y toma
 * casi todo el alto: la imagen queda fija a la izquierda y lo demás se desplaza a la derecha.
 *
 * `match`: prefijo de ruta al que pertenece la capa (p. ej. `/p/`). Al navegar a otra ruta desde
 * dentro, el slot paralelo conserva su último contenido; la capa se cierra sola al ver que la URL ya
 * no es la suya. Así no hace falta una ruta comodín en el slot, que convertiría cualquier URL
 * inexistente en un 200 con la página de «no encontramos» dentro.
 */
export function RouteModal({
  label,
  match,
  showTitle = false,
  children,
}: {
  label: string;
  match: string;
  /** El título se ve arriba (p. ej. «Crear publicación», ADR-068); si no, solo lo leen los lectores. */
  showTitle?: boolean;
  children: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  if (!pathname.startsWith(match)) return null;
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) router.back();
      }}
    >
      <DialogContent
        className="inset-0 top-0 left-0 block h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 overflow-y-auto rounded-none bg-background p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-auto sm:max-h-[92dvh] sm:w-full sm:max-w-2xl sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-3xl lg:has-data-[layout=theater]:h-[92dvh] lg:has-data-[layout=theater]:max-w-[min(76rem,calc(100vw-3rem))] lg:has-data-[layout=theater]:bg-card"
        aria-describedby={undefined}
      >
        <DialogTitle
          className={
            showTitle
              ? "px-4 pt-4 pr-14 font-heading text-xl font-extrabold sm:px-6 sm:pr-14"
              : "sr-only"
          }
        >
          {label}
        </DialogTitle>
        <div
          className={
            showTitle ? "pt-4 pb-4" : "pt-12 pb-4 sm:pt-4 lg:has-data-[layout=theater]:p-0"
          }
        >
          {children}
        </div>
      </DialogContent>
    </Dialog>
  );
}
