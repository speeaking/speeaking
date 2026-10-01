"use client";

import { type RefObject, useEffect, useState } from "react";

/**
 * Si una fila con scroll horizontal está en su inicio o en su final (para apagar la flecha que ya
 * no lleva a ningún lado). Se mide al montar (el ResizeObserver avisa al observar), al cambiar de
 * tamaño y en cada desplazamiento (`update` va en `onScroll`). `count`: si cambia el número de
 * piezas cambia el ancho del contenido, no el de la lista, y hay que volver a medir.
 */
export function useScrollEdges(ref: RefObject<HTMLElement | null>, count: number) {
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  const update = () => {
    const element = ref.current;
    if (!element) return;
    const atStart = element.scrollLeft <= 1;
    const atEnd = element.scrollLeft + element.clientWidth >= element.scrollWidth - 1;
    setEdges((current) =>
      current.atStart === atStart && current.atEnd === atEnd ? current : { atStart, atEnd },
    );
  };
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => update());
    observer.observe(element);
    return () => observer.disconnect();
    // `update` lee del ref: no cambia entre renders; `count` sí obliga a volver a medir.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, count]);
  return { ...edges, update };
}

/** Desplaza una fila un 80 % de su ancho visible, sin animación si la persona pide menos movimiento. */
export function scrollRow(element: HTMLElement | null, direction: -1 | 1) {
  if (!element) return;
  const reduceMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  element.scrollBy({
    left: direction * element.clientWidth * 0.8,
    behavior: reduceMotion ? "auto" : "smooth",
  });
}
