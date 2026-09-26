"use client";

import { useCallback, useEffect, useRef } from "react";
import type { VisibleImpressionSurface } from "@/modules/analytics/visible-impression-contract";
import {
  type ImpressionTransport,
  sendImpressions,
  VisibleImpressionSession,
} from "./visible-impressions";

/**
 * Mide las impresiones VISIBLES de una lista del feed (T5): devuelve un `ref` estable para el
 * contenedor de cada pieza, que debe llevar `data-impression-post` y `data-impression-position`.
 * Cada montaje de la lista es una vista de la página: una pieza cuenta a lo más una vez en ella.
 */
export function useVisibleImpressions(
  surface: VisibleImpressionSurface,
  transport: ImpressionTransport = sendImpressions,
) {
  const sessionRef = useRef<VisibleImpressionSession | null>(null);

  // Una sesión por superficie: si la lista cambiara de superficie, la nueva empieza de cero (el
  // efecto detiene la anterior).
  const session = useCallback(() => {
    const current = sessionRef.current;
    if (current?.surface === surface && current.transport === transport) return current;
    const next = new VisibleImpressionSession(surface, transport);
    sessionRef.current = next;
    return next;
  }, [surface, transport]);

  // Detener no olvida las piezas: en desarrollo (StrictMode) el efecto se monta dos veces y la
  // misma sesión vuelve a observar lo que ya tenía.
  useEffect(() => {
    const current = session();
    current.start();
    return () => current.stop();
  }, [session]);

  return useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      const current = session();
      current.observe(element);
      return () => current.unobserve(element);
    },
    [session],
  );
}
