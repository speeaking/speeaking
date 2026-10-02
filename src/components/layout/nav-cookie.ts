/**
 * Cookie con el estado de la columna izquierda en escritorio: `open` (por omisión) o `closed`
 * (ADR-047). Vive en un módulo sin `"use client"`: el servidor la lee en `app-shell.tsx` y el
 * cliente la escribe en `shell-frame.tsx`; un valor exportado desde un módulo de cliente le llegaría
 * al servidor como referencia, no como texto.
 */
export const NAV_COOKIE = "speeaking-nav";
