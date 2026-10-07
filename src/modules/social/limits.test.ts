import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as RateLimitModule from "@/server/rate-limit";

const clientIp = vi.hoisted(() => vi.fn());
const rateLimitMany = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/client-ip", () => ({ clientIp, ipNetwork: (ip: string) => ip }));
vi.mock("@/server/rate-limit", async (importActual) => ({
  ...(await importActual<typeof RateLimitModule>()),
  rateLimitMany,
}));

const { checkSocialLimit, SOCIAL_LIMITS } = await import("./limits");

const USER = "0199a000-0000-7000-8000-00000000000a";

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMany.mockResolvedValue({ ok: true });
});

describe("checkSocialLimit (SEC-15)", () => {
  it("revisa primero la IP y luego la cuenta, con llaves por acción", async () => {
    clientIp.mockReturnValue("203.0.113.7");

    await expect(checkSocialLimit("post", USER)).resolves.toEqual({ ok: true });

    expect(rateLimitMany).toHaveBeenCalledWith([
      { key: "post:ip:203.0.113.7", limit: 30, windowSeconds: 3600 },
      { key: `post:user:${USER}`, limit: 10, windowSeconds: 3600 },
      { key: `post.day:user:${USER}`, limit: 50, windowSeconds: 86_400 },
    ]);
  });

  it("sin IP confiable la regla por IP se omite (key null) y la de cuenta sigue", async () => {
    clientIp.mockReturnValue(null);

    await checkSocialLimit("follow", USER);

    expect(rateLimitMany.mock.calls[0]![0]).toEqual([
      { key: null, limit: 300, windowSeconds: 3600 },
      { key: `follow:user:${USER}`, limit: 100, windowSeconds: 3600 },
    ]);
  });

  it("sin sesión (compartir) solo aplica la IP", async () => {
    clientIp.mockReturnValue("203.0.113.7");

    await checkSocialLimit("share", null);

    expect(rateLimitMany.mock.calls[0]![0].map((rule: { key: string | null }) => rule.key)).toEqual(
      ["share:ip:203.0.113.7", null],
    );
  });

  it("con el límite agotado devuelve el mensaje en español y la espera", async () => {
    clientIp.mockReturnValue(null);
    rateLimitMany.mockResolvedValue({ ok: false, retryAfterSeconds: 700 });

    await expect(checkSocialLimit("comment", USER)).resolves.toEqual({
      ok: false,
      error: "Demasiados intentos. Intenta de nuevo en 12 minutos.",
      retryAfterSeconds: 700,
    });
  });

  it("todas las acciones tienen al menos una regla por cuenta y límites holgados pero finitos", () => {
    for (const [action, rules] of Object.entries(SOCIAL_LIMITS)) {
      expect(rules.some((rule) => rule.subject === "user")).toBe(true);
      for (const rule of rules) {
        // Crear una comunidad es raro y abre un espacio público nuevo: 3 al día por cuenta.
        expect(rule.limit).toBeGreaterThanOrEqual(action === "createCommunity" ? 3 : 5);
        expect(Number.isInteger(rule.windowSeconds)).toBe(true);
      }
    }
  });
});
