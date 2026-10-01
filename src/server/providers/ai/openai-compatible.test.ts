import { describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { AI_IMAGE_INPUT_TOKENS, AI_MAX_INPUT_TOKENS, costMicrosUsd } from "@/modules/ai/cost";
import { adCopyTask } from "@/modules/ai/tasks/ad-copy";
import { saleProposalTask } from "@/modules/ai/tasks/sale-proposal";
import { AIProviderError } from "./errors";
import { strictJsonSchema } from "./json-schema";
import { estimateTokens, OpenAICompatibleProvider } from "./openai-compatible";
import type { AITask } from "./types";

const API_KEY = "sk-prueba-0123456789abcdef";

const task: AITask<{ product: string }, { headline: string; tags: string[] }> = {
  task: "ad_copy",
  promptVersion: "test@1",
  format: "json",
  schemaName: "test_copy",
  output: z.object({ headline: z.string().min(3).max(60), tags: z.array(z.string()).max(3) }),
  temperature: 0.3,
  maxOutputTokens: 500,
  messages: ({ product }) => ({ system: "Eres un redactor.", user: `Producto: ${product}` }),
  mock: () => ({ headline: "Hola", tags: [] }),
};

function completion(
  content: unknown,
  usage: object | null = { prompt_tokens: 3_000, completion_tokens: 2_000 },
  finish = "stop",
) {
  return new Response(
    JSON.stringify({
      choices: [{ finish_reason: finish, message: { role: "assistant", content } }],
      ...(usage ? { usage } : {}),
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

function setup(responses: (Response | ((init: RequestInit) => Promise<Response>))[], extra = {}) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fetchMock = vi.fn(async (url: URL | RequestInfo, init?: RequestInit) => {
    calls.push({ url: String(url), init: init! });
    const next = responses.shift();
    if (!next) throw new Error("sin respuesta preparada");
    return typeof next === "function" ? next(init!) : next;
  });
  const sleep = vi.fn(async () => {});
  const provider = new OpenAICompatibleProvider({
    baseUrl: "https://ia.example.com/v1",
    apiKey: API_KEY,
    model: "qwen/qwen3.5-9b",
    fetch: fetchMock as unknown as typeof fetch,
    sleep,
    random: () => 0,
    ...extra,
  });
  return { provider, calls, sleep, fetchMock };
}

const good = JSON.stringify({ headline: "Audífonos con buen sonido", tags: ["audio"] });

describe("OpenAICompatibleProvider", () => {
  it("manda chat/completions con modelo, temperatura, max_tokens y json_schema estricto", async () => {
    const { provider, calls } = setup([completion(good)]);

    const result = await provider.generate(task, { product: "Audífonos" });

    expect(result.output).toEqual({ headline: "Audífonos con buen sonido", tags: ["audio"] });
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe("https://ia.example.com/v1/chat/completions");
    const headers = calls[0]!.init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${API_KEY}`);
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body).toMatchObject({
      model: "qwen/qwen3.5-9b",
      temperature: 0.3,
      max_tokens: 500,
      messages: [
        { role: "system", content: "Eres un redactor." },
        { role: "user", content: "Producto: Audífonos" },
      ],
      response_format: { type: "json_schema", json_schema: { name: "test_copy", strict: true } },
    });
    const schema = body.response_format.json_schema.schema;
    expect(schema).toMatchObject({
      type: "object",
      required: ["headline", "tags"],
      additionalProperties: false,
    });
    // Sin palabras clave que el modo estricto de algunos proveedores rechaza.
    expect(JSON.stringify(schema)).not.toMatch(/minLength|maxLength|\$schema/);
    // Un servidor que no es OpenRouter no recibe campos que no conoce.
    expect(body).not.toHaveProperty("provider");
  });

  it("registra el uso informado y su costo con el precio del modelo", async () => {
    const { provider } = setup([completion(good)]);

    const { usage } = await provider.generate(task, { product: "Audífonos" });

    expect(usage).toEqual({ inputTokens: 3_000, outputTokens: 2_000 });
    // 3,000 × 0.10 + 2,000 × 0.15 = 600 micro-dólares (precio de OpenRouter del 2026-09-27).
    expect(costMicrosUsd(provider.model, usage)).toBe(600);
  });

  it("si el proveedor no informa el uso, lo estima y lo marca (nunca 0 a ciegas)", async () => {
    const { provider } = setup([completion(good, null)]);

    const { usage } = await provider.generate(task, { product: "Audífonos" });

    expect(usage.estimated).toBe(true);
    expect(usage.inputTokens).toBeGreaterThan(0);
    expect(usage.outputTokens).toBeGreaterThan(0);
  });

  it("una salida que no cumple el esquema es invalid_output, con el uso para registrar el costo", async () => {
    const { provider } = setup([completion(JSON.stringify({ headline: "x", tags: [] }))]);

    const error = await provider.generate(task, { product: "Audífonos" }).catch((e) => e);

    expect(error).toBeInstanceOf(AIProviderError);
    expect(error).toMatchObject({
      kind: "invalid_output",
      usage: { inputTokens: 3_000, outputTokens: 2_000 },
    });
  });

  it("una salida que no es JSON, cortada o rechazada es invalid_output", async () => {
    const { provider } = setup([
      completion("Claro, aquí tienes tus anuncios"),
      completion(good.slice(0, 20), undefined, "length"),
      new Response(
        JSON.stringify({ choices: [{ message: { content: null, refusal: "No puedo" } }] }),
        { status: 200 },
      ),
    ]);

    for (let i = 0; i < 3; i++) {
      await expect(provider.generate(task, { product: "Audífonos" })).rejects.toMatchObject({
        kind: "invalid_output",
      });
    }
  });

  it("acepta JSON con cercas de código o razonamiento previo (<think>)", async () => {
    const { provider } = setup([completion(`<think>pienso…</think>\n\`\`\`json\n${good}\n\`\`\``)]);

    await expect(provider.generate(task, { product: "Audífonos" })).resolves.toMatchObject({
      output: { headline: "Audífonos con buen sonido" },
    });
  });

  it("reintenta un 429 con espera (respeta Retry-After) y luego responde", async () => {
    const { provider, calls, sleep } = setup([
      new Response("{}", { status: 429, headers: { "Retry-After": "2" } }),
      new Response("{}", { status: 503 }),
      completion(good),
    ]);

    const result = await provider.generate(task, { product: "Audífonos" });

    expect(result.output.headline).toBe("Audífonos con buen sonido");
    expect(calls).toHaveLength(3);
    // 2 s de Retry-After; después 500 × 3¹ = 1.5 s.
    expect(sleep.mock.calls).toEqual([[2_000], [1_500]]);
  });

  it("máximo 2 reintentos: el tercer 429 es rate_limited", async () => {
    const { provider, calls } = setup([
      new Response("{}", { status: 429 }),
      new Response("{}", { status: 429 }),
      new Response("{}", { status: 429 }),
    ]);

    await expect(provider.generate(task, { product: "Audífonos" })).rejects.toMatchObject({
      kind: "rate_limited",
      status: 429,
    });
    expect(calls).toHaveLength(3);
  });

  it("un 401 no se reintenta y el error nunca lleva la llave", async () => {
    const { provider, calls } = setup([new Response("{}", { status: 401 })]);

    const error = await provider.generate(task, { product: "Audífonos" }).catch((e) => e);

    expect(error).toMatchObject({ kind: "auth", status: 401 });
    expect(calls).toHaveLength(1);
    expect(String(error.message)).not.toContain(API_KEY);
    expect(JSON.stringify(provider)).not.toContain(API_KEY);
    expect(JSON.stringify(error)).not.toContain(API_KEY);
  });

  it("un 402 (sin saldo) no se reintenta y se distingue de una petición inválida", async () => {
    const { provider, calls } = setup([new Response("{}", { status: 402 })]);

    const error = await provider.generate(task, { product: "Audífonos" }).catch((e) => e);

    expect(error).toMatchObject({ kind: "no_credit", status: 402 });
    expect(calls).toHaveLength(1);
  });

  it("corta con AbortController al pasar el plazo (y no reintenta: pudo haberse cobrado)", async () => {
    const hang = (init: RequestInit) =>
      new Promise<Response>((_, reject) => {
        init.signal?.addEventListener("abort", () =>
          reject(new DOMException("aborted", "AbortError")),
        );
      });
    const { provider, calls } = setup([hang, completion(good)], { timeoutMs: 30 });

    await expect(provider.generate(task, { product: "Audífonos" })).rejects.toMatchObject({
      kind: "timeout",
    });
    expect(calls).toHaveLength(1);
  });

  it("una entrada demasiado grande se rechaza ANTES de llamar (el costo nunca pasa de lo reservado)", async () => {
    const { provider, calls } = setup([completion(good)]);

    await expect(provider.generate(task, { product: "x".repeat(20_000) })).rejects.toMatchObject({
      kind: "input_too_large",
    });
    expect(calls).toHaveLength(0);
  });

  it("con OpenRouter pide proveedores sin recolección ni retención, con json_schema y sin razonamiento", async () => {
    const { provider, calls } = setup([completion(good)], {
      baseUrl: "https://openrouter.ai/api/v1/",
    });

    await provider.generate(task, { product: "Audífonos" });

    expect(calls[0]!.url).toBe("https://openrouter.ai/api/v1/chat/completions");
    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.provider).toEqual({
      data_collection: "deny",
      zdr: true,
      require_parameters: true,
    });
    // Qwen 3.5 gastaba todo max_tokens «pensando» y no escribía la respuesta.
    expect(body.reasoning).toEqual({ enabled: false });
  });

  it("otros servidores no reciben los campos propios de OpenRouter", async () => {
    const { provider, calls } = setup([completion(good)], {
      baseUrl: "https://ia.example.com/v1",
    });

    await provider.generate(task, { product: "Audífonos" });

    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.provider).toBeUndefined();
    expect(body.reasoning).toBeUndefined();
  });

  it("la llave solo va al servidor configurado: sin redirecciones ni rutas que cambien de host", async () => {
    const { provider, calls } = setup([completion(good)], {
      baseUrl: "https://ia.example.com//otro.example.net/v1?x=1#y",
    });

    await provider.generate(task, { product: "Audífonos" });

    expect(new URL(calls[0]!.url).host).toBe("ia.example.com");
    expect(calls[0]!.url).toBe("https://ia.example.com//otro.example.net/v1/chat/completions");
    expect(calls[0]!.init.redirect).toBe("error");
  });

  it("una redirección (fetch falla con redirect: error) es un error de red, no se sigue", async () => {
    const { provider, calls } = setup([
      async () => {
        throw new TypeError("fetch failed: unexpected redirect");
      },
    ]);

    await expect(provider.generate(task, { product: "Audífonos" })).rejects.toMatchObject({
      kind: "network",
    });
    expect(calls).toHaveLength(1);
  });
});

describe("fotos de entrada (búsqueda por foto, ADR-061)", () => {
  const visionTask: AITask<{ image: string }, { headline: string; tags: string[] }> = {
    ...(task as unknown as AITask<{ image: string }, { headline: string; tags: string[] }>),
    messages: ({ image }) => ({ system: "Describe.", user: "¿Qué ves?", images: [image] }),
  };

  it("manda el texto y cada foto como partes del mensaje", async () => {
    const { provider, calls } = setup([completion(good)]);

    await provider.generate(visionTask, { image: "data:image/jpeg;base64,AAAA" });

    const body = JSON.parse(String(calls[0]!.init.body));
    expect(body.messages[1]).toEqual({
      role: "user",
      content: [
        { type: "text", text: "¿Qué ves?" },
        { type: "image_url", image_url: { url: "data:image/jpeg;base64,AAAA" } },
      ],
    });
  });

  it("cada foto cuenta en el tope de entrada: demasiadas se rechazan antes de llamar", async () => {
    const { provider, calls } = setup([completion(good)]);
    const many: AITask<{ image: string }, { headline: string; tags: string[] }> = {
      ...visionTask,
      messages: ({ image }) => ({
        system: "Describe.",
        user: "¿Qué ves?",
        images: Array.from(
          { length: Math.ceil(AI_MAX_INPUT_TOKENS / AI_IMAGE_INPUT_TOKENS) + 1 },
          () => image,
        ),
      }),
    };

    await expect(provider.generate(many, { image: "data:," })).rejects.toMatchObject({
      kind: "input_too_large",
    });
    expect(calls).toHaveLength(0);
  });
});

describe("tope de entrada con las tareas reales", () => {
  // Peor caso de cada tarea (textos al máximo que aceptan los formularios), esquema incluido: si un
  // cambio de prompt lo pasa, la llamada fallaría con input_too_large en producción.
  const tokens = (messages: { system: string; user: string }, schema: object) =>
    estimateTokens(messages.system) +
    estimateTokens(messages.user) +
    estimateTokens(JSON.stringify(schema));

  it("«Vende con IA» y el kit de anuncios caben con holgura", () => {
    const categories = Array.from({ length: 60 }, (_, index) => ({
      slug: `categoria-larga-${index}`,
      name: `Categoría número ${index} de prueba`,
    }));
    const sale = tokens(
      saleProposalTask.messages({
        text: "x".repeat(1000),
        productName: "y".repeat(120),
        quantity: 100_000,
        priceCents: 1_000_000_000,
        costCents: 1,
        city: "Ciudad de México",
        hasPhoto: true,
        categories,
      }),
      strictJsonSchema(saleProposalTask.output),
    );
    const ad = tokens(
      adCopyTask.messages({
        title: "t".repeat(120),
        price: "$10,000,000",
        category: "c".repeat(60),
        city: "Ciudad de México",
        state: "Ciudad de México",
        tags: Array.from({ length: 10 }, () => "etiqueta-muy-larga"),
        description: "d".repeat(800),
        facts: Array.from({ length: 8 }, () => "Garantía del fabricante por 365 días"),
      }),
      strictJsonSchema(adCopyTask.output),
    );
    expect(sale).toBeLessThan(AI_MAX_INPUT_TOKENS * 0.8);
    expect(ad).toBeLessThan(AI_MAX_INPUT_TOKENS * 0.8);
  });
});
