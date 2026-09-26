import { beforeEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

// La ruta real con el entorno, el limitador y la operación diaria simulados.
const state = vi.hoisted(() => ({ secret: undefined as string | undefined }));

vi.mock("@/server/env", () => ({
  env: {
    get CRON_SECRET() {
      return state.secret;
    },
    NODE_ENV: "test",
    TRUSTED_PROXY_HOPS: 0,
  },
}));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true })),
  rateLimitMany: vi.fn(async () => ({ ok: true })),
  rateLimitKey: vi.fn(() => null),
}));
vi.mock("@/modules/ceo/scheduled", () => ({
  runScheduledDailyPipeline: vi.fn(async () => ({ skipped: false, day: "2026-09-25", steps: {} })),
}));

const { GET, POST } = await import("@/app/api/cron/daily/route");
const { runScheduledDailyPipeline } = await import("@/modules/ceo/scheduled");
const { rateLimit, rateLimitMany } = await import("@/server/rate-limit");

/**
 * El 404 de `notFound()`: la ruta no arma su propia respuesta; Next responde igual que a cualquier
 * otro `notFound()` de un route handler (404 sin cuerpo; no es la página HTML de una URL inexistente).
 */
async function expectNextNotFound(response: Promise<Response>) {
  await expect(response).rejects.toMatchObject({ digest: "NEXT_HTTP_ERROR_FALLBACK;404" });
}

const SECRET = "s".repeat(24) + "-secreto-de-prueba-cron";

function request(method: "GET" | "POST", authorization?: string) {
  return new Request("http://localhost/api/cron/daily", {
    method,
    headers: authorization ? { authorization } : {},
  });
}

beforeEach(() => {
  state.secret = SECRET;
  vi.mocked(runScheduledDailyPipeline).mockClear();
  vi.mocked(rateLimit).mockResolvedValue({ ok: true });
  vi.mocked(rateLimitMany).mockResolvedValue({ ok: true });
});

describe("autorización del cron", () => {
  it("compara el Bearer en tiempo constante y exige el formato exacto", () => {
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, SECRET)).toBe(true);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}x`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`bearer ${SECRET}`, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(SECRET, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(null, SECRET)).toBe(false);
    expect(isAuthorizedCronRequest(`Bearer ${SECRET}`, undefined)).toBe(false);
  });
});

describe("/api/cron/daily", () => {
  it("sin secreto en la petición: el 404 de Next y no corre nada", async () => {
    await expectNextNotFound(POST(request("POST")));
    await expectNextNotFound(GET(request("GET")));
    expect(runScheduledDailyPipeline).not.toHaveBeenCalled();
  });

  it("con un secreto equivocado: el 404 de Next", async () => {
    await expectNextNotFound(
      POST(request("POST", "Bearer otro-secreto-cualquiera-de-32-caracteres")),
    );
    expect(runScheduledDailyPipeline).not.toHaveBeenCalled();
  });

  it("sin CRON_SECRET configurado, ni con el valor correcto pasa", async () => {
    state.secret = undefined;
    await expectNextNotFound(POST(request("POST", `Bearer ${SECRET}`)));
    expect(runScheduledDailyPipeline).not.toHaveBeenCalled();
  });

  it("demasiados intentos desde la IP, o el limitador sin base: el mismo 404 (nunca un 500)", async () => {
    vi.mocked(rateLimitMany).mockResolvedValueOnce({ ok: false, retryAfterSeconds: 60 });
    await expectNextNotFound(POST(request("POST", `Bearer ${SECRET}`)));

    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(rateLimitMany).mockRejectedValueOnce(new Error("postgres://user:pw@x caída"));
    await expectNextNotFound(POST(request("POST")));
    expect(String(log.mock.calls[0]?.[0])).not.toContain("pw");
    log.mockRestore();
    expect(runScheduledDailyPipeline).not.toHaveBeenCalled();
  });

  it("con el secreto correcto: 200 y corre la operación diaria (GET de Vercel Cron o POST)", async () => {
    const post = await POST(request("POST", `Bearer ${SECRET}`));
    expect(post.status).toBe(200);
    expect(await post.json()).toMatchObject({ skipped: false });
    const get = await GET(request("GET", `Bearer ${SECRET}`));
    expect(get.status).toBe(200);
    expect(runScheduledDailyPipeline).toHaveBeenCalledTimes(2);
    expect(post.headers.get("cache-control")).toBe("no-store");
  });

  it("autorizado pero sobre el tope global: 429 sin correr", async () => {
    vi.mocked(rateLimit).mockResolvedValue({ ok: false, retryAfterSeconds: 120 });
    const response = await POST(request("POST", `Bearer ${SECRET}`));
    expect(response.status).toBe(429);
    expect(runScheduledDailyPipeline).not.toHaveBeenCalled();
  });

  it("si la operación falla responde 500 sin detalles internos y deja un rastro sin secretos", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => undefined);
    vi.mocked(runScheduledDailyPipeline).mockRejectedValueOnce(new Error("postgres://user:pw@x"));
    const response = await POST(request("POST", `Bearer ${SECRET}`));
    expect(response.status).toBe(500);
    expect(await response.text()).not.toContain("postgres");
    expect(log).toHaveBeenCalledTimes(1);
    expect(String(log.mock.calls[0]?.[0])).not.toContain("pw");
    log.mockRestore();
  });
});
