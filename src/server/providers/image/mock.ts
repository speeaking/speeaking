import type { ImageProvider, ImageResult, ImageTask } from "./types";
import { MOCK_IMAGE_MODEL } from "./types";

/**
 * Proveedor de imágenes simulado: sin red ni costo. Devuelve lo que compone la tarea
 * (`task.mock`), que en Pruébatelo es la foto con las prendas encimadas y una marca de agua: sirve
 * para desarrollo, pruebas y como interruptor de apagado.
 */
export class MockImageProvider implements ImageProvider {
  readonly id = "mock" as const;
  readonly model = MOCK_IMAGE_MODEL;

  async generate<Input>(task: ImageTask<Input>, input: Input): Promise<ImageResult> {
    const image = await task.mock(input);
    return { image, usage: { images: 1, inputTokens: 0, outputTokens: 0 } };
  }
}
