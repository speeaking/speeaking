/**
 * Momento de bienvenida («¡Listo, …!») después del onboarding. Lo marca una cookie breve y no un
 * parámetro de la URL: quitar el parámetro con `history.replaceState` hacía que el siguiente
 * `router.refresh()` (al unirse o seguir) llevara la página hasta arriba y borrara la tarjeta.
 */
export const WELCOME_COOKIE = "vendeia_bienvenida";

/** La tarjeta se muestra hasta que se cierra o pasan 10 minutos. */
export const WELCOME_MAX_AGE_SECONDS = 600;
