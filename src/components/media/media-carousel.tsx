"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Image from "next/image";
import {
  type KeyboardEvent,
  type ReactNode,
  type UIEvent,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { blurPlaceholder, fitForFrame } from "@/lib/image";
import { cn } from "@/lib/utils";
import { dotWindow, type MediaItem } from "./media-layout";

const DEFAULT_SIZES = "(max-width: 768px) 100vw, 576px";

/** Solo nuestras miniaturas en base64 (generadas al subir) se usan como fondo en CSS. */
const BLUR_DATA_URL = /^data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+$/;

function prefersReducedMotion() {
  return (
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Carrusel de fotos para vender: marco de proporción fija (la tarjeta no cambia de alto entre
 * fotos), deslizamiento nativo con scroll-snap, contador, puntos, flechas con puntero fino y
 * teclado. Las fotos que recortarían demasiado se muestran completas sobre un fondo difuminado.
 */
export function MediaCarousel({
  items,
  label,
  aspect = 4 / 5,
  sizes = DEFAULT_SIZES,
  fit = "auto",
  preloadFirst = false,
  initialIndex = 0,
  overlay,
  className,
}: {
  items: MediaItem[];
  /** Nombre del carrusel para lectores de pantalla, p. ej. "Fotos de Tenis rojos". */
  label: string;
  /** Proporción del marco (ancho ÷ alto). */
  aspect?: number;
  sizes?: string;
  /** "auto" llena el marco si recorta poco; "contain" nunca recorta (página del producto). */
  fit?: "auto" | "contain";
  /** Precarga la foto inicial: solo cuando el carrusel es lo primero que se ve en la página. */
  preloadFirst?: boolean;
  initialIndex?: number;
  /**
   * Contenido encima de la foto, dentro del marco (p. ej. la etiqueta de precio). Quien lo pasa lo
   * posiciona con `absolute`; el contador ocupa la esquina superior derecha.
   */
  overlay?: ReactNode;
  /** Clases del marco (bordes redondeados, márgenes). */
  className?: string;
}) {
  const count = items.length;
  const start = Math.min(Math.max(Math.trunc(initialIndex), 0), Math.max(count - 1, 0));
  const [active, setActive] = useState(start);
  const trackRef = useRef<HTMLDivElement>(null);
  const previousRef = useRef<HTMLButtonElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const trackId = useId();

  // Abrir en la foto pedida (p. ej. al tocar la tercera del collage) antes de pintar.
  useLayoutEffect(() => {
    const track = trackRef.current;
    if (track) track.scrollLeft = start * track.clientWidth;
  }, [start]);

  const goTo = (index: number) => {
    const track = trackRef.current;
    if (!track) return;
    const target = Math.min(Math.max(index, 0), count - 1);
    // La flecha de la orilla se desactiva al llegar y soltaría el foco: lo conserva el carril.
    const edge = target === 0 ? previousRef.current : target === count - 1 ? nextRef.current : null;
    if (edge && edge === document.activeElement) track.focus({ preventScroll: true });
    track.scrollTo({
      left: target * track.clientWidth,
      behavior: prefersReducedMotion() ? "instant" : "smooth",
    });
  };

  // El desplazamiento es la única fuente de verdad: sirve igual para deslizar, flechas y teclado.
  const onScroll = (event: UIEvent<HTMLDivElement>) => {
    const { scrollLeft, clientWidth } = event.currentTarget;
    if (clientWidth === 0) return;
    const index = Math.round(Math.abs(scrollLeft) / clientWidth);
    setActive(Math.min(Math.max(index, 0), count - 1));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    // Alt+← es "atrás" en el navegador: con modificadores no se intercepta nada.
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    const targets: Record<string, number> = {
      ArrowLeft: active - 1,
      ArrowRight: active + 1,
      Home: 0,
      End: count - 1,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    goTo(target);
  };

  const slide = (item: MediaItem, index: number) => {
    const mode = fit === "contain" ? "contain" : fitForFrame(item, aspect);
    return (
      <>
        {mode === "contain" && item.blurDataUrl && BLUR_DATA_URL.test(item.blurDataUrl) ? (
          <div
            aria-hidden="true"
            className="absolute inset-0 scale-110 bg-cover bg-center blur-2xl"
            style={{ backgroundImage: `url("${item.blurDataUrl}")` }}
          />
        ) : null}
        <Image
          src={item.url}
          alt={item.alt}
          fill
          sizes={sizes}
          {...blurPlaceholder(item)}
          preload={preloadFirst && index === start}
          // En `style` y no en clases: next/image lo usa para que el desenfoque de carga tenga la
          // misma forma que la foto (con clases lo estira al marco).
          style={{ objectFit: mode }}
        />
      </>
    );
  };

  if (count === 0) return null;

  if (count === 1) {
    return (
      <div
        className={cn("relative overflow-hidden bg-muted", className)}
        style={{ aspectRatio: aspect }}
      >
        {slide(items[0]!, 0)}
        {overlay}
      </div>
    );
  }

  const navButton =
    "absolute top-1/2 hidden size-9 -translate-y-1/2 place-items-center rounded-full bg-background/85 text-foreground shadow-sm backdrop-blur-sm transition-opacity outline-none pointer-fine:grid pointer-fine:opacity-0 group-focus-within/carousel:opacity-100 group-hover/carousel:opacity-100 focus-visible:ring-3 focus-visible:ring-ring disabled:invisible motion-reduce:transition-none";

  return (
    <div
      role="region"
      aria-roledescription="carrusel"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="flex flex-col gap-2"
    >
      <div
        className={cn("group/carousel relative overflow-hidden bg-muted", className)}
        style={{ aspectRatio: aspect }}
      >
        <div
          ref={trackRef}
          id={trackId}
          tabIndex={0}
          onScroll={onScroll}
          data-slot="carousel-track"
          // Sin `outline-none`: en Tailwind 4 anula el `outline-3` del foco (queda sin anillo).
          className="scrollbar-none flex size-full snap-x snap-mandatory overflow-x-auto overscroll-x-contain focus-visible:outline-3 focus-visible:-outline-offset-3 focus-visible:outline-ring"
        >
          {items.map((item, index) => (
            <div
              key={item.url}
              role="group"
              aria-roledescription="diapositiva"
              aria-label={`${index + 1} de ${count}`}
              className="relative size-full shrink-0 snap-center snap-always overflow-hidden"
            >
              {slide(item, index)}
            </div>
          ))}
        </div>

        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-3 right-3 rounded-full bg-background/80 px-2 py-0.5 text-xs font-semibold text-foreground tabular-nums backdrop-blur-sm"
        >
          {active + 1}/{count}
        </span>
        {overlay}
        <button
          ref={previousRef}
          type="button"
          aria-label="Foto anterior"
          aria-controls={trackId}
          disabled={active === 0}
          onClick={() => goTo(active - 1)}
          className={cn(navButton, "left-2")}
        >
          <ChevronLeft className="size-5" />
        </button>
        <button
          ref={nextRef}
          type="button"
          aria-label="Foto siguiente"
          aria-controls={trackId}
          disabled={active === count - 1}
          onClick={() => goTo(active + 1)}
          className={cn(navButton, "right-2")}
        >
          <ChevronRight className="size-5" />
        </button>
      </div>

      <div aria-hidden="true" data-slot="carousel-dots" className="flex justify-center gap-1">
        {dotWindow(count, active).map((dot) => (
          <span
            key={dot.index}
            data-active={dot.index === active ? "" : undefined}
            className={cn(
              "size-1.5 rounded-full bg-muted-foreground/35 transition motion-reduce:transition-none",
              dot.index === active && "bg-primary",
              dot.size === "md" && "scale-75",
              dot.size === "sm" && "scale-50",
            )}
          />
        ))}
      </div>
      <p aria-live="polite" className="sr-only">
        Foto {active + 1} de {count}
      </p>
    </div>
  );
}
