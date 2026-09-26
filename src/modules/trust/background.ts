import "server-only";
import { after } from "next/server";
import { refreshAiSignal } from "./service";

/**
 * Pide la señal OPCIONAL de la IA después de responder (no retrasa el guardado del producto). Si el
 * ajuste `trust.aiSignal.enabled` está apagado (por omisión), no hace nada.
 */
export function scheduleAuthenticityAiSignal(productId: string) {
  after(async () => {
    await refreshAiSignal(productId);
  });
}
