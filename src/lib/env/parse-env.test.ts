import { describe, expect, it } from "vitest";
import { z } from "zod";
import { EnvValidationError, parseEnv } from "./parse-env";

const schema = z.object({
  APP_URL: z.url().default("http://localhost:3000"),
  API_SECRET: z.string().min(32),
});

describe("parseEnv", () => {
  it("devuelve los valores validados y aplica los valores por defecto", () => {
    const env = parseEnv(schema, { API_SECRET: "x".repeat(32) });

    expect(env).toEqual({ APP_URL: "http://localhost:3000", API_SECRET: "x".repeat(32) });
  });

  it("lanza un error que nombra cada variable inválida", () => {
    const run = () => parseEnv(schema, { APP_URL: "no-es-una-url", API_SECRET: "corto" });

    expect(run).toThrow(EnvValidationError);
    expect(run).toThrow(/APP_URL/);
    expect(run).toThrow(/API_SECRET/);
  });

  it("nunca incluye el valor recibido en el mensaje de error", () => {
    const secret = "sk-secreto-que-no-debe-aparecer";

    try {
      parseEnv(schema, { API_SECRET: secret });
      expect.unreachable("parseEnv debió lanzar un error");
    } catch (error) {
      expect(error).toBeInstanceOf(EnvValidationError);
      expect((error as Error).message).not.toContain(secret);
    }
  });
});
