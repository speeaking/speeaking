import { describe, expect, it } from "vitest";
import { safeRedirectPath } from "./safe-redirect";

describe("safeRedirectPath", () => {
  it.each([
    ["/studio", "/studio"],
    ["/producto/airpods?ref=feed", "/producto/airpods?ref=feed"],
    // Los segmentos `.`/`..` que no salen del sitio se normalizan y siguen siendo válidos.
    ["/a/../studio", "/studio"],
    ["/./pedidos", "/pedidos"],
  ])("permite rutas internas: %s", (input, expected) => {
    expect(safeRedirectPath(input)).toBe(expected);
  });

  it.each([
    "//evil.com",
    "https://evil.com",
    "/\\evil.com",
    "javascript:alert(1)",
    "studio",
    "",
    undefined,
    null,
    42,
  ])("bloquea destinos externos o inválidos: %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/");
  });

  // SEC-04: la entrada pasa el primer filtro, pero `new URL` la normaliza a `//evil.example…`.
  it.each([
    "/.//evil.example",
    "/.//evil.example/phish",
    "/%2e//evil.example",
    "/%2E//evil.example",
    "/%2e%2e//evil.example",
    "/%2E%2E//evil.example",
    "/..//evil.example",
    "/a/..//evil.example",
    "/a/b/../..//evil.example",
    "/%2e/%2e//evil.example",
    "/./\\evil.example",
    "/../\\evil.example",
    "/.\t//evil.example",
    "/.//evil.example?next=/studio",
  ])("bloquea rutas que se normalizan a una referencia de red: %j", (input) => {
    expect(safeRedirectPath(input)).toBe("/");
    expect(safeRedirectPath(input, "")).toBe("");
  });

  it("usa el valor por defecto indicado", () => {
    expect(safeRedirectPath("https://evil.com", "/bienvenida")).toBe("/bienvenida");
  });
});
