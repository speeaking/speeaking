import "server-only";
import { env } from "@/server/env";

/**
 * Entrar con Google (ADR-049): solo cuando el fundador configura las credenciales de OAuth
 * (`GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`). Sin ellas no hay botón ni callback abierto: la
 * interfaz y el router HTTP consultan aquí.
 */
export function googleSignInEnabled(): boolean {
  return Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET);
}

/** Rutas del router HTTP de Better Auth que abre el inicio con Google (el callback de OAuth). */
export const GOOGLE_CALLBACK_PATH = "/callback/google";
