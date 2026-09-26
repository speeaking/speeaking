import { describe, expect, it } from "vitest";
import { readBodyWithLimit } from "./limited-body";

/** Cuerpo "chunked" sin fin que cuenta cuántos trozos se le pidieron. */
function endlessBody(chunkBytes: number) {
  let pulled = 0;
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(chunkBytes));
    },
  });
  return { stream, pulled: () => pulled };
}

describe("readBodyWithLimit", () => {
  it("devuelve el cuerpo completo si cabe", async () => {
    const result = await readBodyWithLimit(new Response("hola mundo").body, 100);

    expect(result?.toString()).toBe("hola mundo");
  });

  it("se detiene en cuanto pasa el tope (SEC-03): no lee un cuerpo infinito", async () => {
    const { stream, pulled } = endlessBody(1024 * 1024);

    await expect(readBodyWithLimit(stream, 10 * 1024 * 1024)).resolves.toBeNull();
    // 11 trozos de 1 MB (el que pasa el tope) y quizá uno adelantado; nunca cientos.
    expect(pulled()).toBeLessThanOrEqual(12);
  });

  it("el tope es inclusivo y un cuerpo vacío es válido", async () => {
    expect((await readBodyWithLimit(new Response("12345").body, 5))?.length).toBe(5);
    expect(await readBodyWithLimit(new Response("123456").body, 5)).toBeNull();
    expect((await readBodyWithLimit(null, 5))?.length).toBe(0);
  });
});
