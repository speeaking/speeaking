import { describe, expect, it } from "vitest";
import { serverEnvSchema } from "./env-schema";

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
      expect(serverEnvSchema.safeParse({ ...valid, PAYMENT_PROVIDER: "stripe" }).success).toBe(false);
      for (const value of ["", "quizá", "2"]) {
        expect(
          serverEnvSchema.safeParse({ ...valid, ALLOW_SIMULATED_PAYMENTS: value }).success,
        ).toBe(false);
      }
    });
  });
});
