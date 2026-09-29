"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Mientras el hilo está en pantalla, se vuelve a pedir al servidor cada `everyMs` para traer lo que
 * escribió la otra persona (sin sockets en esta etapa; ADR-047). En segundo plano no pide nada.
 */
export function ThreadRefresh({ everyMs = 10_000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const tick = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    const timer = setInterval(tick, everyMs);
    document.addEventListener("visibilitychange", tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
    };
  }, [router, everyMs]);
  return null;
}
