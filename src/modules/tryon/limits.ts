/**
 * Límites de Pruébatelo que también lee el navegador. Sin `sharp` ni `server-only`: `task.ts` (que
 * sí usa `sharp` para el simulador) los reexporta, pero los componentes cliente importan de aquí.
 */

/** Máximo de prendas por simulación (un look completo: arriba, abajo, calzado y un accesorio). */
export const MAX_TRY_ON_GARMENTS = 4;

/** Fotos vivas por persona; para subir otra hay que borrar una. */
export const MAX_TRY_ON_PHOTOS = 5;
