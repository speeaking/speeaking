import { AIProviderError } from "./errors";
import type { AIProvider, AIResult, AITask } from "./types";

/**
 * Proveedor simulado y determinista: sin red ni costo. Devuelve la respuesta simulada de cada tarea
 * (`task.mock`) y la valida con el mismo esquema que una respuesta real: es el contrato que cumple
 * cualquier proveedor. Para desarrollo, pruebas y como interruptor de apagado de la IA de pago.
 */
export class MockAIProvider implements AIProvider {
  readonly id = "mock" as const;
  readonly model = "mock";

  async generate<Input, Output>(
    task: AITask<Input, Output>,
    input: Input,
  ): Promise<AIResult<Output>> {
    const parsed = task.output.safeParse(task.mock(input));
    if (!parsed.success) {
      throw new AIProviderError("invalid_output", `[ai] mock de ${task.task} no cumple el esquema`);
    }
    return { output: parsed.data, usage: { inputTokens: 0, outputTokens: 0 } };
  }
}
