import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Corre el limitador y la política de IP reales; solo la base es de mentira. Así se prueba qué llaves
// cuenta cada intento, en qué orden y con qué política de proxies (SEC-02, SEC-07).
const { db, env } = vi.hoisted(() => ({
  db: {
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
    rateLimitBucket: { updateMany: vi.fn() },
  },
  env: { NODE_ENV: "test", TRUSTED_PROXY_HOPS: 0 },
}));
vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({ env }));

const { AUTH_LIMITS, forgiveSignIn, limitSignIn, limitSignUp } = await import("./auth-limits");

const EMAIL = "ana@example.com";
const EMAIL_HASH = createHash("sha256").update(EMAIL).digest("hex");

/** Conteo que "devuelve" la base para cada llamada, en orden. */
function counts(...values: number[]) {
  for (const count of values) {
    db.$queryRaw.mockResolvedValueOnce([{ count, retryAfterSeconds: 600 }]);
  }
}

/** Llaves que llegaron a la base, en orden. */
function countedKeys() {
  return db.$queryRaw.mock.calls.map((call) => call[1]);
}

function xff(value: string) {
  return new Headers({ "x-forwarded-for": value });
}

beforeEach(() => {
  db.$queryRaw.mockReset();
  db.$executeRaw.mockReset().mockResolvedValue(0);
  db.rateLimitBucket.updateMany.mockReset().mockResolvedValue({ count: 1 });
  env.TRUSTED_PROXY_HOPS = 0;
});

describe("limitSignIn (SEC-02)", () => {
  it("cuenta por IP y por correo (como hash), la IP primero", async () => {
    env.TRUSTED_PROXY_HOPS = 1;
    counts(1, 1);

    const result = await limitSignIn(xff("203.0.113.9"), EMAIL);

    expect(result.error).toBeNull();
    expect(countedKeys()).toEqual(["signin:ip:203.0.113.9", `signin:email:${EMAIL_HASH}`]);
    expect(result.keys).toEqual(countedKeys());
  });

  it("bloquea el sexto intento contra el mismo correo con el mensaje genérico", async () => {
    counts(AUTH_LIMITS.signInEmail.limit + 1);

    const result = await limitSignIn(new Headers(), EMAIL);

    expect(result.error).toBe("Demasiados intentos. Intenta de nuevo en 10 minutos.");
  });

  it("una IP bloqueada no gasta el cupo del correo de su víctima", async () => {
    env.TRUSTED_PROXY_HOPS = 1;
    counts(AUTH_LIMITS.signInIp.limit + 1);

    const result = await limitSignIn(xff("203.0.113.9"), EMAIL);

    expect(result.error).toMatch(/^Demasiados intentos/);
    expect(countedKeys()).toEqual(["signin:ip:203.0.113.9"]);
  });

  // SEC-07: sin proxies de confianza, un X-Forwarded-For inventado no da una cubeta nueva por intento.
  it("ignora X-Forwarded-For sin proxies de confianza: solo cuenta el correo", async () => {
    counts(1, 1);

    await limitSignIn(xff("198.51.100.1"), EMAIL);
    await limitSignIn(xff("198.51.100.2"), EMAIL);

    expect(countedKeys()).toEqual([`signin:email:${EMAIL_HASH}`, `signin:email:${EMAIL_HASH}`]);
  });

  it("detrás de un proxy, la IP es la que agregó el proxy, no la que escribió el cliente", async () => {
    env.TRUSTED_PROXY_HOPS = 1;
    counts(1, 1);

    await limitSignIn(xff("1.2.3.4, 203.0.113.9"), EMAIL);

    expect(countedKeys()[0]).toBe("signin:ip:203.0.113.9");
  });

  it("aplica el mismo límite exista o no la cuenta (la llave solo depende del correo)", async () => {
    counts(1, 1);

    await limitSignIn(new Headers(), "nadie@example.com");
    await limitSignIn(new Headers(), EMAIL);

    const [unknown, known] = countedKeys();
    expect(unknown).toMatch(/^signin:email:[0-9a-f]{64}$/);
    expect(known).toBe(`signin:email:${EMAIL_HASH}`);
    expect(String(unknown)).not.toContain("@");
  });
});

describe("limitSignUp (SEC-02, SEC-11)", () => {
  it("cuenta el registro por IP y por correo", async () => {
    env.TRUSTED_PROXY_HOPS = 1;
    counts(1, 1);

    const result = await limitSignUp(xff("203.0.113.9"), EMAIL);

    expect(result.error).toBeNull();
    expect(countedKeys()).toEqual(["signup:ip:203.0.113.9", `signup:email:${EMAIL_HASH}`]);
  });

  it("bloquea el cuarto registro por minuto desde la misma IP", async () => {
    env.TRUSTED_PROXY_HOPS = 1;
    counts(AUTH_LIMITS.signUpIp.limit + 1);

    expect((await limitSignUp(xff("203.0.113.9"), EMAIL)).error).toMatch(/^Demasiados intentos/);
  });
});

describe("forgiveSignIn", () => {
  it("resta el intento de un inicio de sesión correcto en sus cubetas", async () => {
    await forgiveSignIn(["signin:ip:203.0.113.9", `signin:email:${EMAIL_HASH}`]);

    expect(db.rateLimitBucket.updateMany).toHaveBeenCalledWith({
      where: {
        key: { in: ["signin:ip:203.0.113.9", `signin:email:${EMAIL_HASH}`] },
        count: { gt: 0 },
      },
      data: { count: { decrement: 1 } },
    });
  });

  it("no rompe el inicio de sesión si la base falla", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    db.rateLimitBucket.updateMany.mockRejectedValueOnce(new Error("sin base"));

    await expect(forgiveSignIn(["signin:email:x"])).resolves.toBeUndefined();
    expect(log).toHaveBeenCalled();
    log.mockRestore();
  });

  it("no hace nada sin llaves", async () => {
    await forgiveSignIn([]);

    expect(db.rateLimitBucket.updateMany).not.toHaveBeenCalled();
  });
});
