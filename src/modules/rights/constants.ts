import type { TurnstileAction } from "@/modules/identity/turnstile";

/**
 * Acción de Turnstile del formulario de avisos (solo si Turnstile está configurado; sin él el
 * formulario funciona igual). El widget la manda y el servidor exige la misma: un token de otro
 * formulario no sirve aquí.
 *
 * PENDIENTE: agregar "rights-notice" a `TurnstileAction` (`identity/turnstile.ts`, fuera de este
 * cambio) y quitar esta conversión.
 */
export const RIGHTS_TURNSTILE_ACTION = "rights-notice" as string as TurnstileAction;
