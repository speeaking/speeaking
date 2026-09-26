import { afterEach, describe, expect, it, vi } from "vitest";
import { AIProviderError } from "@/server/providers/ai/errors";
import { MockAIProvider } from "@/server/providers/ai/mock";
import { adCopyTask } from "./ad-copy";
import { saleProposalTask } from "./sale-proposal";
import {
  availabilityOf,
  countsAsAiGeneration,
  isSimulatedOutput,
  simulatedOutput,
  simulationConfigFromProcess,
} from "./simulation";

const production = { NODE_ENV: "production", ALLOW_SIMULATED_AI: false };
const pilot = { NODE_ENV: "production", ALLOW_SIMULATED_AI: true };
const development = { NODE_ENV: "development", ALLOW_SIMULATED_AI: false };

const adInput = {
  title: "Audífonos inalámbricos",
  description: "Audífonos con estuche de carga y cancelación de ruido.",
  category: "Electrónica",
  condition: "NEW",
  tags: ["audifonos"],
  city: "Puebla",
  state: "Puebla",
  facts: {},
} as unknown as Parameters<typeof adCopyTask.mock>[0];

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("IA simulada con vendedores reales (ADR-038)", () => {
  it("solo en producción el simulador se marca (piloto) o se apaga (sin la bandera)", () => {
    expect(availabilityOf("mock", pilot)).toBe("simulated");
    expect(availabilityOf("mock", production)).toBe("unavailable");
    // Un modelo de verdad es IA de verdad; en desarrollo y pruebas el simulador es lo normal.
    expect(availabilityOf("openai_compatible", production)).toBe("real");
    expect(availabilityOf("openai_compatible", pilot)).toBe("real");
    expect(availabilityOf("mock", development)).toBe("real");
    expect(availabilityOf("mock", { NODE_ENV: "test", ALLOW_SIMULATED_AI: false })).toBe("real");
  });

  it("un texto ya generado se marca según el proveedor que lo escribió, no la ruta de hoy", () => {
    expect(isSimulatedOutput("mock", pilot)).toBe(true);
    expect(isSimulatedOutput("mock", production)).toBe(true);
    expect(isSimulatedOutput("openai_compatible", pilot)).toBe(false);
    expect(isSimulatedOutput("openai_compatible", production)).toBe(false);
    // En desarrollo y pruebas el simulador es lo normal.
    expect(isSimulatedOutput("mock", development)).toBe(false);
  });

  it("una salida simulada nunca cuenta como generación de IA", () => {
    expect(countsAsAiGeneration("mock")).toBe(false);
    expect(countsAsAiGeneration("openai_compatible")).toBe(true);
    expect(countsAsAiGeneration(null)).toBe(true);
  });

  it("en producción sin la bandera el simulador no entrega plantillas", () => {
    const mock = vi.fn(() => ({ ok: true }));
    expect(() => simulatedOutput(mock, () => production)("x")).toThrow(AIProviderError);
    expect(mock).not.toHaveBeenCalled();
    expect(simulatedOutput(mock, () => pilot)("x")).toEqual({ ok: true });
    expect(simulatedOutput(mock, () => development)("x")).toEqual({ ok: true });
  });

  it("lee la bandera como el esquema del servidor (falso si falta o no vale)", () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_SIMULATED_AI", "true");
    expect(simulationConfigFromProcess()).toEqual(pilot);
    vi.stubEnv("ALLOW_SIMULATED_AI", "false");
    expect(simulationConfigFromProcess()).toEqual(production);
    vi.stubEnv("ALLOW_SIMULATED_AI", "quizá");
    expect(simulationConfigFromProcess()).toEqual(production);
    vi.stubEnv("ALLOW_SIMULATED_AI", undefined);
    expect(simulationConfigFromProcess()).toEqual(production);
  });

  it("las tareas del vendedor lo aplican: el proveedor simulado falla como no disponible", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("ALLOW_SIMULATED_AI", undefined);
    const provider = new MockAIProvider();
    await expect(provider.generate(adCopyTask, adInput)).rejects.toMatchObject({
      name: "AIProviderError",
      kind: "unavailable",
    });
    expect(() => saleProposalTask.mock({} as never)).toThrow(AIProviderError);

    vi.stubEnv("ALLOW_SIMULATED_AI", "true");
    const { output } = await provider.generate(adCopyTask, adInput);
    expect(output.headline).toContain("Audífonos inalámbricos");
  });
});
