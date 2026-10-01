"use client";

import { Drawer } from "@base-ui/react/drawer";
import { X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { type ReactNode, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";

const WIDE = "(min-width: 768px)";
/** Un poco más que la animación de salida (450 ms). */
const CLOSE_FALLBACK_MS = 600;

const hasMatchMedia = () => typeof window.matchMedia === "function";

function subscribe(onChange: () => void) {
  if (!hasMatchMedia()) return () => {};
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const isWide = () => hasMatchMedia() && window.matchMedia(WIDE).matches;

/**
 * Una ruta abierta como panel deslizable sobre la página anterior (ADR-057), como los comentarios de
 * Facebook: en teléfono sube desde abajo y se cierra deslizándolo hacia abajo; en escritorio entra
 * por la derecha. La URL cambia (recargar abre la página completa) y cerrar, deslizar o «atrás»
 * regresan a donde estabas, con el scroll intacto. Al cerrar desde el panel, primero termina la
 * animación y después se regresa en el historial.
 *
 * `path`: la ruta exacta del panel. Al navegar a otra ruta desde dentro (p. ej. un perfil), el slot
 * paralelo conserva su contenido; el panel se oculta solo al ver que la URL ya no es la suya.
 */
export function RouteDrawer({
  path,
  title,
  meta,
  children,
  footer,
}: {
  path: string;
  title: string;
  /** Línea bajo el título (p. ej. el resumen de reacciones). */
  meta?: ReactNode;
  /** Contenido con su propio scroll. */
  children: ReactNode;
  /** Fijo abajo, al alcance del pulgar y por encima del teclado (p. ej. escribir un comentario). */
  footer?: ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const wide = useSyncExternalStore(subscribe, isWide, () => false);
  const [open, setOpen] = useState(true);
  const leaving = useRef(false);
  const fallback = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (fallback.current !== null) window.clearTimeout(fallback.current);
    },
    [],
  );
  if (pathname !== path) return null;

  /** Regresa una sola vez: al terminar la animación o, si el navegador no la corre, por respaldo. */
  const leave = () => {
    if (leaving.current) return;
    leaving.current = true;
    if (fallback.current !== null) window.clearTimeout(fallback.current);
    router.back();
  };

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        // Una pestaña oculta o un navegador sin animaciones nunca avisa que terminó la salida.
        if (!next) fallback.current = window.setTimeout(leave, CLOSE_FALLBACK_MS);
      }}
      onOpenChangeComplete={(isOpen) => {
        if (!isOpen) leave();
      }}
      swipeDirection={wide ? "right" : "down"}
    >
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.45*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 motion-reduce:transition-none" />
          <Drawer.Viewport
            className={cn(
              "fixed inset-0 z-50 flex",
              wide ? "justify-end" : "items-end justify-center",
            )}
          >
            <Drawer.Popup
              data-slot="route-drawer"
              className={cn(
                "flex touch-none flex-col bg-card text-card-foreground shadow-2xl will-change-transform outline-none",
                "transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-swiping:select-none motion-reduce:transition-none",
                wide
                  ? "h-dvh w-[420px] max-w-[90vw] [transform:translateX(var(--drawer-swipe-movement-x))] border-l data-ending-style:[transform:translateX(100%)] data-starting-style:[transform:translateX(100%)]"
                  : "h-[85dvh] w-full [transform:translateY(var(--drawer-swipe-movement-y))] rounded-t-3xl border-t data-ending-style:[transform:translateY(100%)] data-starting-style:[transform:translateY(100%)]",
              )}
            >
              <header className="relative shrink-0 border-b px-4 pt-3 pb-3 select-none">
                {wide ? null : (
                  <div
                    aria-hidden="true"
                    className="mx-auto mb-2.5 h-1 w-10 rounded-full bg-muted-foreground/30"
                  />
                )}
                <div className="flex items-center gap-3">
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Drawer.Title className="font-heading text-lg font-bold">{title}</Drawer.Title>
                    {meta ? (
                      <Drawer.Description className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        {meta}
                      </Drawer.Description>
                    ) : null}
                  </div>
                  <Drawer.Close
                    aria-label="Cerrar"
                    className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-secondary focus-visible:outline-3 focus-visible:outline-ring"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </Drawer.Close>
                </div>
              </header>
              <Drawer.Content className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain px-4 py-4">
                {children}
              </Drawer.Content>
              {footer ? (
                <div
                  data-base-ui-swipe-ignore=""
                  className="shrink-0 border-t bg-card px-4 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px)+var(--drawer-keyboard-inset,0px))]"
                >
                  {footer}
                </div>
              ) : null}
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.VirtualKeyboardProvider>
    </Drawer.Root>
  );
}
