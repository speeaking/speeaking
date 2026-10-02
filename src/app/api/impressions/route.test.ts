import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as ClientIpModule from "@/server/client-ip";
import type * as RateLimitModule from "@/server/rate-limit";

const getViewer = vi.hoisted(() => vi.fn());
const headers = vi.hoisted(() => vi.fn());
const clientIp = vi.hoisted(() => vi.fn());
const rateLimitMany = vi.hoisted(() => vi.fn());
const recordVisibleImpressions = vi.hoisted(() => vi.fn());

vi.mock("next/headers", () => ({ headers }));
vi.mock("@/modules/identity/session", () => ({ getViewer }));
vi.mock("@/server/client-ip", async (importActual) => ({
  ...(await importActual<typeof ClientIpModule>()),
  clientIp,
}));
vi.mock("@/server/rate-limit", async (importActual) => ({
  ...(await importActual<typeof RateLimitModule>()),
  rateLimitMany,
}));
vi.mock("@/modules/analytics/visible-impressions", () => ({ recordVisibleImpressions }));
vi.mock("@/server/db", () => ({ db: {} }));
vi.mock("@/server/env", () => ({
  env: {
    BETTER_AUTH_SECRET: "s".repeat(32),
    TRUSTED_PROXY_HOPS: 0,
    NODE_ENV: "test",
    APP_URL: "https://speeaking.example",
  },
}));

const { IMPRESSIONS_LIMITS, POST } = await import("./route");

const USER = "0199a000-0000-7000-8000-000000000001";
const POST_ID = "0199a000-0000-7000-8000-0000000000a1";
const item = { postId: POST_ID, surface: "FEED", position: 2 };

function request(body: unknown, init: { headers?: Record<string, string | null> } = {}) {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  const merged: Record<string, string | null> = {
    "content-type": "text/plain;charset=UTF-8",
    "sec-fetch-site": "same-origin",
    ...init.headers,
  };
  const headers = new Headers();
  for (const [name, value] of Object.entries(merged)) if (value !== null) headers.set(name, value);
  return new Request("https://speeaking.example/api/impressions", {
    method: "POST",
    body: text,
    headers,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue({ userId: USER });
  headers.mockResolvedValue(new Headers());
  clientIp.mockReturnValue("203.0.113.7");
  rateLimitMany.mockResolvedValue({ ok: true });
  recordVisibleImpressions.mockResolvedValue({
    recorded: 1,
    duplicates: 0,
    rejected: 0,
    failed: 0,
  });
});

describe("POST /api/impressions (T5)", () => {
  it("acepta lo que manda sendBeacon (text/plain) y le pasa la persona y la IP al registro", async () => {
    const response = await POST(request({ items: [item] }));

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(await response.json()).toEqual({ recorded: 1, duplicates: 0, rejected: 0, failed: 0 });
    expect(recordVisibleImpressions).toHaveBeenCalledWith({
      viewerId: USER,
      ip: "203.0.113.7",
      items: [item],
    });
  });

  type Rule = { key: string | null; limit: number; windowSeconds: number };
  const rules = () => rateLimitMany.mock.calls[0]![0] as Rule[];

  it("con sesión: primero la cuenta y después un techo alto por IP, antes de leer el cuerpo", async () => {
    await POST(request({ items: [item] }));
    // La cuenta primero: quien pasa su tope no gasta el cupo de la IP que comparte (ADR-037).
    expect(rules()).toEqual([
      { key: `impressions:user:${USER}`, ...IMPRESSIONS_LIMITS.user },
      { key: "impressions.signed-in:ip:203.0.113.7", ...IMPRESSIONS_LIMITS.signedInIp },
    ]);
    // Una IP de operador compartida por muchas personas con sesión no las deja fuera.
    expect(IMPRESSIONS_LIMITS.signedInIp.limit).toBeGreaterThanOrEqual(2_000);
    expect(IMPRESSIONS_LIMITS.user.limit).toBe(60);

    rateLimitMany.mockResolvedValue({ ok: false, retryAfterSeconds: 42 });
    const limited = await POST(request({ items: [item] }));
    expect(limited.status).toBe(429);
    expect(limited.headers.get("Retry-After")).toBe("42");
    expect(recordVisibleImpressions).toHaveBeenCalledTimes(1);
  });

  it("sin sesión: los límites de siempre por IP (240/min, llave aparte de la de sesión)", async () => {
    getViewer.mockResolvedValue(null);
    await POST(request({ items: [item] }));
    expect(rules()).toEqual([
      { key: "impressions:ip:203.0.113.7", limit: 240, windowSeconds: 60 },
      { key: null, ...IMPRESSIONS_LIMITS.anonymous },
    ]);
  });

  it("con sesión y sin IP de confianza: solo el tope por cuenta", async () => {
    clientIp.mockReturnValue(null);
    await POST(request({ items: [item] }));
    expect(rules().map((rule) => rule.key)).toEqual([`impressions:user:${USER}`, null]);
  });

  it("sin sesión ni IP de confianza usa un tope común (no se queda sin límite)", async () => {
    getViewer.mockResolvedValue(null);
    clientIp.mockReturnValue(null);
    await POST(request({ items: [item] }));
    expect(rules().map((rule) => rule.key)).toEqual([null, "impressions:anon:all"]);
    expect(recordVisibleImpressions).toHaveBeenCalledWith(
      expect.objectContaining({ viewerId: null, ip: null }),
    );
  });

  it.each([
    ["no es JSON", "impresiones"],
    ["sin piezas", { items: [] }],
    ["id que no es UUID", { items: [{ ...item, postId: "../../etc" }] }],
    ["superficie que no es del feed", { items: [{ ...item, surface: "PROFILE" }] }],
    ["posición negativa", { items: [{ ...item, position: -1 }] }],
    [
      "campos de más (la versión y el espacio los pone el servidor)",
      { items: [{ ...item, slot: "commerce" }] },
    ],
    ["más de 50 piezas", { items: Array.from({ length: 51 }, () => item) }],
  ])("cuerpo inválido (%s): 400 sin registrar nada", async (_label, body) => {
    const response = await POST(request(body));
    expect(response.status).toBe(400);
    expect(recordVisibleImpressions).not.toHaveBeenCalled();
  });

  it("desde otro sitio: 403 (nadie manda impresiones con las cookies de la persona)", async () => {
    const response = await POST(
      request({ items: [item] }, { headers: { "sec-fetch-site": "cross-site" } }),
    );
    expect(response.status).toBe(403);
    expect(rateLimitMany).not.toHaveBeenCalled();
    expect(recordVisibleImpressions).not.toHaveBeenCalled();
  });

  it("un cuerpo demasiado grande se corta: 413", async () => {
    const big = JSON.stringify({ items: [item], padding: "x".repeat(20_000) });
    const response = await POST(request(big));
    expect(response.status).toBe(413);
    expect(recordVisibleImpressions).not.toHaveBeenCalled();
  });

  describe("origen sin Sec-Fetch-Site (navegadores viejos): el Origin debe ser el de la app", () => {
    it("mismo origen: se registra", async () => {
      const response = await POST(
        request(
          { items: [item] },
          { headers: { "sec-fetch-site": null, origin: "https://speeaking.example" } },
        ),
      );
      expect(response.status).toBe(200);
      expect(recordVisibleImpressions).toHaveBeenCalledTimes(1);
    });

    it.each([
      ["otro sitio", "https://otro.example"],
      ["subdominio", "https://tienda.speeaking.example"],
      ["otro esquema", "http://speeaking.example"],
      ["otro puerto", "https://speeaking.example:8443"],
      ["origen opaco", "null"],
    ])("%s: 403 sin tocar la base", async (_label, origin) => {
      const response = await POST(
        request({ items: [item] }, { headers: { "sec-fetch-site": null, origin } }),
      );
      expect(response.status).toBe(403);
      expect(getViewer).not.toHaveBeenCalled();
      expect(rateLimitMany).not.toHaveBeenCalled();
      expect(recordVisibleImpressions).not.toHaveBeenCalled();
    });

    it("Sec-Fetch-Site manda sobre el Origin", async () => {
      const response = await POST(
        request(
          { items: [item] },
          { headers: { "sec-fetch-site": "same-site", origin: "https://speeaking.example" } },
        ),
      );
      expect(response.status).toBe(403);
    });

    it("sin ninguno de los dos (no es un navegador en otra página): pasa a los límites", async () => {
      const response = await POST(
        request({ items: [item] }, { headers: { "sec-fetch-site": null } }),
      );
      expect(response.status).toBe(200);
      expect(rateLimitMany).toHaveBeenCalledTimes(1);
    });
  });

  describe("nunca 500: si la base falla, 200 con las piezas en `failed`", () => {
    const quiet = () => vi.spyOn(console, "error").mockImplementation(() => {});

    it("la sesión no se puede leer: no registra nada (ni como anónimo)", async () => {
      const log = quiet();
      getViewer.mockRejectedValue(new Error("base caída"));
      const second = "0199a000-0000-7000-8000-0000000000a2";
      const response = await POST(
        request({ items: [item, { ...item, postId: second }, { ...item, position: 5 }] }),
      );
      expect(response.status).toBe(200);
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      // Una por publicación, como las cuenta el registro.
      expect(await response.json()).toEqual({ recorded: 0, duplicates: 0, rejected: 0, failed: 2 });
      expect(rateLimitMany).not.toHaveBeenCalled();
      expect(recordVisibleImpressions).not.toHaveBeenCalled();
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });

    it("el límite no se puede consultar: no registra sin tope", async () => {
      const log = quiet();
      rateLimitMany.mockRejectedValue(new Error("base caída"));
      const response = await POST(request({ items: [item] }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ recorded: 0, duplicates: 0, rejected: 0, failed: 1 });
      expect(recordVisibleImpressions).not.toHaveBeenCalled();
      log.mockRestore();
    });

    it("con la base caída, un cuerpo inválido sigue siendo 400", async () => {
      const log = quiet();
      getViewer.mockRejectedValue(new Error("base caída"));
      const response = await POST(request({ items: [] }));
      expect(response.status).toBe(400);
      log.mockRestore();
    });

    it("si el registro llegara a lanzar, también 200 con `failed`", async () => {
      const log = quiet();
      recordVisibleImpressions.mockRejectedValue(new Error("inesperado"));
      const response = await POST(request({ items: [item] }));
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ recorded: 0, duplicates: 0, rejected: 0, failed: 1 });
      log.mockRestore();
    });
  });
});
