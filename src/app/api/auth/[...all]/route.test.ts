import { describe, expect, it, vi } from "vitest";

// SEC-09: el router HTTP de Better Auth permitía crear cuentas sin aceptar términos y guardar nombres
// sin límite. La interfaz no lo usa, así que responde 404 sin llegar a Better Auth.
const handler = vi.hoisted(() => ({ GET: vi.fn(), POST: vi.fn() }));
vi.mock("better-auth/next-js", () => ({ toNextJsHandler: () => handler }));
vi.mock("@/server/auth", () => ({ auth: {} }));
vi.mock("@/server/env", () => ({ env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 } }));

const { GET, POST } = await import("./route");

const ORIGIN = "http://localhost:3000";

function post(path: string, body: unknown) {
  return new Request(`${ORIGIN}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", origin: ORIGIN },
    body: JSON.stringify(body),
  });
}

describe("/api/auth/*", () => {
  it.each([
    ["/api/auth/sign-up/email", { name: "x", email: "e2e@example.com", password: "clave-larga-1" }],
    ["/api/auth/sign-in/email", { email: "e2e@example.com", password: "clave-larga-1" }],
    ["/api/auth/update-user", { name: "a".repeat(1000), image: "javascript:alert(1)" }],
    ["/api/auth/change-password", { currentPassword: "a", newPassword: "b" }],
    ["/api/auth/revoke-other-sessions", {}],
    ["/api/auth/request-password-reset", { email: "e2e@example.com" }],
    // Variantes con otra forma de escribir la ruta.
    ["/api/auth/sign-up/email/", {}],
    ["/api/auth/Sign-Up/Email", {}],
    ["/api/auth/sign-up%2Femail", {}],
    ["/api/auth//sign-up/email", {}],
  ])("POST %s responde 404", async (path, body) => {
    const response = await POST(post(path, body));

    expect(response.status).toBe(404);
    expect(handler.POST).not.toHaveBeenCalled();
  });

  it.each(["/api/auth/get-session", "/api/auth/list-sessions", "/api/auth/ok"])(
    "GET %s responde 404",
    async (path) => {
      const response = await GET(new Request(`${ORIGIN}${path}`));

      expect(response.status).toBe(404);
      expect(handler.GET).not.toHaveBeenCalled();
    },
  );
});
