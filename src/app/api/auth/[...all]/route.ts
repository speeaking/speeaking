import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/server/auth";
import { withClientIpRequest } from "@/server/client-ip";

/**
 * Router HTTP de Better Auth, cerrado por omisión (SEC-09). La interfaz no lo usa: registro, inicio y
 * cierre de sesión van por Server Actions que llaman `auth.api.*` con validación, consentimiento y
 * límites propios. Abierto, permitía crear cuentas sin aceptar términos (`/sign-up/email`) o guardar
 * nombres sin límite (`/update-user`).
 *
 * Solo pasan las rutas de `ALLOWED_PATHS`, comparadas tal cual (sin decodificar ni normalizar:
 * cualquier variante rara es 404). Hoy ninguna; aquí entrarán los callbacks de verificación de correo
 * u OAuth cuando existan.
 */
const ALLOWED_PATHS: ReadonlySet<string> = new Set<string>([]);
const BASE_PATH = "/api/auth";

const handler = toNextJsHandler(auth);

function isAllowed(request: Request) {
  const { pathname } = new URL(request.url);
  return (
    pathname.startsWith(`${BASE_PATH}/`) && ALLOWED_PATHS.has(pathname.slice(BASE_PATH.length))
  );
}

function notFound() {
  return new Response("Not Found", { status: 404 });
}

// Better Auth ve la misma IP que el resto de la app (SEC-07).
export async function GET(request: Request) {
  return isAllowed(request) ? handler.GET(withClientIpRequest(request)) : notFound();
}

export async function POST(request: Request) {
  return isAllowed(request) ? handler.POST(withClientIpRequest(request)) : notFound();
}
