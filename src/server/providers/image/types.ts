/**
 * Proveedor de imágenes por interfaz (ADR-005, ADR-043): «Pruébatelo» y, después, creativos. Como
 * las tareas de texto, cada tarea define su prompt, sus entradas y su resultado simulado; el
 * proveedor solo transporta. Implementaciones: `mock` (sin red ni costo) y `openai_compatible`
 * (modelos que generan imágenes desde el chat, p. ej. OpenRouter con `modalities`).
 */
export const IMAGE_TASKS = ["virtual_try_on"] as const;
export type ImageTaskId = (typeof IMAGE_TASKS)[number];

export type ImageInput = { data: Buffer; mimeType: string };

export type ImagePrompt = {
  /** Instrucciones sin datos personales (nunca nombres ni usuarios). */
  instructions: string;
  /** Imágenes de entrada, la principal primero (la foto de la persona). */
  images: ImageInput[];
};

export type ImageTask<Input> = {
  readonly task: ImageTaskId;
  /** Versión del prompt; va en `AIRequest.promptVersion` y en la firma de la caché. */
  readonly promptVersion: string;
  prompt(input: Input): ImagePrompt;
  /** Resultado simulado (sin red): compone algo visible con las entradas. */
  mock(input: Input): Promise<ImageInput>;
};

export type ImageUsage = {
  images: number;
  inputTokens: number;
  outputTokens: number;
  /** true si el proveedor no informó tokens. */
  estimated?: boolean;
};

export type ImageResult = { image: ImageInput; usage: ImageUsage };

export interface ImageProvider {
  readonly id: "mock" | "openai_compatible";
  /** Id del modelo tal como lo recibe el proveedor. */
  readonly model: string;
  generate<Input>(task: ImageTask<Input>, input: Input): Promise<ImageResult>;
}

/** Modelo del simulador (tiene precio 0 en la tabla de costos). */
export const MOCK_IMAGE_MODEL = "mock-image";

/** Tope de bytes que se mandan al proveedor (fotos ya recodificadas a ≤ 1600 px). */
export const MAX_IMAGE_INPUT_BYTES = 8 * 1024 * 1024;
