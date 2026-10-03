import "server-only";
import { headers } from "next/headers";
import { after } from "next/server";
import { clientIp } from "@/server/client-ip";
import { db } from "@/server/db";
import { prepareEvent, type TrackedEvent } from "./event";
import { filterTrustedEvents, needsClientIp, type TrackContext } from "./integrity";
import { isPersonalizationEnabled } from "./personalization";

/**
 * Guarda eventos de inmediato (útil en pruebas y scripts). Nunca lanza errores al llamador. Antes
 * descarta los repetidos y los que apuntan a algo que no existe (SEC-20, `integrity.ts`); `context.ip`
 * es la IP del cliente para deduplicar lo anónimo.
 */
export async function recordEvents(events: TrackedEvent[], context: TrackContext = { ip: null }) {
  if (events.length === 0) return;
  try {
    const trusted = await filterTrustedEvents(events, context);
    if (trusted.length === 0) return;
    const enabled = await isPersonalizationEnabled(trusted[0]?.userId);
    await db.analyticsEvent.createMany({
      data: trusted.map((event) => prepareEvent(event, enabled)),
    });
  } catch (error) {
    console.error("[analytics] no se pudieron guardar eventos", error);
  }
}

/**
 * Registra eventos en segundo plano (después de enviar la respuesta), sin bloquear al usuario.
 * Todos los eventos de una llamada deben pertenecer a la misma persona.
 */
export function track(...events: TrackedEvent[]) {
  // Las cabeceras se leen ahora, dentro de la petición: en `after` un Server Component ya no puede.
  const ip = needsClientIp(events) ? currentClientIp() : Promise.resolve(null);
  const userAgent = currentUserAgent();
  after(async () => {
    // Un rastreo de buscador no representa interés de una persona ni una visita de campaña.
    if (
      /bot\b|crawler|spider|slurp|facebookexternalhit|chatgpt-user|googleother/i.test(
        await userAgent,
      )
    )
      return;
    await recordEvents(events, { ip: await ip });
  });
}

function currentUserAgent(): Promise<string> {
  try {
    return headers().then(
      (value) => value.get("user-agent") ?? "",
      () => "",
    );
  } catch {
    return Promise.resolve("");
  }
}

/** IP del cliente de esta petición (`null` sin proxies de confianza o fuera de una petición). */
function currentClientIp(): Promise<string | null> {
  try {
    return headers().then(clientIp, () => null);
  } catch {
    return Promise.resolve(null);
  }
}
