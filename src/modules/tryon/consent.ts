import { LEGAL_VERSIONS } from "@/modules/identity/constants";

/**
 * Consentimiento de «Pruébatelo» (ADR-045), versionado en `LEGAL_VERSIONS.tryOn`. Se muestra tal
 * cual al subir la foto y se guarda en `UserConsent` (`TRY_ON_PHOTOS`). Sin `server-only`: lo leen
 * los componentes.
 */
export const TRY_ON_CONSENT_VERSION = LEGAL_VERSIONS.tryOn;

export const TRY_ON_RETENTION_DAYS = 30;

export const TRY_ON_CONSENT_TEXT = `Acepto que Estreno use esta foto, que es mía y en la que soy mayor de edad, solo para generar simulaciones de cómo podrían verse productos en mí. La foto y cada simulación son privadas (solo yo las veo), se envían al proveedor de inteligencia artificial que genera la imagen sin mi nombre ni mis datos, y se borran a los ${TRY_ON_RETENTION_DAYS} días o antes si las elimino desde Ajustes.`;

/** Aviso que acompaña a cada resultado (nunca una garantía). */
export const TRY_ON_DISCLAIMER =
  "Simulación generada con IA: la prenda puede verse distinta en la realidad (talla, color, caída).";
