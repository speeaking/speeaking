/**
 * Vibración mínima al tocar (ADR-052): 10 ms, lo que se siente como un «clic» y no como una alerta.
 * Solo donde el navegador la expone (Android; iOS no), nunca con «menos movimiento» activado y nunca
 * falla: si algo no existe, simplemente no vibra.
 */
export const TAP_MS = 10;

export function tapHaptic(duration = TAP_MS): boolean {
  try {
    if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return false;
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    ) {
      return false;
    }
    return navigator.vibrate(duration);
  } catch {
    return false;
  }
}
