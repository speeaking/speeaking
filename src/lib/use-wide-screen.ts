"use client";

import { useSyncExternalStore } from "react";

/** El mismo corte que `md:` de Tailwind: teléfono debajo, tableta y escritorio encima. */
const WIDE = "(min-width: 768px)";

const hasMatchMedia = () => typeof window.matchMedia === "function";

function subscribe(onChange: () => void) {
  if (!hasMatchMedia()) return () => {};
  const query = window.matchMedia(WIDE);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const isWide = () => hasMatchMedia() && window.matchMedia(WIDE).matches;

/**
 * ¿Pantalla de tableta o escritorio? `null` en el servidor y al hidratar (todavía no se sabe) y
 * después la medida real; cambia sola al girar o redimensionar.
 */
export function useWideScreen(): boolean | null {
  return useSyncExternalStore(subscribe, isWide, () => null);
}
