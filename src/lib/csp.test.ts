import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce, storageOrigin } from "./csp";

function directives(policy: string) {
  return new Map(
    policy.split(";").map((part) => {
      const [name = "", ...values] = part.trim().split(/\s+/);
      return [name, values] as const;
    }),
  );
}

describe("createNonce", () => {
  it("genera 128 bits en base64, distintos en cada llamada", () => {
    const nonces = new Set(Array.from({ length: 50 }, createNonce));

    expect(nonces.size).toBe(50);
    for (const nonce of nonces) expect(nonce).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});

describe("contentSecurityPolicy (SEC-06)", () => {
  const production = directives(contentSecurityPolicy("abc", { isDev: false, isHttps: true }));

  it("solo ejecuta scripts con el nonce (strict-dynamic), nunca en línea ni eval en producción", () => {
    expect(production.get("script-src")).toEqual(["'self'", "'nonce-abc'", "'strict-dynamic'"]);
  });

  it("cierra objetos, <base>, marcos, formularios externos y conexiones a terceros", () => {
    expect(production.get("default-src")).toEqual(["'self'"]);
    expect(production.get("object-src")).toEqual(["'none'"]);
    expect(production.get("base-uri")).toEqual(["'none'"]);
    expect(production.get("frame-ancestors")).toEqual(["'none'"]);
    expect(production.get("form-action")).toEqual(["'self'"]);
    expect(production.get("connect-src")).toEqual(["'self'"]);
    expect(production.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(production.get("font-src")).toEqual(["'self'"]);
    expect(production.has("upgrade-insecure-requests")).toBe(true);
  });

  it("permite estilos en línea sin nonce (atributos style y el <style> de sonner)", () => {
    // Un nonce en style-src apagaría 'unsafe-inline' y rompería los atributos `style`.
    expect(production.get("style-src")).toEqual(["'self'", "'unsafe-inline'"]);
  });

  it("en desarrollo agrega unsafe-eval (pilas de error de React) y nunca unsafe-inline", () => {
    const dev = directives(contentSecurityPolicy("abc", { isDev: true, isHttps: false }));

    expect(dev.get("script-src")).toContain("'unsafe-eval'");
    expect(dev.get("script-src")).not.toContain("'unsafe-inline'");
    expect(dev.has("upgrade-insecure-requests")).toBe(false);
  });

  it("videos (ADR-062): solo el origen del bucket para subir y reproducir; sin bucket, nada", () => {
    expect(production.get("media-src")).toEqual(["'self'", "blob:"]);
    const withBucket = directives(
      contentSecurityPolicy("abc", {
        isDev: false,
        isHttps: true,
        storageOrigin: storageOrigin("s3", "https://cuenta.r2.cloudflarestorage.com"),
      }),
    );
    expect(withBucket.get("media-src")).toEqual([
      "'self'",
      "blob:",
      "https://cuenta.r2.cloudflarestorage.com",
    ]);
    expect(withBucket.get("connect-src")).toEqual([
      "'self'",
      "https://cuenta.r2.cloudflarestorage.com",
    ]);
    // Imágenes y scripts nunca vienen del bucket.
    expect(withBucket.get("img-src")).toEqual(["'self'", "data:", "blob:"]);
    expect(storageOrigin("local", "https://cuenta.r2.cloudflarestorage.com")).toBeNull();
    expect(storageOrigin("s3", "javascript:alert(1)")).toBeNull();
    expect(storageOrigin("s3", "https://cuenta.r2.cloudflarestorage.com/ruta?x=1")).toBe(
      "https://cuenta.r2.cloudflarestorage.com",
    );
  });

  it("pixel de TikTok (ADR-072): solo su origen, y solo con el pixel configurado", () => {
    const tiktok = "https://analytics.tiktok.com";
    const withPixel = directives(
      contentSecurityPolicy("abc", { isDev: false, isHttps: true, tiktokPixelEnabled: true }),
    );

    // Su script lo inserta el nuestro (strict-dynamic); el origen queda de respaldo sin CSP 3.
    expect(withPixel.get("script-src")).toEqual([
      "'self'",
      "'nonce-abc'",
      "'strict-dynamic'",
      tiktok,
    ]);
    expect(withPixel.get("connect-src")).toEqual(["'self'", tiktok]);
    expect(withPixel.get("img-src")).toEqual(["'self'", "data:", "blob:", tiktok]);
    // Nada más se abre: ni marcos ni formularios.
    expect(withPixel.has("frame-src")).toBe(false);
    expect(withPixel.get("form-action")).toEqual(["'self'"]);
    // Sin pixel, la política no cambia.
    for (const name of ["script-src", "connect-src", "img-src"]) {
      expect(production.get(name)).not.toContain(tiktok);
    }
  });

  it("sin https no sube las peticiones (rompería `next start` en http://localhost)", () => {
    const http = directives(contentSecurityPolicy("abc", { isDev: false, isHttps: false }));

    expect(http.has("upgrade-insecure-requests")).toBe(false);
    expect(http.get("script-src")).not.toContain("'unsafe-eval'");
  });
});
