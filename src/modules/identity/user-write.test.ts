import { isAPIError } from "better-auth/api";
import { describe, expect, it } from "vitest";
import { sanitizeUserWrite } from "./user-write";

// SEC-09: `POST /api/auth/update-user` guardaba un nombre de 1,000,000 de caracteres y
// `image: "javascript:…"`. Los hooks de Better Auth pasan todo por aquí.
describe("sanitizeUserWrite", () => {
  it("recorta el nombre y siempre deja `image` vacía", () => {
    expect(
      sanitizeUserWrite({ name: "  Ana López ", email: "ana@example.com", image: "https://x" }),
    ).toEqual({ name: "Ana López", email: "ana@example.com", image: null });
  });

  it("no deja entrar un correo `.invalid` (cuentas de la plataforma, ADR-066)", () => {
    let thrown: unknown;
    try {
      sanitizeUserWrite({ name: "Ana", email: "editorial.comida@speeaking.invalid" });
    } catch (error) {
      thrown = error;
    }

    expect(isAPIError(thrown)).toBe(true);
    expect((thrown as { body?: { code?: string } }).body?.code).toBe("INVALID_EMAIL");
  });

  it("descarta un `image` con `javascript:` aunque no cambie el nombre", () => {
    expect(sanitizeUserWrite({ image: "javascript:alert(document.domain)" })).toEqual({
      image: null,
    });
    expect(sanitizeUserWrite({ emailVerified: true })).toEqual({
      emailVerified: true,
      image: null,
    });
  });

  it.each([
    ["demasiado largo", "a".repeat(1_000_000)],
    ["61 caracteres", "a".repeat(61)],
    ["vacío", "   "],
    ["no es texto", 42],
    ["suplanta a la plataforma (SEC-18)", "Equipo speeaking"],
  ])("rechaza un nombre %s", (_label, name) => {
    let thrown: unknown;
    try {
      sanitizeUserWrite({ name });
    } catch (error) {
      thrown = error;
    }

    expect(isAPIError(thrown)).toBe(true);
    expect((thrown as { body?: { code?: string } }).body?.code).toBe("INVALID_NAME");
  });
});
