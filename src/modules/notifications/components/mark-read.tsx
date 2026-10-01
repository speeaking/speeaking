"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";
import { markNotificationsReadAction } from "../actions";

/**
 * Al abrir la campana, los avisos quedan leídos (ADR-059) y el globo de la barra se apaga. La
 * lista de esta visita conserva su resaltado de «nuevos»: se marcó ya con lo que había.
 */
export function MarkNotificationsRead({ unread }: { unread: number }) {
  const router = useRouter();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || unread === 0) return;
    done.current = true;
    void markNotificationsReadAction().then((changed) => {
      if (changed > 0) router.refresh();
    });
  }, [router, unread]);
  return null;
}
