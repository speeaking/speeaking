"use client";

import { useEffect } from "react";
import { trackRegistrationOnce } from "../tiktok";

/**
 * Mide el registro completo (`CompleteRegistration`) para la campaña de TikTok (ADR-072). Va en la
 * bienvenida, a la que llega quien acaba de crear su cuenta. Solo sale con permiso (`AdPixel`) y una
 * vez por navegador.
 */
export function RegistrationEvent() {
  useEffect(() => {
    trackRegistrationOnce();
  }, []);
  return null;
}
