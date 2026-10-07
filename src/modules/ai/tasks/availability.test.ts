import { beforeEach, describe, expect, it, vi } from "vitest";

/** Entorno del servidor y ruta vigente de la tarea (ADR-038). */
const env = vi.hoisted(() => ({ NODE_ENV: "production" as string, ALLOW_SIMULATED_AI: false }));
const route = vi.hoisted(() => ({ provider: "mock" as string, model: "mock", source: "default" }));

const getAIRoute = vi.hoisted(() => vi.fn(async () => route));

vi.mock("@/server/env", () => ({ env }));
vi.mock("@/server/providers/ai", () => ({ getAIRoute }));
// `aiErrorMessage` vive junto a los límites (`rate-limit`), que importan la base: aquí no se usa.
vi.mock("@/server/db", () => ({ db: {} }));

const { aiAvailability, aiErrorMode, assertAiAvailable, simulatedRecord } =
  await import("./availability");
const { AIError } = await import("../errors");
const { aiErrorMessage } = await import("../messages");

beforeEach(() => {
  Object.assign(env, { NODE_ENV: "production", ALLOW_SIMULATED_AI: false });
  Object.assign(route, { provider: "mock", model: "mock" });
});

describe("assertAiAvailable: antes de reservar (sin gastar la cuota)", () => {
  it("producción con el simulador y sin la bandera: UNAVAILABLE", async () => {
    expect(await aiAvailability("ad_copy")).toBe("unavailable");
    await expect(assertAiAvailable("ad_copy")).rejects.toMatchObject({
      name: "AIError",
      code: "UNAVAILABLE",
    });
  });

  it("piloto (ALLOW_SIMULATED_AI) o un modelo de verdad: sigue", async () => {
    env.ALLOW_SIMULATED_AI = true;
    await expect(assertAiAvailable("sale_proposal")).resolves.toBe("simulated");
    env.ALLOW_SIMULATED_AI = false;
    Object.assign(route, { provider: "openai_compatible", model: "qwen/qwen3.5-9b" });
    await expect(assertAiAvailable("sale_proposal")).resolves.toBe("real");
  });

  it("en desarrollo el simulador es lo normal", async () => {
    env.NODE_ENV = "development";
    await expect(assertAiAvailable("ad_copy")).resolves.toBe("real");
    expect(simulatedRecord("mock")).toBe(false);
  });

  it("simulatedRecord marca por el proveedor guardado, con la bandera o sin ella", () => {
    expect(simulatedRecord("mock")).toBe(true);
    env.ALLOW_SIMULATED_AI = true;
    expect(simulatedRecord("mock")).toBe(true);
    expect(simulatedRecord("openai_compatible")).toBe(false);
  });

  it("el mensaje de UNAVAILABLE es la salida a mano de cada función", () => {
    const byHand = "Por ahora escribe tu anuncio a mano: el kit de anuncios no está disponible.";
    expect(aiErrorMessage(new AIError("UNAVAILABLE"), byHand)).toBe(byHand);
  });

  it("la cuota se cuenta en «usos» con la IA simulada; «generaciones con IA» con un modelo", async () => {
    const quota = new AIError("QUOTA_EXCEEDED", 3600, "day");
    env.ALLOW_SIMULATED_AI = true;
    const pilot = aiErrorMessage(quota, "a mano", await aiErrorMode(quota, "ad_copy"));
    expect(pilot).toBe("Llegaste al límite de usos de hoy. Se libera en 1 hora.");
    Object.assign(route, { provider: "openai_compatible", model: "qwen/qwen3.5-9b" });
    const model = aiErrorMessage(quota, "a mano", await aiErrorMode(quota, "ad_copy"));
    expect(model).toBe("Llegaste al límite de generaciones con IA de hoy. Se libera en 1 hora.");
  });

  it("aiErrorMode solo lee la ruta para la cuota, y si falla no convierte el error en un 500", async () => {
    getAIRoute.mockClear();
    await expect(aiErrorMode(new AIError("PROVIDER_ERROR"), "ad_copy")).resolves.toBe("real");
    expect(getAIRoute).not.toHaveBeenCalled();
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    getAIRoute.mockRejectedValueOnce(new Error("sin base"));
    await expect(aiErrorMode(new AIError("QUOTA_EXCEEDED"), "ad_copy")).resolves.toBe("real");
    log.mockRestore();
  });
});
