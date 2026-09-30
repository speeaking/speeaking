import { describe, expect, it, vi } from "vitest";

// ADR-049: con credenciales de Google, el router HTTP abre SOLO el callback de OAuth; todo lo demás
// sigue en 404 (SEC-09). El inicio del flujo va por una Server Action, no por el router.
const handler = vi.hoisted(() => ({
  GET: vi.fn(async () => new Response("ok", { status: 200 })),
  POST: vi.fn(async () => new Response("ok", { status: 200 })),
}));
vi.mock("better-auth/next-js", () => ({ toNextJsHandler: () => handler }));
vi.mock("@/server/auth", () => ({ auth: {} }));
vi.mock("@/server/env", () => ({ env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 } }));
vi.mock("@/modules/identity/social", () => ({
  googleSignInEnabled: () => true,
  GOOGLE_CALLBACK_PATH: "/callback/google",
}));

const { GET, POST } = await import("./route");

const ORIGIN = "http://localhost:3000";

describe("/api/auth/* con Google configurado", () => {
  it("deja pasar el callback de Google (GET) hasta Better Auth", async () => {
    const response = await GET(new Request(`${ORIGIN}/api/auth/callback/google?code=x&state=y`));

    expect(response.status).toBe(200);
    expect(handler.GET).toHaveBeenCalledTimes(1);
  });

  it.each([
    "/api/auth/callback/github",
    "/api/auth/sign-in/social",
    "/api/auth/callback/google/",
    "/api/auth/Callback/google",
    "/api/auth/link-social",
  ])("%s sigue en 404", async (path) => {
    handler.GET.mockClear();
    handler.POST.mockClear();
    const get = await GET(new Request(`${ORIGIN}${path}`));
    const post = await POST(new Request(`${ORIGIN}${path}`, { method: "POST" }));

    expect(get.status).toBe(404);
    expect(post.status).toBe(404);
    expect(handler.GET).not.toHaveBeenCalled();
    expect(handler.POST).not.toHaveBeenCalled();
  });
});
