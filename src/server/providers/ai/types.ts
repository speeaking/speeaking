import type { z } from "zod";

/**
 * Tareas de IA que se enrutan por separado (`ai.routing`, ADR-034). Cada una puede usar otro
 * modelo: el más barato que pase su evaluación.
 */
export const AI_TASKS = [
  "sale_proposal",
  "ad_copy",
  "analyst_narrative",
  "authenticity_text",
] as const;
export type AITaskId = (typeof AI_TASKS)[number];

export type AIUsage = {
  inputTokens: number;
  outputTokens: number;
  /** true si el proveedor no informó el uso y se estimó por la longitud del texto. */
  estimated?: boolean;
};

export type AIMessages = { system: string; user: string };

/**
 * Una tarea de IA (ADR-005, ADR-034): operación de dominio con salida estructurada, no un chat
 * genérico. El módulo dueño define el prompt, el esquema de salida y la respuesta simulada; el
 * proveedor solo transporta y valida. La salida SIEMPRE pasa por `output` antes de devolverse.
 *
 * - `format: "json"`: se pide JSON con `response_format: json_schema` estricto (generado de
 *   `output`). Usa `.nullable()` en lugar de `.optional()`: el modo estricto exige todas las llaves.
 * - `format: "text"`: texto libre; `output` suele ser `z.string()`.
 */
export type AITask<Input, Output> = {
  readonly task: AITaskId;
  /** Versión del prompt; se registra en `AIRequest.promptVersion` y en las evaluaciones. */
  readonly promptVersion: string;
  readonly format: "json" | "text";
  /** Nombre del esquema para `json_schema` (letras, dígitos, `_` y `-`). */
  readonly schemaName: string;
  readonly output: z.ZodType<Output>;
  readonly temperature: number;
  /** Tokens máximos de salida (el adaptador nunca pide más que `AI_MAX_OUTPUT_TOKENS`). */
  readonly maxOutputTokens: number;
  /** Mensajes para el modelo. Solo datos que PUEDEN salir de la plataforma (nunca el costo). */
  messages(input: Input): AIMessages;
  /** Respuesta determinista del proveedor simulado (desarrollo y pruebas). */
  mock(input: Input): unknown;
};

export type AIResult<Output> = { output: Output; usage: AIUsage };

/** Implementaciones: `mock` (sin red ni costo) y `openai_compatible` (modelo abierto por API). */
export interface AIProvider {
  readonly id: "mock" | "openai_compatible";
  /** Id del modelo tal como lo recibe el proveedor (p. ej. `qwen/qwen3.5-9b`). */
  readonly model: string;
  generate<Input, Output>(task: AITask<Input, Output>, input: Input): Promise<AIResult<Output>>;
}
