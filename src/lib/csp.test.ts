import { describe, expect, it } from "vitest";
import { contentSecurityPolicy, createNonce } from "./csp";

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

  it("sin https no sube las peticiones (rompería `next start` en http://localhost)", () => {
    const http = directives(contentSecurityPolicy("abc", { isDev: false, isHttps: false }));

    expect(http.has("upgrade-insecure-requests")).toBe(false);
    expect(http.get("script-src")).not.toContain("'unsafe-eval'");
  });
});
