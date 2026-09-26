import type { NextConfig } from "next";

/**
 * Cabeceras de seguridad base para todas las rutas. La Content-Security-Policy NO va aquí: lleva un
 * nonce por petición y la pone `src/proxy.ts` (`src/lib/csp.ts`, ADR-029). Una CSP estática aquí se
 * sumaría a la del proxy y, sin el nonce, bloquearía todos los scripts.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
  },
  // Otra pestaña abierta con `window.open` no conserva referencia a la nuestra (ni al revés), y
  // otros sitios no pueden incrustar nuestras respuestas (fotos, JSON) como recurso.
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  { key: "Cross-Origin-Resource-Policy", value: "same-origin" },
  ...(process.env.NODE_ENV === "production"
    ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }]
    : []),
];

const nextConfig: NextConfig = {
  reactCompiler: true,
  typedRoutes: true,
  poweredByHeader: false,
  // La barra inferior móvil ocupa ambas esquinas; los errores de compilación se siguen mostrando.
  devIndicators: false,
  images: {
    // Las fotos subidas NO pasan por el optimizador de Next (`/_next/image`): guardaba copias propias
    // y las seguía sirviendo después de ocultar o borrar la foto. `next/image` las pide a nuestra
    // ruta `/media/<clave>?w=<ancho>` (`src/lib/image-loader.ts`), que autoriza cada petición
    // (ADR-039). Con un loader propio, `/_next/image` responde 404 a todo.
    loader: "custom",
    loaderFile: "./src/lib/image-loader.ts",
    // Juntos son `MEDIA_WIDTHS` de `src/lib/image-loader.ts` (los únicos anchos que acepta `/media`),
    // así el `srcset` no repite URLs. `image-loader.test.ts` comprueba que coincidan.
    imageSizes: [256, 384],
    deviceSizes: [640, 828, 1080, 1600],
    // Defensa en profundidad si alguien vuelve al loader por omisión: el optimizador no aceptaría
    // ninguna ruta propia (Next solo agrega sus imports estáticos), ningún origen remoto ni SVG.
    localPatterns: [],
    remotePatterns: [],
    dangerouslyAllowSVG: false,
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
