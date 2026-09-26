import { describe, expect, it } from "vitest";
import { aiProviderConfig, serverEnvSchema, simulatedAIAllowed } from "./env-schema";

const valid = {
  DATABASE_URL: "postgresql://u:p@localhost:5434/vendeia",
  BETTER_AUTH_SECRET: "x".repeat(32),
};

describe("serverEnvSchema", () => {
  it("usa localhost como APP_URL por defecto", () => {
    expect(serverEnvSchema.parse(valid).APP_URL).toBe("http://localhost:3000");
  });

  it("acepta URLs https", () => {
    expect(serverEnvSchema.parse({ ...valid, APP_URL: "https://vendeia.mx" }).APP_URL).toBe(
      "https://vendeia.mx",
    );
  });

  it("rechaza protocolos distintos de http(s) en APP_URL", () => {
    expect(serverEnvSchema.safeParse({ ...valid, APP_URL: "javascript:alert(1)" }).success).toBe(
      false,
    );
    expect(serverEnvSchema.safeParse({ ...valid, APP_URL: "ftp://vendeia.mx" }).success).toBe(
      false,
    );
  });

  it("TRUSTED_PROXY_HOPS es 0 por omisión (se ignora X-Forwarded-For)", () => {
    expect(serverEnvSchema.parse(valid).TRUSTED_PROXY_HOPS).toBe(0);
    expect(serverEnvSchema.parse({ ...valid, TRUSTED_PROXY_HOPS: "2" }).TRUSTED_PROXY_HOPS).toBe(2);
  });

  it("TRUSTED_PROXY_HOPS solo acepta enteros de 0 a 5", () => {
    for (const value of ["-1", "6", "1.5", "uno", " 1", ""]) {
      expect(serverEnvSchema.safeParse({ ...valid, TRUSTED_PROXY_HOPS: value }).success).toBe(
        false,
      );
    }
  });

  it("exige una DATABASE_URL de PostgreSQL", () => {
    expect(serverEnvSchema.safeParse({}).success).toBe(false);
    expect(serverEnvSchema.safeParse({ DATABASE_URL: "mysql://localhost/x" }).success).toBe(false);
  });

  describe("producción cifrada (SEC-21)", () => {
    const production = {
      NODE_ENV: "production",
      APP_URL: "https://vendeia.mx",
      DATABASE_URL: "postgresql://u:p@db.vendeia.mx:5432/vendeia?sslmode=require",
      BETTER_AUTH_SECRET: "x".repeat(32),
      ALLOW_SIMULATED_PAYMENTS: "true",
      ALLOW_SIMULATED_AI: "true",
      CRON_SECRET: "c".repeat(32),
    };
    const issues = (input: Record<string, string>) =>
      (serverEnvSchema.safeParse(input).error?.issues ?? []).map((issue) => issue.path.join("."));

    it("acepta https y una base remota con TLS", () => {
      expect(issues(production)).toEqual([]);
      expect(
        issues({
          ...production,
          DATABASE_URL: production.DATABASE_URL.replace("require", "verify-full"),
        }),
      ).toEqual([]);
    });

    it("rechaza APP_URL http fuera de loopback y una base remota sin sslmode", () => {
      expect(issues({ ...production, APP_URL: "http://vendeia.mx" })).toEqual(["APP_URL"]);
      expect(
        issues({ ...production, DATABASE_URL: "postgresql://u:p@db.vendeia.mx:5432/vendeia" }),
      ).toEqual(["DATABASE_URL"]);
      expect(
        issues({ ...production, DATABASE_URL: "postgresql://u:p@db.vendeia.mx/v?sslmode=disable" }),
      ).toEqual(["DATABASE_URL"]);
    });

    it("permite loopback para probar el build de producción en local", () => {
      expect(
        issues({
          ...production,
          APP_URL: "http://localhost:3000",
          DATABASE_URL: "postgresql://u:p@localhost:5434/vendeia",
        }),
      ).toEqual([]);
      expect(issues({ ...production, APP_URL: "http://127.0.0.1:3000" })).toEqual([]);
    });

    it("en desarrollo no exige nada de esto", () => {
      expect(
        issues({
          ...production,
          NODE_ENV: "development",
          APP_URL: "http://vendeia.test",
          DATABASE_URL: "postgresql://u:p@db/x",
        }),
      ).toEqual([]);
    });
  });

  describe("pagos simulados (SEC-01)", () => {
    const production = {
      NODE_ENV: "production",
      APP_URL: "https://vendeia.mx",
      DATABASE_URL: "postgresql://u:p@db.vendeia.mx:5432/vendeia?sslmode=require",
      BETTER_AUTH_SECRET: "x".repeat(32),
    };
    // Solo los problemas de pagos: otras reglas de producción se prueban aparte.
    const paymentIssues = (input: Record<string, string>) =>
      (serverEnvSchema.safeParse(input).error?.issues ?? [])
        .map((issue) => issue.path.join("."))
        .filter((path) => path === "ALLOW_SIMULATED_PAYMENTS" || path === "PAYMENT_PROVIDER");

    it("en desarrollo y pruebas el proveedor simulado funciona sin configurar nada", () => {
      for (const NODE_ENV of ["development", "test"]) {
        const env = serverEnvSchema.parse({ ...valid, NODE_ENV });
        expect(env.PAYMENT_PROVIDER).toBe("mock");
        expect(env.ALLOW_SIMULATED_PAYMENTS).toBe(false);
      }
    });

    it("en producción el arranque FALLA con el simulador si no se permite explícitamente", () => {
      expect(serverEnvSchema.safeParse(production).success).toBe(false);
      expect(paymentIssues(production)).toEqual(["ALLOW_SIMULATED_PAYMENTS"]);
      for (const value of ["false", "0", "no"]) {
        expect(paymentIssues({ ...production, ALLOW_SIMULATED_PAYMENTS: value })).toEqual([
          "ALLOW_SIMULATED_PAYMENTS",
        ]);
      }
    });

    it("un piloto cerrado en producción lo permite con ALLOW_SIMULATED_PAYMENTS=true", () => {
      for (const value of ["true", "1", "TRUE"]) {
        expect(paymentIssues({ ...production, ALLOW_SIMULATED_PAYMENTS: value })).toEqual([]);
      }
      expect(
        serverEnvSchema.parse({ ...valid, ALLOW_SIMULATED_PAYMENTS: "true" })
          .ALLOW_SIMULATED_PAYMENTS,
      ).toBe(true);
    });

    it("rechaza proveedores desconocidos y valores ambiguos", () => {
      expect(serverEnvSchema.safeParse({ ...valid, PAYMENT_PROVIDER: "stripe" }).success).toBe(
        false,
      );
      for (const value of ["", "quizá", "2"]) {
        expect(
          serverEnvSchema.safeParse({ ...valid, ALLOW_SIMULATED_PAYMENTS: value }).success,
        ).toBe(false);
      }
    });
  });

  describe("proveedor de IA (ADR-033)", () => {
    const key = "sk-or-v1-llave-de-prueba-123456";
    const external = {
      ...valid,
      AI_PROVIDER: "openai_compatible",
      AI_BASE_URL: "https://openrouter.ai/api/v1",
      AI_API_KEY: key,
      AI_DEFAULT_MODEL: "qwen/qwen3.5-9b",
    };
    const issues = (input: Record<string, string>) =>
      (serverEnvSchema.safeParse(input).error?.issues ?? []).map((issue) => issue.path.join("."));

    it("por omisión es la IA simulada y no pide nada más", () => {
      const env = serverEnvSchema.parse(valid);
      expect(env.AI_PROVIDER).toBe("mock");
      expect(env.AI_BASE_URL).toBeUndefined();
      expect(env.AI_API_KEY).toBeUndefined();
      expect(env.AI_DEFAULT_MODEL).toBeUndefined();
      expect(aiProviderConfig(env)).toEqual({ provider: "mock" });
    });

    it("acepta un servidor externo con API compatible con OpenAI", () => {
      const env = serverEnvSchema.parse(external);
      expect(aiProviderConfig(env)).toEqual({
        provider: "openai_compatible",
        baseUrl: "https://openrouter.ai/api/v1",
        apiKey: key,
        model: "qwen/qwen3.5-9b",
      });
    });

    it("con openai_compatible exige URL, llave y modelo (vacías cuentan como faltantes)", () => {
      expect(issues({ ...valid, AI_PROVIDER: "openai_compatible" })).toEqual([
        "AI_BASE_URL",
        "AI_API_KEY",
        "AI_DEFAULT_MODEL",
      ]);
      expect(issues({ ...external, AI_API_KEY: "" })).toEqual(["AI_API_KEY"]);
      expect(issues({ ...external, AI_BASE_URL: "", AI_DEFAULT_MODEL: "" })).toEqual([
        "AI_BASE_URL",
        "AI_DEFAULT_MODEL",
      ]);
    });

    it("la llave viaja cifrada: https fuera de loopback y sin credenciales en la URL", () => {
      expect(issues({ ...external, AI_BASE_URL: "http://api.proveedor.com/v1" })).toEqual([
        "AI_BASE_URL",
      ]);
      expect(issues({ ...external, AI_BASE_URL: "https://u:p@api.proveedor.com/v1" })).toEqual([
        "AI_BASE_URL",
      ]);
      expect(issues({ ...external, AI_BASE_URL: "ftp://api.proveedor.com" })).toEqual([
        "AI_BASE_URL",
      ]);
      // Un servidor propio en la misma máquina (vLLM) puede ir por http.
      expect(issues({ ...external, AI_BASE_URL: "http://127.0.0.1:8000/v1" })).toEqual([]);
    });

    it("rechaza proveedores desconocidos, llaves cortas e ids de modelo raros", () => {
      expect(issues({ ...valid, AI_PROVIDER: "anthropic" })).toEqual(["AI_PROVIDER"]);
      expect(issues({ ...external, AI_API_KEY: "corta" })).toEqual(["AI_API_KEY"]);
      for (const model of ["qwen 3", "-qwen", "qwen;rm", "x".repeat(129)]) {
        expect(issues({ ...external, AI_DEFAULT_MODEL: model })).toEqual(["AI_DEFAULT_MODEL"]);
      }
      for (const model of ["Qwen/Qwen3.5-9B-Instruct", "meta-llama/llama-3.1-8b:free"]) {
        expect(issues({ ...external, AI_DEFAULT_MODEL: model })).toEqual([]);
      }
    });

    it("una URL inválida se reporta sin lanzar ni exponer su valor", () => {
      expect(issues({ ...external, AI_BASE_URL: "no es url" })).toEqual(["AI_BASE_URL"]);
      const production = {
        NODE_ENV: "production",
        APP_URL: "no es url",
        DATABASE_URL: "postgresql://u:contraseña secreta@db/x",
        BETTER_AUTH_SECRET: "x".repeat(32),
        ALLOW_SIMULATED_PAYMENTS: "true",
        ALLOW_SIMULATED_AI: "true",
        CRON_SECRET: "c".repeat(32),
      };
      const result = serverEnvSchema.safeParse(production);
      expect(result.error?.issues.map((issue) => issue.path.join("."))).toEqual([
        "APP_URL",
        "DATABASE_URL",
      ]);
      expect(JSON.stringify(result.error?.issues)).not.toContain("contraseña");
    });

    it("los errores nunca incluyen la llave", () => {
      const result = serverEnvSchema.safeParse({
        ...external,
        AI_BASE_URL: "http://api.proveedor.com/v1",
        AI_DEFAULT_MODEL: "modelo inválido",
      });
      expect(JSON.stringify(result.error?.issues)).not.toContain(key);
    });
  });

  describe("IA simulada en producción (espejo de SEC-01)", () => {
    const production = {
      NODE_ENV: "production",
      APP_URL: "https://vendeia.mx",
      DATABASE_URL: "postgresql://u:p@db.vendeia.mx:5432/vendeia?sslmode=require",
      BETTER_AUTH_SECRET: "x".repeat(32),
      ALLOW_SIMULATED_PAYMENTS: "true",
      CRON_SECRET: "c".repeat(32),
    };
    const external = {
      AI_PROVIDER: "openai_compatible",
      AI_BASE_URL: "https://openrouter.ai/api/v1",
      AI_API_KEY: "sk-or-v1-llave-de-prueba-123456",
      AI_DEFAULT_MODEL: "qwen/qwen3.5-9b",
    };
    const issues = (input: Record<string, string>) =>
      (serverEnvSchema.safeParse(input).error?.issues ?? []).map((issue) => issue.path.join("."));
    const aiIssues = (input: Record<string, string>) =>
      issues(input).filter((path) => path === "ALLOW_SIMULATED_AI" || path === "AI_PROVIDER");

    it("en desarrollo y pruebas la IA simulada funciona sin configurar nada", () => {
      for (const NODE_ENV of ["development", "test"]) {
        const env = serverEnvSchema.parse({ ...valid, NODE_ENV });
        expect(env.AI_PROVIDER).toBe("mock");
        expect(env.ALLOW_SIMULATED_AI).toBe(false);
        expect(simulatedAIAllowed(env)).toBe(true);
      }
    });

    it("en producción el arranque FALLA con la IA simulada (también por omisión)", () => {
      expect(serverEnvSchema.safeParse(production).success).toBe(false);
      expect(issues(production)).toEqual(["ALLOW_SIMULATED_AI"]);
      expect(aiIssues({ ...production, AI_PROVIDER: "mock" })).toEqual(["ALLOW_SIMULATED_AI"]);
      for (const value of ["false", "0", "no"]) {
        expect(aiIssues({ ...production, ALLOW_SIMULATED_AI: value })).toEqual([
          "ALLOW_SIMULATED_AI",
        ]);
      }
    });

    it("el mensaje explica qué recibirían los vendedores y cómo resolverlo", () => {
      const message = serverEnvSchema
        .safeParse(production)
        .error?.issues.find((issue) => issue.path.join(".") === "ALLOW_SIMULATED_AI")?.message;
      expect(message).toContain("textos de plantilla");
      expect(message).toContain("AI_PROVIDER=openai_compatible");
      expect(message).toContain("ALLOW_SIMULATED_AI=true");
    });

    it("un piloto cerrado lo permite con ALLOW_SIMULATED_AI=true", () => {
      for (const value of ["true", "1", "TRUE"]) {
        expect(issues({ ...production, ALLOW_SIMULATED_AI: value })).toEqual([]);
      }
      const env = serverEnvSchema.parse({ ...production, ALLOW_SIMULATED_AI: "true" });
      expect(env.ALLOW_SIMULATED_AI).toBe(true);
      expect(simulatedAIAllowed(env)).toBe(true);
    });

    it("con un proveedor real no hace falta la bandera (y no enciende el simulador)", () => {
      expect(issues({ ...production, ...external })).toEqual([]);
      const env = serverEnvSchema.parse({ ...production, ...external, ALLOW_SIMULATED_AI: "true" });
      expect(simulatedAIAllowed(env)).toBe(false);
    });

    it("el build de producción en loopback también la exige (como los pagos)", () => {
      expect(
        aiIssues({
          ...production,
          APP_URL: "http://localhost:3000",
          DATABASE_URL: "postgresql://u:p@localhost:5434/vendeia",
        }),
      ).toEqual(["ALLOW_SIMULATED_AI"]);
    });

    it("rechaza valores ambiguos", () => {
      for (const value of ["", "quizá", "2"]) {
        expect(serverEnvSchema.safeParse({ ...valid, ALLOW_SIMULATED_AI: value }).success).toBe(
          false,
        );
      }
    });

    it("simulatedAIAllowed: solo con mock, y en producción solo con la bandera", () => {
      const config = (overrides: Partial<Parameters<typeof simulatedAIAllowed>[0]>) => ({
        NODE_ENV: "production" as const,
        AI_PROVIDER: "mock" as const,
        ALLOW_SIMULATED_AI: false,
        ...overrides,
      });
      expect(simulatedAIAllowed(config({}))).toBe(false);
      expect(simulatedAIAllowed(config({ ALLOW_SIMULATED_AI: true }))).toBe(true);
      expect(simulatedAIAllowed(config({ NODE_ENV: "development" }))).toBe(true);
      expect(simulatedAIAllowed(config({ NODE_ENV: "test" }))).toBe(true);
      expect(
        simulatedAIAllowed(config({ AI_PROVIDER: "openai_compatible", NODE_ENV: "development" })),
      ).toBe(false);
    });
  });

  describe("secreto de las tareas programadas", () => {
    const production = {
      NODE_ENV: "production",
      APP_URL: "https://vendeia.mx",
      DATABASE_URL: "postgresql://u:p@db.vendeia.mx:5432/vendeia?sslmode=require",
      BETTER_AUTH_SECRET: "x".repeat(32),
      ALLOW_SIMULATED_PAYMENTS: "true",
    };
    const cronIssues = (input: Record<string, string>) =>
      (serverEnvSchema.safeParse(input).error?.issues ?? [])
        .map((issue) => issue.path.join("."))
        .filter((path) => path === "CRON_SECRET");

    it("es obligatorio en producción y de al menos 32 caracteres", () => {
      expect(cronIssues(production)).toEqual(["CRON_SECRET"]);
      expect(cronIssues({ ...production, CRON_SECRET: "" })).toEqual(["CRON_SECRET"]);
      expect(cronIssues({ ...production, CRON_SECRET: "c".repeat(31) })).toEqual(["CRON_SECRET"]);
      expect(cronIssues({ ...production, CRON_SECRET: "c".repeat(32) })).toEqual([]);
    });

    it("no hace falta en desarrollo ni en un build de producción en loopback", () => {
      expect(serverEnvSchema.parse(valid).CRON_SECRET).toBeUndefined();
      expect(cronIssues({ ...production, APP_URL: "http://localhost:3000" })).toEqual([]);
    });

    it("también se valida fuera de producción si se define", () => {
      expect(cronIssues({ ...valid, CRON_SECRET: "corto" })).toEqual(["CRON_SECRET"]);
    });
  });
});
