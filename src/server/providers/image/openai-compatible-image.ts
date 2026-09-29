import { AIProviderError } from "../ai/errors";
import {
  type ImageProvider,
  type ImageResult,
  type ImageTask,
  type ImageUsage,
  MAX_IMAGE_INPUT_BYTES,
} from "./types";

export type OpenAICompatibleImageConfig = {
  /** Termina en `/v1` (p. ej. `https://openrouter.ai/api/v1`). */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Plazo total de la llamada, reintentos incluidos. Generar una imagen tarda más que un texto. */
  timeoutMs?: number;
  /** Reintentos ante 429 o 5xx (máximo 2). */
  maxRetries?: number;
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

export const IMAGE_CALL_TIMEOUT_MS = 90_000;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 1_000;
const MAX_RETRY_AFTER_MS = 15_000;
const DATA_URL = /^data:(image\/[a-z0-9.+-]+);base64,([A-Za-z0-9+/=\s]+)$/i;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

type ImagePart = { type?: string; image_url?: { url?: unknown }; url?: unknown };

type ChatMessage = { content?: unknown; images?: unknown; refusal?: string | null };

type ChatCompletion = {
  choices?: { finish_reason?: string | null; message?: ChatMessage }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
};

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Primera imagen de la respuesta: `message.images[]` (OpenRouter) o una parte del contenido. */
export function extractImageDataUrl(message: ChatMessage): string | null {
  const candidates: unknown[] = [];
  if (Array.isArray(message.images)) candidates.push(...message.images);
  if (Array.isArray(message.content)) candidates.push(...message.content);
  for (const part of candidates) {
    if (!part || typeof part !== "object") continue;
    const { image_url, url } = part as ImagePart;
    const value = typeof image_url?.url === "string" ? image_url.url : url;
    if (typeof value === "string" && value.startsWith("data:image/")) return value;
  }
  return null;
}

/** `data:image/png;base64,...` → bytes y tipo. `null` si no es una imagen en base64. */
export function decodeDataUrl(value: string): { data: Buffer; mimeType: string } | null {
  const match = DATA_URL.exec(value);
  if (!match) return null;
  const data = Buffer.from(match[2]!.replace(/\s+/g, ""), "base64");
  return data.byteLength > 0 ? { data, mimeType: match[1]!.toLowerCase() } : null;
}

/** Ajustes por proveedor conocido: OpenRouter sin recolección ni retención de datos (ADR-034). */
function providerExtras(baseUrl: URL): Record<string, unknown> {
  if (baseUrl.hostname === "openrouter.ai" || baseUrl.hostname.endsWith(".openrouter.ai")) {
    return { provider: { data_collection: "deny", zdr: true, require_parameters: true } };
  }
  return {};
}

/**
 * Adaptador para servidores con la API de OpenAI que generan imágenes desde el chat
 * (`POST {base}/chat/completions` con `modalities: ["image", "text"]`, como OpenRouter). Mismas
 * defensas que el adaptador de texto: plazo total, reintentos solo ante 429/5xx, sin redirecciones,
 * llave en un campo privado y entrada acotada antes de llamar. La foto de la persona viaja solo al
 * servidor configurado (ADR-045).
 */
export class OpenAICompatibleImageProvider implements ImageProvider {
  readonly id = "openai_compatible" as const;
  readonly model: string;
  readonly #apiKey: string;
  readonly #endpoint: URL;
  readonly #extras: Record<string, unknown>;
  readonly #timeoutMs: number;
  readonly #maxRetries: number;
  readonly #fetch: typeof fetch;
  readonly #sleep: (ms: number) => Promise<void>;
  readonly #random: () => number;

  constructor(config: OpenAICompatibleImageConfig) {
    const base = new URL(config.baseUrl);
    const endpoint = new URL(base.href);
    endpoint.pathname = `${base.pathname.replace(/\/+$/, "")}/chat/completions`;
    endpoint.search = "";
    endpoint.hash = "";
    if (endpoint.origin !== base.origin) throw new Error("[ai] AI_BASE_URL inválida.");
    this.#endpoint = endpoint;
    this.#extras = providerExtras(base);
    this.model = config.model;
    this.#apiKey = config.apiKey;
    this.#timeoutMs = config.timeoutMs ?? IMAGE_CALL_TIMEOUT_MS;
    this.#maxRetries = Math.min(Math.max(config.maxRetries ?? 1, 0), MAX_RETRIES);
    this.#fetch = config.fetch ?? fetch;
    this.#sleep = config.sleep ?? defaultSleep;
    this.#random = config.random ?? Math.random;
  }

  toJSON() {
    return { id: this.id, model: this.model, endpoint: this.#endpoint.origin };
  }

  async generate<Input>(task: ImageTask<Input>, input: Input): Promise<ImageResult> {
    const { instructions, images } = task.prompt(input);
    const bytes = images.reduce((sum, image) => sum + image.data.byteLength, 0);
    if (images.length === 0 || bytes > MAX_IMAGE_INPUT_BYTES) {
      throw new AIProviderError(
        "input_too_large",
        `[ai] ${task.task}: ${images.length} imágenes, ${bytes} bytes (máx. ${MAX_IMAGE_INPUT_BYTES})`,
      );
    }
    const body = JSON.stringify({
      model: this.model,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instructions },
            ...images.map((image) => ({
              type: "image_url",
              image_url: {
                url: `data:${image.mimeType};base64,${image.data.toString("base64")}`,
              },
            })),
          ],
        },
      ],
      modalities: ["image", "text"],
      ...this.#extras,
    });

    const data = await this.#post(body, task.task);
    const choice = data.choices?.[0];
    const usage = readUsage(data);
    const fail = (reason: string) =>
      new AIProviderError("invalid_output", `[ai] ${task.task} (${this.model}): ${reason}`, {
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        estimated: usage.estimated,
      });
    if (choice?.message?.refusal) throw fail("el modelo se negó a generar la imagen");
    const dataUrl = choice?.message ? extractImageDataUrl(choice.message) : null;
    if (!dataUrl) throw fail("la respuesta no trae una imagen");
    const image = decodeDataUrl(dataUrl);
    if (!image) throw fail("la imagen no es base64 válido");
    return { image, usage: { ...usage, images: 1 } };
  }

  async #post(body: string, task: string): Promise<ChatCompletion> {
    const deadline = Date.now() + this.#timeoutMs;
    for (let attempt = 0; ; attempt++) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) throw this.#timeout(task);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), remaining);
      let response: Response;
      let data: unknown;
      try {
        response = await this.#fetch(this.#endpoint, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.#apiKey}`,
            "Content-Type": "application/json",
            Accept: "application/json",
          },
          body,
          signal: controller.signal,
          redirect: "error",
        });
        data = response.ok ? await response.json() : await response.body?.cancel();
      } catch (error) {
        if (controller.signal.aborted) throw this.#timeout(task);
        if (error instanceof SyntaxError) {
          throw new AIProviderError("invalid_output", `[ai] ${task}: cuerpo que no es JSON`);
        }
        throw new AIProviderError("network", `[ai] ${task}: sin respuesta del proveedor`);
      } finally {
        clearTimeout(timer);
      }
      if (response.ok) return (data ?? {}) as ChatCompletion;

      const status = response.status;
      const retryable = status === 429 || status >= 500;
      if (retryable && attempt < this.#maxRetries) {
        const wait = this.#backoff(attempt, response.headers.get("retry-after"));
        if (Date.now() + wait < deadline) {
          await this.#sleep(wait);
          continue;
        }
      }
      const kind =
        status === 429
          ? "rate_limited"
          : status >= 500
            ? "unavailable"
            : status === 401 || status === 403
              ? "auth"
              : status === 402
                ? "no_credit"
                : "bad_request";
      throw new AIProviderError(
        kind,
        `[ai] ${task} (${this.model}): HTTP ${status}`,
        undefined,
        status,
      );
    }
  }

  #timeout(task: string) {
    return new AIProviderError(
      "timeout",
      `[ai] ${task} (${this.model}): sin respuesta en ${this.#timeoutMs} ms`,
    );
  }

  #backoff(attempt: number, retryAfter: string | null) {
    const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    }
    return BACKOFF_BASE_MS * 3 ** attempt + Math.floor(this.#random() * 500);
  }
}

function readUsage(data: ChatCompletion): ImageUsage {
  const input = data.usage?.prompt_tokens;
  const output = data.usage?.completion_tokens;
  if (isCount(input) && isCount(output))
    return { images: 1, inputTokens: input, outputTokens: output };
  return { images: 1, inputTokens: 0, outputTokens: 0, estimated: true };
}
