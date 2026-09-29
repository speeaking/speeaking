import { describe, expect, it, vi } from "vitest";
import { AIProviderError } from "../ai/errors";
import {
  decodeDataUrl,
  extractImageDataUrl,
  OpenAICompatibleImageProvider,
} from "./openai-compatible-image";
import type { ImageTask } from "./types";

const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const task: ImageTask<{ note: string }> = {
  task: "virtual_try_on",
  promptVersion: "test@1",
  prompt: (input) => ({
    instructions: `Prueba ${input.note}`,
    images: [
      { data: PNG, mimeType: "image/png" },
      { data: PNG, mimeType: "image/webp" },
    ],
  }),
  mock: async () => ({ data: PNG, mimeType: "image/png" }),
};

function reply(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

function provider(
  fetchImpl: typeof fetch,
  extra: Partial<ConstructorParameters<typeof OpenAICompatibleImageProvider>[0]> = {},
) {
  return new OpenAICompatibleImageProvider({
    baseUrl: "https://openrouter.ai/api/v1",
    apiKey: "sk-or-v1-una-llave-de-prueba-larga",
    model: "google/gemini-3.1-flash-image-preview",
    sleep: async () => {},
    random: () => 0,
    fetch: fetchImpl,
    ...extra,
  });
}

describe("OpenAICompatibleImageProvider", () => {
  it("manda las imágenes como data URL con modalities y devuelve la imagen de la respuesta", async () => {
    const fetchImpl = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as {
        model: string;
        modalities: string[];
        provider: { zdr: boolean; data_collection: string };
        messages: { role: string; content: { type: string; image_url?: { url: string } }[] }[];
      };
      expect(body.modalities).toEqual(["image", "text"]);
      expect(body.provider).toMatchObject({ zdr: true, data_collection: "deny" });
      const parts = body.messages[0]!.content;
      expect(parts[0]).toEqual({ type: "text", text: "Prueba x" });
      expect(parts[1]?.image_url?.url.startsWith("data:image/png;base64,")).toBe(true);
      expect(parts[2]?.image_url?.url.startsWith("data:image/webp;base64,")).toBe(true);
      return reply({
        choices: [
          {
            message: {
              content: "",
              images: [
                {
                  type: "image_url",
                  image_url: { url: `data:image/png;base64,${PNG.toString("base64")}` },
                },
              ],
            },
          },
        ],
        usage: { prompt_tokens: 1200, completion_tokens: 1290 },
      });
    });
    const result = await provider(fetchImpl as typeof fetch).generate(task, { note: "x" });
    expect(result.image.mimeType).toBe("image/png");
    expect(result.image.data.equals(PNG)).toBe(true);
    expect(result.usage).toEqual({ images: 1, inputTokens: 1200, outputTokens: 1290 });
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.redirect).toBe("error");
  });

  it("sin imagen en la respuesta es salida inválida (con el uso para registrar el costo)", async () => {
    const fetchImpl = vi.fn(async () =>
      reply({
        choices: [{ message: { content: "No puedo" } }],
        usage: { prompt_tokens: 5, completion_tokens: 2 },
      }),
    );
    await expect(
      provider(fetchImpl as typeof fetch).generate(task, { note: "x" }),
    ).rejects.toMatchObject({
      kind: "invalid_output",
      usage: { inputTokens: 5, outputTokens: 2 },
    });
  });

  it("reintenta una vez ante 429 y clasifica 402 como falta de saldo", async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls += 1;
      if (calls === 1) return reply({}, 429, { "retry-after": "1" });
      return reply({}, 402);
    });
    const error = await provider(fetchImpl as typeof fetch)
      .generate(task, { note: "x" })
      .catch((cause: unknown) => cause);
    expect(error).toBeInstanceOf(AIProviderError);
    expect((error as AIProviderError).kind).toBe("no_credit");
    expect(calls).toBe(2);
  });

  it("no manda más de lo permitido", async () => {
    const big: ImageTask<null> = {
      task: "virtual_try_on",
      promptVersion: "test@1",
      prompt: () => ({
        instructions: "x",
        images: [{ data: Buffer.alloc(9 * 1024 * 1024), mimeType: "image/png" }],
      }),
      mock: async () => ({ data: PNG, mimeType: "image/png" }),
    };
    const fetchImpl = vi.fn();
    await expect(provider(fetchImpl as typeof fetch).generate(big, null)).rejects.toMatchObject({
      kind: "input_too_large",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("lee la imagen de las partes del contenido y rechaza data URLs que no son imagen", () => {
    expect(
      extractImageDataUrl({
        content: [{ type: "image_url", image_url: { url: "data:image/webp;base64,AAAA" } }],
      }),
    ).toBe("data:image/webp;base64,AAAA");
    expect(extractImageDataUrl({ content: "texto" })).toBeNull();
    expect(decodeDataUrl("data:text/plain;base64,AAAA")).toBeNull();
    expect(decodeDataUrl("data:image/png;base64,")).toBeNull();
    expect(decodeDataUrl(`data:image/png;base64,${PNG.toString("base64")}`)?.mimeType).toBe(
      "image/png",
    );
  });

  it("no expone la llave al serializar", () => {
    const json = JSON.stringify(provider(vi.fn() as unknown as typeof fetch));
    expect(json).not.toContain("sk-or-v1");
    expect(json).toContain("openrouter.ai");
  });
});
