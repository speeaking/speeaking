import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./auth-errors";

describe("authErrorMessage", () => {
  it("no revela si el correo existe al fallar el inicio de sesión", () => {
    expect(authErrorMessage({ code: "INVALID_EMAIL_OR_PASSWORD" })).toBe(
      "Correo o contraseña incorrectos.",
    );
  });

  it("sugiere iniciar sesión si la cuenta ya existe", () => {
    expect(authErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" })).toMatch(
      /inicia sesión/,
    );
  });

  // SEC-11: el texto de un correo ya registrado es el mismo que el de un alta fallida.
  it("no distingue un correo registrado de otro fallo del alta", () => {
    const existing = authErrorMessage({ code: "USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL" });

    expect(authErrorMessage({ code: "USER_ALREADY_EXISTS" })).toBe(existing);
    expect(authErrorMessage({ code: "FAILED_TO_CREATE_USER" })).toBe(existing);
    expect(existing).not.toMatch(/ya existe|ya tienes cuenta\?/i);
  });

  it("explica el bloqueo temporal por demasiados intentos", () => {
    expect(authErrorMessage({ status: 429 })).toMatch(/Demasiados intentos/);
  });

  it("usa un mensaje genérico para errores desconocidos", () => {
    expect(authErrorMessage({ code: "ALGO_RARO" })).toBe(
      "No pudimos completar la solicitud. Intenta de nuevo.",
    );
    expect(authErrorMessage(undefined)).toBe(
      "No pudimos completar la solicitud. Intenta de nuevo.",
    );
  });
});
