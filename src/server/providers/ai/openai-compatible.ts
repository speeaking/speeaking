import {
  AI_CALL_TIMEOUT_MS,
  AI_IMAGE_INPUT_TOKENS,
  AI_MAX_INPUT_TOKENS,
  AI_MAX_OUTPUT_TOKENS,
} from "@/modules/ai/cost";
import { AIProviderError } from "./errors";
import { readErrorDetail } from "./error-detail";
import { strictJsonSchema } from "./json-schema";
import type { AIProvider, AIResult, AITask, AIUsage } from "./types";

export type OpenAICompatibleConfig = {
  /** Termina en `/v1` (p. ej. `https://openrouter.ai/api/v1`). */
  baseUrl: string;
  apiKey: string;
  model: string;
  /** Plazo total de la llamada, reintentos incluidos. */
  timeoutMs?: number;
  /** Reintentos ante 429 o 5xx (máximo 2). */
  maxRetries?: number;
  /** Para pruebas. */
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  random?: () => number;
};

/** Caracteres por token para estimar SIN tokenizador. 3 es conservador en español (≈ 4 real). */
const CHARS_PER_TOKEN = 3;
const MAX_RETRIES = 2;
const BACKOFF_BASE_MS = 500;
const MAX_RETRY_AFTER_MS = 10_000;

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export function estimateTokens(text: string) {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

type ChatCompletion = {
  choices?: {
    finish_reason?: string | null;
    message?: { content?: unknown; refusal?: string | null };
  }[];
  usage?: { prompt_tokens?: unknown; completion_tokens?: unknown };
};

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/** Texto de la respuesta: cadena o partes `{ type: "text", text }`. */
function contentText(content: unknown): string | null {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) =>
        typeof part === "object" && part && "text" in part && typeof part.text === "string"
          ? part.text
          : "",
      )
      .join("");
  }
  return null;
}

/** Quita un bloque de razonamiento (`<think>…</think>`) y cercas de código alrededor del JSON. */
export function unwrapJson(text: string) {
  return text
    .replace(/^\s*<think>[\s\S]*?<\/think>/u, "")
    .trim()
    .replace(/^```(?:json)?\s*/u, "")
    .replace(/\s*```$/u, "")
    .trim();
}

/**
 * Ajustes por proveedor conocido. OpenRouter:
 * - Privacidad: solo proveedores que no recolectan datos (`data_collection: "deny"`) y con cero
 *   retención (`zdr: true`), y que soportan todos los parámetros pedidos (sin `response_format`, la
 *   salida no vendría estructurada).
 * - Sin razonamiento (`reasoning.enabled: false`): los modelos que «piensan» por defecto (Qwen 3.5)
 *   gastaban todo `max_tokens` en el razonamiento y nunca escribían la respuesta (evaluación del
 *   2026-09-27: 0 de 29 JSON válidos). Nuestras tareas son cortas y estructuradas; el razonamiento
 *   solo sumaba costo.
 * Otros servidores (vLLM, Ollama, DeepInfra…) no reciben campos que no conocen.
 */
function providerExtras(baseUrl: URL): Record<string, unknown> {
  if (baseUrl.hostname === "openrouter.ai" || baseUrl.hostname.endsWith(".openrouter.ai")) {
    return {
      provider: { data_collection: "deny", zdr: true, require_parameters: true },
      reasoning: { enabled: false },
    };
  }
  return {};
}

/**
 * Adaptador para cualquier servidor con la API de OpenAI (`POST {base}/chat/completions`):
 * OpenRouter, DeepInfra, Together, o vLLM/Ollama en un servidor rentado. Sin SDK de ningún
 * proveedor. Nada corre en la PC: es una llamada HTTPS a un servidor externo de pago por uso.
 *
 * - Entrada acotada ANTES de llamar (`AI_MAX_INPUT_TOKENS`) y salida con `max_tokens`: el costo de
 *   una llamada nunca pasa de lo que reservó el guardián (ADR-031).
 * - Plazo total con `AbortController` (reintentos incluidos) y hasta 2 reintentos con espera
 *   creciente ante 429 o 5xx (respeta `Retry-After`). Un corte de red o un plazo vencido NO se
 *   reintenta: el proveedor pudo haber cobrado ya esa llamada.
 * - La salida se valida SIEMPRE con el esquema de la tarea; si no cumple, `invalid_output` con el
 *   uso que informó el proveedor (para registrar el costo).
 * - La llave vive en un campo privado: no aparece en `JSON.stringify`, `console.log` ni errores.
 * - Sin redirecciones (`redirect: "error"`): la petición solo va al servidor de `AI_BASE_URL`.
 */
export class OpenAICompatibleProvider implements AIProvider {
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

  constructor(config: OpenAICompatibleConfig) {
    const base = new URL(config.baseUrl);
    // Se cambia solo la ruta sobre la URL base: un `AI_BASE_URL` como `https://a.com//b.com` no puede
    // convertirse en otra máquina (una ruta que empieza con `//` resuelta con `new URL(ruta, base)`
    // cambiaría de host y la llave viajaría a ese otro servidor).
    const endpoint = new URL(base.href);
    endpoint.pathname = `${base.pathname.replace(/\/+$/, "")}/chat/completions`;
    endpoint.search = "";
    endpoint.hash = "";
    if (endpoint.origin !== base.origin) throw new Error("[ai] AI_BASE_URL inválida.");
    this.#endpoint = endpoint;
    this.#extras = providerExtras(base);
    this.model = config.model;
    this.#apiKey = config.apiKey;
    this.#timeoutMs = config.timeoutMs ?? AI_CALL_TIMEOUT_MS;
    this.#maxRetries = Math.min(Math.max(config.maxRetries ?? MAX_RETRIES, 0), MAX_RETRIES);
    this.#fetch = config.fetch ?? fetch;
    this.#sleep = config.sleep ?? defaultSleep;
    this.#random = config.random ?? Math.random;
  }

  /** Sin la llave (por si alguien imprime el proveedor). */
  toJSON() {
    return { id: this.id, model: this.model, endpoint: this.#endpoint.origin };
  }

  async generate<Input, Output>(
    task: AITask<Input, Output>,
    input: Input,
  ): Promise<AIResult<Output>> {
    const { system, user, images = [] } = task.messages(input);
    // El esquema estricto también entra al contexto del modelo (varios servidores lo insertan en el
    // prompt): cuenta para el tope de entrada, así el costo real no pasa del reservado.
    const schema = task.format === "json" ? strictJsonSchema(task.output) : null;
    const promptTokens =
      estimateTokens(system) +
      estimateTokens(user) +
      (schema ? estimateTokens(JSON.stringify(schema)) : 0) +
      images.length * AI_IMAGE_INPUT_TOKENS;
    if (promptTokens > AI_MAX_INPUT_TOKENS) {
      throw new AIProviderError(
        "input_too_large",
        `[ai] entrada de ${task.task} ≈ ${promptTokens} tokens (máx. ${AI_MAX_INPUT_TOKENS})`,
      );
    }
    const body = JSON.stringify({
      model: this.model,
      messages: [
        { role: "system", content: system },
        // Con fotos, el mensaje va en partes: el texto y cada foto (ADR-061).
        {
          role: "user",
          content:
            images.length === 0
              ? user
              : [
                  { type: "text", text: user },
                  ...images.map((url) => ({ type: "image_url", image_url: { url } })),
                ],
        },
      ],
      temperature: task.temperature,
      max_tokens: Math.min(task.maxOutputTokens, AI_MAX_OUTPUT_TOKENS),
      ...(task.format === "json"
        ? {
            response_format: {
              type: "json_schema",
              json_schema: {
                name: task.schemaName,
                strict: true,
                schema,
              },
            },
          }
        : {}),
      ...this.#extras,
    });

    const data = await this.#post(body, task.task);
    const choice = data.choices?.[0];
    const text = contentText(choice?.message?.content) ?? "";
    const usage = readUsage(data, promptTokens, text);
    const fail = (reason: string) =>
      new AIProviderError("invalid_output", `[ai] ${task.task} (${this.model}): ${reason}`, usage);

    if (choice?.message?.refusal) throw fail("el modelo se negó a responder");
    if (choice?.finish_reason === "length") throw fail("la respuesta se cortó en max_tokens");
    if (!text.trim()) throw fail("respuesta vacía");

    let raw: unknown = text.trim();
    if (task.format === "json") {
      try {
        raw = JSON.parse(unwrapJson(text));
      } catch {
        throw fail("la respuesta no es JSON");
      }
    }
    const parsed = task.output.safeParse(raw);
    if (!parsed.success) throw fail("la respuesta no cumple el esquema");
    return { output: parsed.data, usage };
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
      let detail: string | null = null;
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
          // Una redirección no se sigue: la llave (y el texto del vendedor) solo van al servidor
          // configurado, nunca a donde este mande.
          redirect: "error",
        });
        if (response.ok) data = await response.json();
        else detail = await readErrorDetail(response);
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
        `[ai] ${task} (${this.model}): HTTP ${status}${detail ? ` (${detail})` : ""}`,
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

  /** 500 ms, 1.5 s (+ hasta 250 ms al azar), o lo que pida `Retry-After` (máx. 10 s). */
  #backoff(attempt: number, retryAfter: string | null) {
    const seconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    if (Number.isFinite(seconds) && seconds >= 0) {
      return Math.min(seconds * 1000, MAX_RETRY_AFTER_MS);
    }
    return BACKOFF_BASE_MS * 3 ** attempt + Math.floor(this.#random() * 250);
  }
}

/** Uso informado por el proveedor; si falta, una estimación marcada como tal (nunca 0 a ciegas). */
function readUsage(data: ChatCompletion, promptTokens: number, text: string): AIUsage {
  const input = data.usage?.prompt_tokens;
  const output = data.usage?.completion_tokens;
  if (isCount(input) && isCount(output)) return { inputTokens: input, outputTokens: output };
  return { inputTokens: promptTokens, outputTokens: estimateTokens(text), estimated: true };
}
