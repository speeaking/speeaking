import { describe, expect, it } from "vitest";
import { parseContentLength, readBodyWithLimit } from "./limited-body";

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

/** Manda un trozo y luego nunca más (cliente lento a propósito). */
function stalledBody() {
  return new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array(10));
    },
  });
}

describe("readBodyWithLimit", () => {
  it("devuelve el cuerpo completo si cabe", async () => {
    const result = await readBodyWithLimit(new Response("hola mundo").body, 100);

    expect(result.ok && result.data.toString()).toBe("hola mundo");
  });

  it("se detiene en cuanto pasa el tope (SEC-03): no lee un cuerpo infinito", async () => {
    const { stream, pulled } = endlessBody(1024 * 1024);

    await expect(readBodyWithLimit(stream, 10 * 1024 * 1024)).resolves.toEqual({
      ok: false,
      reason: "TOO_LARGE",
    });
    // 11 trozos de 1 MB (el que pasa el tope) y quizá uno adelantado; nunca cientos.
    expect(pulled()).toBeLessThanOrEqual(12);
  });

  it("el tope es inclusivo y un cuerpo vacío es válido", async () => {
    const exact = await readBodyWithLimit(new Response("12345").body, 5);
    const over = await readBodyWithLimit(new Response("123456").body, 5);
    const empty = await readBodyWithLimit(null, 5);

    expect(exact.ok && exact.data.length).toBe(5);
    expect(over).toEqual({ ok: false, reason: "TOO_LARGE" });
    expect(empty.ok && empty.data.length).toBe(0);
  });

  it("corta a quien manda el cuerpo a cuentagotas", async () => {
    const started = performance.now();

    await expect(readBodyWithLimit(stalledBody(), 1000, { timeoutMs: 50 })).resolves.toEqual({
      ok: false,
      reason: "TIMEOUT",
    });
    expect(performance.now() - started).toBeLessThan(1000);
  });
});

describe("parseContentLength", () => {
  it("solo acepta enteros decimales; chunked (sin cabecera) o basura dan null", () => {
    expect(parseContentLength("1024")).toBe(1024);
    expect(parseContentLength(" 0 ")).toBe(0);
    expect(parseContentLength(null)).toBeNull();
    expect(parseContentLength("")).toBeNull();
    expect(parseContentLength("-1")).toBeNull();
    expect(parseContentLength("1e9")).toBeNull();
    expect(parseContentLength("10, 10")).toBeNull();
    expect(parseContentLength("9".repeat(16))).toBeNull();
  });
});
