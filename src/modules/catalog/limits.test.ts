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

const { checkCatalogLimit, CATALOG_LIMITS } = await import("./limits");

const USER = "0199a000-0000-7000-8000-00000000000a";

beforeEach(() => {
  vi.clearAllMocks();
  rateLimitMany.mockResolvedValue({ ok: true });
});

describe("checkCatalogLimit (SEC-15)", () => {
  it("crear productos: primero la IP, luego la cuenta por hora y por día", async () => {
    clientIp.mockReturnValue("203.0.113.7");

    await expect(checkCatalogLimit("create", USER)).resolves.toBeNull();

    expect(rateLimitMany).toHaveBeenCalledWith([
      { key: "product.create:ip:203.0.113.7", limit: 60, windowSeconds: 3600 },
      { key: `product.create:user:${USER}`, limit: 30, windowSeconds: 3600 },
      { key: `product.create.day:user:${USER}`, limit: 150, windowSeconds: 86_400 },
    ]);
  });

  it("sin IP confiable la regla por IP se omite (key null) y las de cuenta siguen", async () => {
    clientIp.mockReturnValue(null);

    await checkCatalogLimit("create", USER);

    expect(rateLimitMany.mock.calls[0]![0].map((rule: { key: string | null }) => rule.key)).toEqual(
      [null, `product.create:user:${USER}`, `product.create.day:user:${USER}`],
    );
  });

  it("con el límite agotado devuelve el mensaje en español con la espera", async () => {
    clientIp.mockReturnValue(null);
    rateLimitMany.mockResolvedValue({ ok: false, retryAfterSeconds: 700 });

    await expect(checkCatalogLimit("create", USER)).resolves.toMatch(/Demasiados intentos/);
  });

  it("toda regla tiene tope positivo y ventana de al menos un minuto", () => {
    for (const rules of Object.values(CATALOG_LIMITS)) {
      for (const rule of rules) {
        expect(rule.limit).toBeGreaterThan(0);
        expect(rule.windowSeconds).toBeGreaterThanOrEqual(60);
      }
    }
  });
});
