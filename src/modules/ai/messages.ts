import { limitOrError } from "@/server/rate-limit";
import type { AIError } from "./errors";

function wait(seconds: number) {
  const hours = Math.ceil(seconds / 3600);
  if (hours <= 36) return hours === 1 ? "1 hora" : `${hours} horas`;
  const days = Math.ceil(seconds / 86_400);
  return days === 1 ? "1 día" : `${days} días`;
}

/**
 * Mensaje para la interfaz de un error de IA, sin detalles internos. `unavailable` es el de la
 * función cuando se acaba el presupuesto o no hay IA disponible (ADR-038): debe ofrecer una salida
 * que no dependa de la IA («Por ahora … a mano»). `mode`: con la IA simulada de un piloto (ADR-038)
 * la cuota se cuenta en «usos», como en la interfaz; nunca «generaciones con IA» (`aiErrorMode`).
 */
export function aiErrorMessage(
  error: AIError,
  unavailable: string,
  mode: "real" | "simulated" = "real",
): string {
  switch (error.code) {
    case "UNAVAILABLE":
      return unavailable;
    case "RATE_LIMITED":
      return (
        (error.retryAfterSeconds
          ? limitOrError({ ok: false, retryAfterSeconds: error.retryAfterSeconds })
          : null) ?? "Hiciste muchas solicitudes seguidas. Espera un momento y vuelve a intentar."
      );
    case "QUOTA_EXCEEDED": {
      const when = error.retryAfterSeconds ? ` Se libera en ${wait(error.retryAfterSeconds)}.` : "";
      const what = mode === "simulated" ? "usos" : "generaciones con IA";
      return error.scope === "month"
        ? `Llegaste al límite de ${what} de este mes.${when}`
        : `Llegaste al límite de ${what} de hoy.${when}`;
    }
    case "BUDGET_EXCEEDED":
      return unavailable;
    case "DAILY_CAP":
      return "Hoy se acabaron las pruebas gratis. Mañana vuelven; con saldo puedes seguir ahora.";
    case "INVALID_OUTPUT":
      return "La IA respondió algo que no pudimos validar. Intenta de nuevo.";
    case "NOT_ALLOWED":
      return "No podemos ayudarte a vender este producto con IA.";
    case "PROVIDER_ERROR":
      return "La IA no está disponible en este momento. Intenta de nuevo.";
  }
}
