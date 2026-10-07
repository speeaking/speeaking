"use client";

import { useEffect } from "react";
import { trackTikTokEvent } from "@/lib/tiktok-pixel";

const STORAGE_KEY = "tiktok-registration-sent";

/**
 * Evento `CompleteRegistration` del pixel de TikTok. Va en `/bienvenida`, que solo se muestra a
 * cuentas recién creadas que aún no terminan el onboarding. Se envía una vez por navegador para
 * que recargar o volver a la página no cuente otro registro.
 */
export function TikTokRegistration() {
  useEffect(() => {
    // El pixel lo carga el layout raíz, cuyo efecto corre después del de esta página.
    const timer = window.setTimeout(() => {
      try {
        if (window.localStorage.getItem(STORAGE_KEY)) return;
        window.localStorage.setItem(STORAGE_KEY, "1");
      } catch {
        // Sin almacenamiento (modo privado estricto): se envía de todos modos.
      }
      trackTikTokEvent("CompleteRegistration");
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  return null;
}
