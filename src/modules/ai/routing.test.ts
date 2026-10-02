import { describe, expect, it } from "vitest";
import { maxCallCostMicrosUsd } from "./cost";
import {
  aiRoutingSchema,
  DEFAULT_AI_ROUTING,
  isRoutable,
  proposalIsStale,
  proposedRoutes,
  resolveRoute,
  ROUTABLE_MODELS,
  routePrice,
  TASK_DEFAULT_MODELS,
  withRoute,
  type AIRouting,
} from "./routing";

const openai = {
  provider: "openai_compatible" as const,
  baseUrl: "https://openrouter.ai/api/v1",
  apiKey: "sk-prueba-0123456789abcdef",
  model: "qwen/qwen3.5-9b",
};

describe("ROUTABLE_MODELS", () => {
  it("todo modelo enrutable tiene precio (sin precio no se llama)", () => {
    for (const option of ROUTABLE_MODELS) {
      expect(maxCallCostMicrosUsd(option.model), option.model).not.toBeNull();
    }
  });

  it("no ofrece Gemini 2.5 Flash Lite: OpenRouter lo retira el 2026-10-20 (ADR-071)", () => {
    expect(
      isRoutable({ provider: "openai_compatible", model: "google/gemini-2.5-flash-lite" }),
    ).toBe(false);
    expect(
      isRoutable({ provider: "openai_compatible", model: "google/gemini-3.5-flash-lite" }),
    ).toBe(true);
  });
});

describe("aiRoutingSchema", () => {
  it("acepta rutas de la lista blanca por tarea", () => {
    expect(
      aiRoutingSchema.safeParse({
        version: 1,
        tasks: {
          ad_copy: { provider: "openai_compatible", model: "qwen/qwen3.5-9b" },
          sale_proposal: { provider: "mock", model: "mock" },
        },
      }).success,
    ).toBe(true);
  });

  it.each([
    ["un modelo fuera de la lista", { ad_copy: { provider: "openai_compatible", model: "gpt-9" } }],
    ["un proveedor inventado", { ad_copy: { provider: "otro", model: "mock" } }],
    ["una tarea que no existe", { chat: { provider: "mock", model: "mock" } }],
    [
      "llaves de más",
      { ad_copy: { provider: "mock", model: "mock", apiKey: "sk-no-va-aqui-123456" } },
    ],
  ])("rechaza %s", (_label, tasks) => {
    expect(aiRoutingSchema.safeParse({ version: 1, tasks }).success).toBe(false);
  });
});

describe("resolveRoute", () => {
  it("sin ruta usa las variables de entorno", () => {
    expect(resolveRoute(DEFAULT_AI_ROUTING, "ad_copy", { provider: "mock" })).toEqual({
      provider: "mock",
      model: "mock",
      source: "default",
    });
    expect(resolveRoute(DEFAULT_AI_ROUTING, "ad_copy", openai)).toEqual({
      provider: "openai_compatible",
      model: "qwen/qwen3.5-9b",
      source: "default",
    });
  });

  it("una tarea con modelo de arranque lo usa en lugar del de las variables de entorno", () => {
    expect(resolveRoute(DEFAULT_AI_ROUTING, "editorial_draft", openai)).toEqual({
      provider: "openai_compatible",
      model: "google/gemini-3.5-flash-lite",
      source: "default",
    });
    // Sin servidor de IA no hay modelo de arranque que valga: el simulador.
    expect(resolveRoute(DEFAULT_AI_ROUTING, "editorial_draft", { provider: "mock" })).toEqual({
      provider: "mock",
      model: "mock",
      source: "default",
    });
  });

  it("los modelos de arranque están en la lista permitida y tienen precio", () => {
    for (const model of Object.values(TASK_DEFAULT_MODELS)) {
      expect(isRoutable({ provider: "openai_compatible", model })).toBe(true);
      expect(routePrice({ provider: "openai_compatible", model })).not.toBeNull();
    }
  });

  it("con ruta usa el modelo de la tarea", () => {
    const routing = withRoute(DEFAULT_AI_ROUTING, "sale_proposal", {
      provider: "openai_compatible",
      model: "anthropic/claude-haiku-4.5",
    });
    expect(resolveRoute(routing, "sale_proposal", openai)).toMatchObject({
      model: "anthropic/claude-haiku-4.5",
      source: "routing",
    });
    expect(resolveRoute(routing, "ad_copy", openai).source).toBe("default");
  });

  it("una ruta de pago sin servidor configurado cae al simulador y lo dice", () => {
    const routing = withRoute(DEFAULT_AI_ROUTING, "ad_copy", {
      provider: "openai_compatible",
      model: "qwen/qwen3.5-9b",
    });
    expect(resolveRoute(routing, "ad_copy", { provider: "mock" })).toMatchObject({
      provider: "mock",
      source: "fallback",
    });
  });

  it("withRoute(null) vuelve a la ruta predeterminada", () => {
    const routing = withRoute(DEFAULT_AI_ROUTING, "ad_copy", { provider: "mock", model: "mock" });
    expect(withRoute(routing, "ad_copy", null)).toEqual(DEFAULT_AI_ROUTING);
  });
});

describe("propuestas de ai.routing (qué proponen y si ya no cambian nada)", () => {
  const qwen = { provider: "openai_compatible" as const, model: "qwen/qwen3.5-9b" };
  const haiku = { provider: "openai_compatible" as const, model: "anthropic/claude-haiku-4.5" };
  const mock = { provider: "mock" as const, model: "mock" };
  const routing = (tasks: AIRouting["tasks"]): AIRouting => ({ version: 1, tasks });

  it("proposedRoutes: solo las tareas que cambian, con su ruta nueva (null = predeterminada)", () => {
    expect(
      proposedRoutes(
        routing({ sale_proposal: haiku, ad_copy: qwen }),
        routing({ sale_proposal: haiku, analyst_narrative: mock }),
      ),
    ).toEqual([
      { task: "ad_copy", route: null },
      { task: "analyst_narrative", route: mock },
    ]);
    expect(proposedRoutes(routing({}), "no es un ajuste")).toBeNull();
    // Un valor anterior ilegible cuenta como sin rutas.
    expect(proposedRoutes(null, routing({ ad_copy: qwen }))).toEqual([
      { task: "ad_copy", route: qwen },
    ]);
  });

  it("ya no cambia nada si la tarea ya usa ese modelo (ruta o variables de entorno)", () => {
    const proposal = { previousValue: routing({}), newValue: routing({ ad_copy: qwen }) };
    expect(proposalIsStale(proposal, routing({ ad_copy: qwen }), openai)).toBe(true);
    // Sin ruta, con Qwen como predeterminado del servidor: ya lo usa.
    expect(proposalIsStale(proposal, routing({}), openai)).toBe(true);
    expect(proposalIsStale(proposal, routing({ ad_copy: haiku }), openai)).toBe(false);
    // Con la ruta a Qwen pero sin servidor, la tarea cae al simulador: aplicarla sí importa.
    expect(proposalIsStale(proposal, routing({ ad_copy: qwen }), { provider: "mock" })).toBe(false);
  });

  it("volver al predeterminado ya no cambia nada si la tarea no tiene ruta", () => {
    const proposal = { previousValue: routing({ ad_copy: qwen }), newValue: routing({}) };
    expect(proposalIsStale(proposal, routing({}), openai)).toBe(true);
    expect(proposalIsStale(proposal, routing({ ad_copy: qwen }), openai)).toBe(false);
  });

  it("con varias tareas, solo si todas ya usan lo propuesto; ilegible o sin cambios, nunca", () => {
    const both = {
      previousValue: routing({}),
      newValue: routing({ ad_copy: mock, sale_proposal: qwen }),
    };
    expect(proposalIsStale(both, routing({ sale_proposal: qwen }), { provider: "mock" })).toBe(
      false,
    );
    expect(proposalIsStale(both, routing({ ad_copy: mock, sale_proposal: haiku }), openai)).toBe(
      false,
    );
    expect(proposalIsStale(both, routing({ ad_copy: mock, sale_proposal: qwen }), openai)).toBe(
      true,
    );
    expect(proposalIsStale({ previousValue: null, newValue: "x" }, routing({}), openai)).toBe(
      false,
    );
    const same = {
      previousValue: routing({ ad_copy: qwen }),
      newValue: routing({ ad_copy: qwen }),
    };
    expect(proposalIsStale(same, routing({ ad_copy: qwen }), openai)).toBe(false);
  });
});
