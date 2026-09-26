import { describe, expect, it, vi } from "vitest";

// La configuración real de Better Auth, sin base de datos: las rutas desactivadas responden antes de
// tocarla. Es la segunda barrera de SEC-09 por si el router `/api/auth` se abre por error.
vi.mock("./db", () => ({ db: {} }));
vi.mock("./env", () => ({
  env: {
    NODE_ENV: "test",
    APP_URL: "http://localhost:3000",
    BETTER_AUTH_SECRET: "secreto-de-pruebas-de-32-caracteres-o-mas",
    TRUSTED_PROXY_HOPS: 0,
  },
}));

const { auth } = await import("./auth");

const ORIGIN = "http://localhost:3000";

describe("auth (SEC-09)", () => {
  it.each([
    "/sign-up/email",
    "/sign-in/email",
    "/update-user",
    "/change-password",
    "/delete-user",
    "/request-password-reset",
    "/revoke-sessions",
    "/revoke-other-sessions",
  ])("el router responde 404 a %s aunque llegue a Better Auth", async (path) => {
    const response = await auth.handler(
      new Request(`${ORIGIN}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: ORIGIN },
        body: JSON.stringify({ name: "a".repeat(1000), email: "e2e@example.com", password: "x" }),
      }),
    );

    expect(response.status).toBe(404);
  });

  it.each(["/list-sessions", "/list-accounts"])("el router responde 404 a GET %s", async (path) => {
    const response = await auth.handler(new Request(`${ORIGIN}/api/auth${path}`));

    expect(response.status).toBe(404);
  });

  it("las Server Actions siguen teniendo `auth.api.*`", () => {
    expect(typeof auth.api.signUpEmail).toBe("function");
    expect(typeof auth.api.signInEmail).toBe("function");
    expect(typeof auth.api.revokeSessions).toBe("function");
  });
});
