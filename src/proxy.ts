import { getSessionCookie } from "better-auth/cookies";
import { type NextRequest, NextResponse } from "next/server";
import { contentSecurityPolicy, createNonce, NONCE_HEADER, storageOrigin } from "@/lib/csp";
import { AUTH_COOKIE_PREFIX, PROTECTED_PREFIXES } from "@/modules/identity/constants";

/**
 * Dos trabajos antes de renderizar:
 *
 * 1. Content-Security-Policy con nonce por petición (SEC-06, `src/lib/csp.ts`). Va en la respuesta
 *    y en la petición: de ahí la leen Next (para sus scripts) y el layout raíz. Por eso todas las
 *    páginas se renderizan por petición: una página estática no tendría el nonce y el navegador
 *    bloquearía sus scripts.
 * 2. Verificación OPTIMISTA de sesión: si no hay cookie en una ruta protegida, manda a iniciar
 *    sesión. No es la barrera de seguridad: cada página y acción vuelve a validar la sesión en el
 *    servidor.
 */
export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isProtected && !getSessionCookie(request, { cookiePrefix: AUTH_COOKIE_PREFIX })) {
    const login = new URL("/entrar", request.url);
    login.searchParams.set("next", `${pathname}${search}`);
    return NextResponse.redirect(login);
  }

  const nonce = createNonce();
  const policy = contentSecurityPolicy(nonce, {
    isDev: process.env.NODE_ENV === "development",
    isHttps: process.env.APP_URL?.startsWith("https://") ?? false,
    storageOrigin: storageOrigin(process.env.STORAGE_DRIVER, process.env.S3_ENDPOINT),
    googleOAuthEnabled: Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
  });
  const requestHeaders = new Headers(request.headers);
  // `set` pisa lo que mande el cliente: el nonce y la política solo los decide el servidor.
  requestHeaders.set(NONCE_HEADER, nonce);
  requestHeaders.set("content-security-policy", policy);
  const response = NextResponse.next({ request: { headers: requestHeaders } });
  if (
    isProtected ||
    ["/avisos", "/saldo", "/probar", "/buscar/foto", "/admin"].some(
      (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
    )
  )
    response.headers.set("X-Robots-Tag", "noindex, nofollow");
  response.headers.set("content-security-policy", policy);
  if (pathname === "/restablecer-contrasena") {
    response.headers.set("Referrer-Policy", "no-referrer");
    response.headers.set("Cache-Control", "no-store");
  }
  return response;
}

export const config = {
  matcher: [
    // Rutas protegidas: siempre, también en prefetch (por la redirección optimista).
    "/studio/:path*",
    "/crear/:path*",
    "/bienvenida",
    "/ajustes/:path*",
    "/perfil",
    "/carrito",
    "/checkout/:path*",
    "/pedidos/:path*",
    "/guardados",
    // Todas las páginas HTML (CSP), menos archivos estáticos, el optimizador de imágenes, las API,
    // `/media` (tiene su propia CSP de sandbox) y los prefetch de `next/link`, que no son documentos.
    {
      source:
        "/((?!api/|_next/static|_next/image|media/|favicon\\.ico|icon\\.(?:svg|png)|apple-icon\\.png|icons/|brand/|manifest\\.webmanifest).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
