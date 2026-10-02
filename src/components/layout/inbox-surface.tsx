"use client";

import { Drawer } from "@base-ui/react/drawer";
import { Popover } from "@base-ui/react/popover";
import { X } from "lucide-react";
import type { MouseEvent, ReactElement, ReactNode } from "react";
import { useWideScreen } from "@/lib/use-wide-screen";

/**
 * El botón de la barra es un enlace a la página completa (/avisos, /mensajes, /crear): si se toca
 * antes de que la página termine de cargar, lleva ahí; ya cargada, abre su panel sin navegar.
 */
export const preventLinkNavigation = (event: MouseEvent<HTMLElement>) => event.preventDefault();

/**
 * Lo que se abre AHÍ MISMO desde la barra superior (ADR-068): avisos y mensajes. En tableta y
 * escritorio, un recuadro bajo su botón, como en Facebook; en teléfono, un panel que sube desde
 * abajo y se cierra deslizándolo. La página de atrás no se mueve: al cerrar sigues donde ibas.
 * Se cierra con Esc, tocando afuera, con la X (teléfono) o al abrir un enlace de adentro.
 */
export function InboxSurface({
  open,
  onOpenChange,
  trigger,
  title,
  titleContent,
  leading,
  actions,
  children,
  footer,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El enlace de la barra (ver `preventLinkNavigation`); se le agrega lo necesario para abrir. */
  trigger: ReactElement;
  /** Nombre del panel; también es lo que se ve, salvo que haya `titleContent`. */
  title: string;
  /** Lo que se ve en lugar del título (p. ej. la persona con su menú, ADR-069). */
  titleContent?: ReactNode;
  /** Antes del título (p. ej. «Volver»). */
  leading?: ReactNode;
  /** A la derecha del título (p. ej. «Ver todo»). */
  actions?: ReactNode;
  /** Contenido con su propio scroll. */
  children: ReactNode;
  /** Fijo abajo (p. ej. escribir un mensaje); en teléfono, por encima del teclado. */
  footer?: ReactNode;
}) {
  const wide = useWideScreen();

  /** Un enlace de adentro lleva a otra página: el panel se cierra (la navegación sigue sola). */
  const closeOnLink = (event: MouseEvent<HTMLElement>) => {
    const link = (event.target as HTMLElement).closest("a[href]");
    if (!link || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey) return;
    onOpenChange(false);
  };

  // Mientras no se sabe el tamaño de la pantalla (al cargar), el botón es solo su enlace a la
  // página completa: nunca se abre un panel que un instante después cambiaría por el otro.
  if (wide === null) return trigger;

  if (wide) {
    return (
      <Popover.Root open={open} onOpenChange={(next) => onOpenChange(next)}>
        <Popover.Trigger nativeButton={false} render={trigger} onClick={preventLinkNavigation} />
        <Popover.Portal>
          <Popover.Positioner
            side="bottom"
            align="end"
            sideOffset={8}
            collisionPadding={8}
            className="isolate z-50 outline-none"
          >
            <Popover.Popup
              data-slot="inbox"
              onClick={closeOnLink}
              className="flex max-h-[min(calc(100dvh-5.5rem),40rem)] w-[min(25rem,calc(100vw-1rem))] origin-(--transform-origin) flex-col overflow-hidden rounded-2xl bg-popover text-popover-foreground shadow-xl ring-1 ring-foreground/10 transition-[opacity,scale] duration-150 outline-none data-ending-style:scale-95 data-ending-style:opacity-0 data-starting-style:scale-95 data-starting-style:opacity-0 motion-reduce:transition-none"
            >
              <header className="flex min-h-14 shrink-0 items-center gap-1 border-b px-2 py-2">
                {leading}
                <Popover.Title
                  className={
                    titleContent
                      ? "sr-only"
                      : "min-w-0 flex-1 truncate px-2 font-heading text-lg font-bold"
                  }
                >
                  {title}
                </Popover.Title>
                {titleContent ? (
                  <div className="flex min-w-0 flex-1 items-center px-1 font-heading text-lg font-bold">
                    {titleContent}
                  </div>
                ) : null}
                {actions}
              </header>
              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
              {footer ? <div className="shrink-0 border-t px-3 py-3">{footer}</div> : null}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    );
  }

  return (
    <Drawer.Root open={open} onOpenChange={(next) => onOpenChange(next)} swipeDirection="down">
      <Drawer.Trigger nativeButton={false} render={trigger} onClick={preventLinkNavigation} />
      <Drawer.VirtualKeyboardProvider>
        <Drawer.Portal>
          <Drawer.Backdrop className="fixed inset-0 z-50 min-h-dvh bg-black opacity-[calc(0.45*(1-var(--drawer-swipe-progress)))] transition-opacity duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] data-ending-style:opacity-0 data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:opacity-0 data-swiping:duration-0 motion-reduce:transition-none" />
          <Drawer.Viewport className="fixed inset-0 z-50 flex items-end justify-center">
            <Drawer.Popup
              data-slot="inbox"
              onClick={closeOnLink}
              className="flex h-[85dvh] w-full [transform:translateY(var(--drawer-swipe-movement-y))] touch-none flex-col rounded-t-3xl border-t bg-card text-card-foreground shadow-2xl transition-transform duration-[450ms] ease-[cubic-bezier(0.32,0.72,0,1)] will-change-transform outline-none data-ending-style:[transform:translateY(100%)] data-ending-style:duration-[calc(var(--drawer-swipe-strength)*400ms)] data-starting-style:[transform:translateY(100%)] data-swiping:select-none motion-reduce:transition-none"
            >
              <header className="shrink-0 border-b px-2 pt-2.5 pb-2 select-none">
                <div
                  aria-hidden="true"
                  className="mx-auto mb-2 h-1 w-10 rounded-full bg-muted-foreground/30"
                />
                <div className="flex min-h-11 items-center gap-1">
                  {leading}
                  <Drawer.Title
                    className={
                      titleContent
                        ? "sr-only"
                        : "min-w-0 flex-1 truncate px-2 font-heading text-lg font-bold"
                    }
                  >
                    {title}
                  </Drawer.Title>
                  {titleContent ? (
                    <div className="flex min-w-0 flex-1 items-center px-1 font-heading text-lg font-bold">
                      {titleContent}
                    </div>
                  ) : null}
                  {actions}
                  <Drawer.Close
                    aria-label="Cerrar"
                    className="grid size-11 shrink-0 place-items-center rounded-full hover:bg-secondary focus-visible:outline-3 focus-visible:outline-ring"
                  >
                    <X aria-hidden="true" className="size-5" />
                  </Drawer.Close>
                </div>
              </header>
              <Drawer.Content className="min-h-0 flex-1 touch-auto overflow-y-auto overscroll-contain">
                {children}
              </Drawer.Content>
              {footer ? (
                <div
                  data-base-ui-swipe-ignore=""
                  className="shrink-0 border-t bg-card px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px)+var(--drawer-keyboard-inset,0px))]"
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

/** Mientras llega lo de adentro: filas grises del tamaño de un aviso o una conversación. */
export function InboxLoading({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="flex flex-col gap-1 p-2">
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className="flex items-center gap-3 rounded-2xl px-2 py-2.5">
          <span className="size-11 shrink-0 animate-pulse rounded-full bg-secondary" />
          <span className="flex flex-1 flex-col gap-2">
            <span className="h-3 w-3/4 animate-pulse rounded-full bg-secondary" />
            <span className="h-3 w-1/2 animate-pulse rounded-full bg-secondary" />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Un mensaje en el centro del panel (vacío o error), con una acción opcional. */
export function InboxNotice({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center text-sm text-muted-foreground">
      <p>{children}</p>
      {action}
    </div>
  );
}

/** «Ver todo»: el enlace del encabezado a la página completa. */
export const inboxLinkClass =
  "shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-primary-text hover:bg-secondary focus-visible:outline-3 focus-visible:outline-ring";

/** Botones de ícono del encabezado («Volver», «Abrir en Mensajes»). */
export const inboxIconClass =
  "grid size-10 shrink-0 place-items-center rounded-full hover:bg-secondary focus-visible:outline-3 focus-visible:outline-ring";
