import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ $queryRaw: vi.fn(), $executeRaw: vi.fn() }));
vi.mock("./db", () => ({ db }));
vi.mock("./env", () => ({ env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 } }));

const { cleanupExpiredRateLimits, limitOrError, rateLimit, rateLimitKey, rateLimitMany } =
  await import("./rate-limit");

const USER = "0199a000-0000-7000-8000-00000000000A";
const MINUTE = 60;

/** La cubeta que "devuelve" la base en la siguiente llamada. */
function bucket(count: number, retryAfterSeconds = 30) {
  db.$queryRaw.mockResolvedValueOnce([{ count, retryAfterSeconds }]);
}

/** La llave que recibió la base en la llamada `index`. */
function keyOfCall(index: number) {
  return (db.$queryRaw.mock.calls[index]?.slice(1) ?? [])[0];
}

beforeEach(() => {
  db.$queryRaw.mockReset();
  db.$executeRaw.mockReset().mockResolvedValue(0);
});

describe("rateLimitKey", () => {
  it("arma llaves con espacio de nombres para IP y usuario", () => {
    expect(rateLimitKey("signin", "ip", "203.0.113.9")).toBe("signin:ip:203.0.113.9");
    expect(rateLimitKey("signin", "ip", "2001:db8:1:2:aaaa::1")).toBe(
      "signin:ip:2001:db8:1:2::/64",
    );
    expect(rateLimitKey("social.post", "user", USER)).toBe(
      `social.post:user:${USER.toLowerCase()}`,
    );
  });

  it("guarda los correos como sha256, sin importar mayúsculas ni espacios", () => {
    const key = rateLimitKey("signin", "email", "Ana.Lopez@Example.com ");
    expect(key).toMatch(/^signin:email:[0-9a-f]{64}$/);
    expect(key).not.toContain("ana");
    expect(key).not.toContain("@");
    expect(rateLimitKey("signin", "email", "ana.lopez@example.com")).toBe(key);
    expect(rateLimitKey("signin", "email", "otra@example.com")).not.toBe(key);
  });

  it("devuelve null sin valor o con una IP inválida (la regla se omite)", () => {
    expect(rateLimitKey("signin", "ip", null)).toBeNull();
    expect(rateLimitKey("signin", "ip", undefined)).toBeNull();
    expect(rateLimitKey("signin", "ip", "unknown")).toBeNull();
    expect(rateLimitKey("signin", "email", "  ")).toBeNull();
  });

  it("rechaza scopes o ids de usuario mal formados (error de programación)", () => {
    expect(() => rateLimitKey("Signin", "ip", "203.0.113.9")).toThrow(TypeError);
    expect(() => rateLimitKey("sign in", "ip", "203.0.113.9")).toThrow(TypeError);
    expect(() => rateLimitKey("a:b", "ip", "203.0.113.9")).toThrow(TypeError);
    expect(() => rateLimitKey("x".repeat(81), "ip", "203.0.113.9")).toThrow(TypeError);
    expect(() => rateLimitKey("post", "user", "ana@example.com")).toThrow(TypeError);
  });
});

describe("rateLimit", () => {
  it("permite mientras el conteo no pase del límite", async () => {
    bucket(3);
    await expect(
      rateLimit({ key: "signin:ip:203.0.113.9", limit: 3, windowSeconds: MINUTE }),
    ).resolves.toEqual({ ok: true });
    bucket(4, 42);
    await expect(
      rateLimit({ key: "signin:ip:203.0.113.9", limit: 3, windowSeconds: MINUTE }),
    ).resolves.toEqual({ ok: false, retryAfterSeconds: 42 });
  });

  it("acepta cualquier llave construida con rateLimitKey", async () => {
    const keys = [
      rateLimitKey("signin", "ip", "2001:db8::1"),
      rateLimitKey("signin", "email", "ana@example.com"),
      rateLimitKey(`comment.${USER.toLowerCase()}`, "user", USER),
    ];
    for (const key of keys) {
      bucket(1);
      await expect(rateLimit({ key: key!, limit: 1, windowSeconds: MINUTE })).resolves.toEqual({
        ok: true,
      });
    }
  });

  it.each([
    ["un correo en claro", "signin:email:ana@example.com"],
    ["sin espacio de nombres", "signin"],
    ["mayúsculas", "Signin:ip:1.2.3.4"],
    ["demasiado larga", `signin:email:${"a".repeat(200)}`],
  ])("rechaza una llave con %s sin tocar la base", async (_case, key) => {
    await expect(rateLimit({ key, limit: 5, windowSeconds: MINUTE })).rejects.toThrow(TypeError);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it.each([
    { limit: 0, windowSeconds: MINUTE },
    { limit: 1.5, windowSeconds: MINUTE },
    { limit: 5, windowSeconds: 0 },
    { limit: 5, windowSeconds: 8 * 24 * 60 * 60 },
  ])("rechaza límites o ventanas inválidos ($limit, $windowSeconds)", async (rule) => {
    await expect(rateLimit({ key: "signin:ip:1.2.3.4", ...rule })).rejects.toThrow(RangeError);
    expect(db.$queryRaw).not.toHaveBeenCalled();
  });

  it("la limpieza oportunista corre a lo más una vez por minuto y nunca rompe la petición", async () => {
    // Más adelante que cualquier limpieza que hayan disparado las pruebas anteriores.
    const start = Date.now() + 60 * 60 * 1000;
    vi.useFakeTimers({ now: start, toFake: ["Date"] });
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      db.$executeRaw.mockRejectedValueOnce(new Error("sin conexión"));
      bucket(1);
      await expect(
        rateLimit({ key: "a:ip:1.2.3.4", limit: 5, windowSeconds: MINUTE }),
      ).resolves.toEqual({ ok: true });
      expect(error).toHaveBeenCalledTimes(1);

      bucket(2);
      await rateLimit({ key: "a:ip:1.2.3.4", limit: 5, windowSeconds: MINUTE });
      expect(db.$executeRaw).toHaveBeenCalledTimes(1);

      vi.setSystemTime(start + 61 * 1000);
      bucket(3);
      await rateLimit({ key: "a:ip:1.2.3.4", limit: 5, windowSeconds: MINUTE });
      expect(db.$executeRaw).toHaveBeenCalledTimes(2);
    } finally {
      vi.useRealTimers();
      error.mockRestore();
    }
  });
});

describe("rateLimitMany", () => {
  const ipKey = "signin:ip:203.0.113.9";
  const emailKey = rateLimitKey("signin", "email", "ana@example.com");

  it("revisa en orden y se detiene en la primera regla que falla", async () => {
    bucket(11, 600);
    const result = await rateLimitMany([
      { key: ipKey, limit: 10, windowSeconds: 15 * MINUTE },
      { key: emailKey, limit: 5, windowSeconds: 15 * MINUTE },
    ]);
    expect(result).toEqual({ ok: false, retryAfterSeconds: 600 });
    // La cubeta del correo no se tocó: una IP bloqueada no gasta el cupo de su víctima.
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(keyOfCall(0)).toBe(ipKey);
  });

  it("falla si falla cualquiera y omite las reglas sin llave", async () => {
    bucket(6, 120);
    const result = await rateLimitMany([
      { key: null, limit: 10, windowSeconds: 15 * MINUTE },
      { key: emailKey, limit: 5, windowSeconds: 15 * MINUTE },
    ]);
    expect(result).toEqual({ ok: false, retryAfterSeconds: 120 });
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(keyOfCall(0)).toBe(emailKey);
  });

  it("permite si todas pasan (o si no hay ninguna aplicable)", async () => {
    bucket(1);
    bucket(1);
    await expect(
      rateLimitMany([
        { key: ipKey, limit: 10, windowSeconds: MINUTE },
        { key: emailKey, limit: 5, windowSeconds: MINUTE },
      ]),
    ).resolves.toEqual({ ok: true });
    await expect(rateLimitMany([{ key: null, limit: 1, windowSeconds: 1 }])).resolves.toEqual({
      ok: true,
    });
  });
});

describe("limitOrError", () => {
  it("no da mensaje si se permite", () => {
    expect(limitOrError({ ok: true })).toBeNull();
    expect(limitOrError([{ ok: true }, { ok: true }])).toBeNull();
    expect(limitOrError([])).toBeNull();
  });

  it.each([
    [1, "1 minuto"],
    [60, "1 minuto"],
    [61, "2 minutos"],
    [15 * 60, "15 minutos"],
    [90 * 60, "90 minutos"],
    [90 * 60 + 1, "2 horas"],
    [24 * 60 * 60, "24 horas"],
    [48 * 60 * 60 + 1, "3 días"],
  ])("redondea %i s hacia arriba: %s", (seconds, wait) => {
    expect(limitOrError({ ok: false, retryAfterSeconds: seconds })).toBe(
      `Demasiados intentos. Intenta de nuevo en ${wait}.`,
    );
  });

  it("con varias reglas reporta la espera más larga", () => {
    expect(
      limitOrError([
        { ok: true },
        { ok: false, retryAfterSeconds: 60 },
        { ok: false, retryAfterSeconds: 10 * 60 },
      ]),
    ).toBe("Demasiados intentos. Intenta de nuevo en 10 minutos.");
  });
});

describe("cleanupExpiredRateLimits", () => {
  it("borra por lotes acotados", async () => {
    db.$executeRaw.mockResolvedValueOnce(7);
    await expect(cleanupExpiredRateLimits(50)).resolves.toBe(7);
    const [sql, ...values] = db.$executeRaw.mock.calls[0] ?? [];
    expect((sql as string[]).join("?")).toContain('DELETE FROM "rate_limit_buckets"');
    expect(values).toEqual([50]);
  });
});
