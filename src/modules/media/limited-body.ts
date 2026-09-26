/**
 * Lee un cuerpo de petición contando bytes y se detiene en cuanto pasa `maxBytes` (SEC-03). Con
 * `Transfer-Encoding: chunked` no hay `Content-Length` que revisar antes: `request.formData()` leería
 * el cuerpo completo a memoria (300 MB → ~600 MB de RAM) antes de rechazarlo.
 *
 * Devuelve los bytes o `null` si el cuerpo es más grande que el tope. Al pasarse deja de leer (y no
 * guarda nada más); quien responde debe cerrar la conexión (`Connection: close`) para no seguir
 * recibiendo el resto.
 */
export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
): Promise<Buffer | null> {
  if (!body) return Buffer.alloc(0);
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > maxBytes) return null;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(chunks, total);
}
