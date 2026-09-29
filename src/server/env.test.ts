import { describe, expect, it } from "vitest";
import { aiProviderConfig, serverEnvSchema, simulatedAIAllowed } from "./env-schema";
import { createStorage, s3StorageConfig } from "./providers/storage/factory";
import { LocalStorageProvider } from "./providers/storage/local-storage";
import { S3StorageProvider } from "./providers/storage/s3-storage";

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
      ALLOW_LOCAL_STORAGE: "true",
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
        ALLOW_LOCAL_STORAGE: "true",
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
      ALLOW_LOCAL_STORAGE: "true",
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

  describe("almacenamiento (ADR-040)", () => {
    const secret = "s".repeat(64);
    const r2 = {
      STORAGE_DRIVER: "s3",
      S3_ENDPOINT: "https://0123456789abcdef.r2.cloudflarestorage.com",
      S3_BUCKET: "vendeia-media",
      S3_ACCESS_KEY_ID: "a".repeat(32),
      S3_SECRET_ACCESS_KEY: secret,
    };
    const production = {
      NODE_ENV: "production",
      APP_URL: "https://vendeia.mx",
      DATABASE_URL: "postgresql://u:p@db.vendeia.mx:5432/vendeia?sslmode=require",
      BETTER_AUTH_SECRET: "x".repeat(32),
      ALLOW_SIMULATED_PAYMENTS: "true",
      ALLOW_SIMULATED_AI: "true",
      CRON_SECRET: "c".repeat(32),
    };
    const storageIssues = (input: Record<string, string>) =>
      (serverEnvSchema.safeParse(input).error?.issues ?? [])
        .map((issue) => issue.path.join("."))
        .filter((path) => path.startsWith("STORAGE_") || path.startsWith("S3_"));

    it("por omisión es el disco local y no pide nada más fuera de producción", () => {
      const env = serverEnvSchema.parse(valid);
      expect(env.STORAGE_DRIVER).toBe("local");
      expect(env.STORAGE_LOCAL_ROOT).toBe(".data/uploads");
      expect(env.ALLOW_LOCAL_STORAGE).toBe(false);
      expect(env.S3_REGION).toBe("auto");
      expect(createStorage(env)).toBeInstanceOf(LocalStorageProvider);
    });

    it("en producción el disco local FALLA salvo decisión explícita (espejo de SEC-01)", () => {
      expect(storageIssues(production)).toEqual(["STORAGE_DRIVER"]);
      expect(storageIssues({ ...production, STORAGE_DRIVER: "local" })).toEqual(["STORAGE_DRIVER"]);
      expect(storageIssues({ ...production, ALLOW_LOCAL_STORAGE: "true" })).toEqual([]);
    });

    it("el mensaje explica el riesgo y cómo resolverlo", () => {
      const message = serverEnvSchema
        .safeParse(production)
        .error?.issues.find((issue) => issue.path.join(".") === "STORAGE_DRIVER")?.message;
      expect(message).toContain("STORAGE_DRIVER=s3");
      expect(message).toContain("ALLOW_LOCAL_STORAGE=true");
    });

    it("permite el disco local en un build de producción en loopback (pnpm start, E2E)", () => {
      expect(storageIssues({ ...production, APP_URL: "http://localhost:3000" })).toEqual([]);
    });

    it("en Vercel el disco local nunca vale, ni con la bandera", () => {
      expect(storageIssues({ ...production, VERCEL: "1", ALLOW_LOCAL_STORAGE: "true" })).toEqual([
        "STORAGE_DRIVER",
      ]);
      expect(storageIssues({ ...production, VERCEL: "1", ...r2 })).toEqual([]);
    });

    it("acepta Cloudflare R2 en producción y arma el proveedor S3", () => {
      expect(storageIssues({ ...production, ...r2 })).toEqual([]);
      const env = serverEnvSchema.parse({ ...production, ...r2 });
      expect(s3StorageConfig(env)).toEqual({
        endpoint: r2.S3_ENDPOINT,
        bucket: "vendeia-media",
        region: "auto",
        accessKeyId: r2.S3_ACCESS_KEY_ID,
        secretAccessKey: secret,
      });
      expect(createStorage(env)).toBeInstanceOf(S3StorageProvider);
      expect(serverEnvSchema.parse({ ...valid, ...r2, S3_REGION: "" }).S3_REGION).toBe("auto");
      expect(serverEnvSchema.parse({ ...valid, ...r2, S3_REGION: "us-east-1" }).S3_REGION).toBe(
        "us-east-1",
      );
    });

    it("con s3 exige endpoint, bucket y llaves (vacías cuentan como faltantes)", () => {
      expect(storageIssues({ ...valid, STORAGE_DRIVER: "s3" })).toEqual([
        "S3_ENDPOINT",
        "S3_BUCKET",
        "S3_ACCESS_KEY_ID",
        "S3_SECRET_ACCESS_KEY",
      ]);
      expect(storageIssues({ ...valid, ...r2, S3_SECRET_ACCESS_KEY: "" })).toEqual([
        "S3_SECRET_ACCESS_KEY",
      ]);
      expect(() => s3StorageConfig(serverEnvSchema.parse(valid))).toThrow(/incompleta/);
    });

    it("el endpoint va cifrado, sin credenciales y sin ruta", () => {
      for (const endpoint of [
        "http://0123456789abcdef.r2.cloudflarestorage.com",
        "https://u:p@0123456789abcdef.r2.cloudflarestorage.com",
        "https://0123456789abcdef.r2.cloudflarestorage.com/vendeia-media",
        "https://0123456789abcdef.r2.cloudflarestorage.com/?x=1",
        "ftp://0123456789abcdef.r2.cloudflarestorage.com",
        "no es url",
        // La URL pública de desarrollo del bucket: significa que quedó público.
        "https://pub-0123456789abcdef.r2.dev",
      ]) {
        expect(storageIssues({ ...valid, ...r2, S3_ENDPOINT: endpoint })).toEqual(["S3_ENDPOINT"]);
      }
      // Un servicio compatible en la misma máquina (p. ej. MinIO para pruebas) puede ir por http.
      expect(storageIssues({ ...valid, ...r2, S3_ENDPOINT: "http://127.0.0.1:9000" })).toEqual([]);
    });

    it("rechaza drivers desconocidos, buckets y regiones inválidos y llaves cortas", () => {
      expect(storageIssues({ ...valid, STORAGE_DRIVER: "r2" })).toEqual(["STORAGE_DRIVER"]);
      for (const bucket of ["Vendeia", "ve", "vendeia.media", "-vendeia", "v".repeat(64)]) {
        expect(storageIssues({ ...valid, ...r2, S3_BUCKET: bucket })).toEqual(["S3_BUCKET"]);
      }
      expect(storageIssues({ ...valid, ...r2, S3_REGION: "US East" })).toEqual(["S3_REGION"]);
      expect(storageIssues({ ...valid, ...r2, S3_ACCESS_KEY_ID: "corta" })).toEqual([
        "S3_ACCESS_KEY_ID",
      ]);
      expect(storageIssues({ ...valid, ...r2, S3_SECRET_ACCESS_KEY: "corta" })).toEqual([
        "S3_SECRET_ACCESS_KEY",
      ]);
      expect(
        serverEnvSchema.safeParse({ ...valid, ALLOW_LOCAL_STORAGE: "si" }).error?.issues[0]?.path,
      ).toEqual(["ALLOW_LOCAL_STORAGE"]);
    });

    it("los errores nunca incluyen la llave secreta", () => {
      const result = serverEnvSchema.safeParse({
        ...production,
        ...r2,
        S3_ENDPOINT: "http://u:p@r2.example.com/x",
        S3_BUCKET: "Mal.Bucket",
      });
      expect(result.success).toBe(false);
      expect(JSON.stringify(result.error?.issues)).not.toContain(secret);
    });
  });
});
