import { notFound } from "next/navigation";
import { isAuthorizedCronRequest } from "@/modules/ceo/cron-auth";
import { safeErrorMessage } from "@/modules/ceo/jobs";
import { runScheduledDailyPipeline } from "@/modules/ceo/scheduled";
import { clientIp } from "@/server/client-ip";
import { env } from "@/server/env";
import { rateLimit, rateLimitKey, rateLimitMany } from "@/server/rate-limit";

/**
 * Operación diaria para producción (Vercel Cron → `Authorization: Bearer <CRON_SECRET>`). A quien no
 * trae el secreto correcto se le responde con `notFound()`; también si el limitador de intentos no se
 * puede consultar (sin base, un 500 la delataría). En un route handler, Next responde a `notFound()`
 * un 404 SIN cuerpo: igual al de cualquier otro route handler, pero distinto de la página HTML de «no
 * encontrado» de una URL que no existe. Quien compare cuerpos puede saber que la ruta existe (no que
 * el secreto sea casi correcto); ocultarla del todo pide reescribirla en `src/proxy.ts`. Vercel Cron
 * llama con GET; POST sirve para dispararlo a mano (`curl -X POST`).
 */
export const maxDuration = 300;

const HOUR = 60 * 60;

async function handle(request: Request): Promise<Response> {
  const secret = env.CRON_SECRET;
  if (!secret) notFound();

  // Intentos por IP (si hay una confiable) antes de comparar: frena la fuerza bruta sin revelar nada.
  const ip = clientIp(request.headers);
  const perIp = await rateLimitMany([
    { key: rateLimitKey("cron", "ip", ip), limit: 30, windowSeconds: HOUR },
  ]).catch((error: unknown) => {
    console.error(`[cron] no se pudo consultar el límite: ${safeErrorMessage(error)}`);
    return null;
  });
  if (!perIp?.ok) notFound();
  if (!isAuthorizedCronRequest(request.headers.get("authorization"), secret)) notFound();

  // Ya autorizado: un tope global evita ejecuciones desbocadas (la tarea es diaria).
  const global = await rateLimit({ key: "cron:daily:global", limit: 6, windowSeconds: HOUR });
  if (!global.ok) {
    return Response.json(
      { error: "Demasiadas ejecuciones; intenta más tarde." },
      {
        status: 429,
        headers: { "Retry-After": String(global.retryAfterSeconds), "Cache-Control": "no-store" },
      },
    );
  }

  try {
    const summary = await runScheduledDailyPipeline();
    return Response.json(summary, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // Si falló antes de registrar su JobRun (p. ej. sin base), este es el único rastro.
    console.error(`[cron] la operación diaria falló: ${safeErrorMessage(error)}`);
    return Response.json(
      { error: "La operación diaria falló; revisa JobRun." },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

export function GET(request: Request) {
  return handle(request);
}

export function POST(request: Request) {
  return handle(request);
}
