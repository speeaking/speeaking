/**
 * Lee un cuerpo de petición contando bytes y se detiene en cuanto pasa `maxBytes` (SEC-03). Con
 * `Transfer-Encoding: chunked` no hay `Content-Length` que revisar antes: `request.formData()` leería
 * el cuerpo completo a memoria (300 MB → ~600 MB de RAM) antes de rechazarlo.
 *
 * Con `timeoutMs`, un cliente que manda el cuerpo a cuentagotas (para ocupar un lugar de la cola)
 * también se corta.
 *
 * Al pasarse o vencer el tiempo deja de leer sin guardar nada más, pero NO cancela el flujo: en Next
 * eso destruye el socket y el cliente no recibiría la respuesta (413/408). Quien responde debe mandar
 * `Connection: close` para que Node cierre la conexión en lugar de esperar el resto del cuerpo.
 */
export type BodyReadResult =
  { ok: true; data: Buffer<ArrayBuffer> } | { ok: false; reason: "TOO_LARGE" | "TIMEOUT" };

export async function readBodyWithLimit(
  body: ReadableStream<Uint8Array> | null,
  maxBytes: number,
  { timeoutMs }: { timeoutMs?: number } = {},
): Promise<BodyReadResult> {
  if (!body) return { ok: true, data: Buffer.alloc(0) };
  const reader = body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timedOut =
    timeoutMs === undefined
      ? null
      : new Promise<"TIMEOUT">((resolve) => {
          timer = setTimeout(() => resolve("TIMEOUT"), timeoutMs);
        });
  try {
    for (;;) {
      const next = reader.read();
      const result = timedOut ? await Promise.race([next, timedOut]) : await next;
      if (result === "TIMEOUT") {
        // La lectura pendiente se rechaza al soltar el lector: se ignora.
        next.catch(() => {});
        return { ok: false, reason: "TIMEOUT" };
      }
      if (result.done) break;
      total += result.value.byteLength;
      if (total > maxBytes) return { ok: false, reason: "TOO_LARGE" };
      chunks.push(result.value);
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }
  return { ok: true, data: Buffer.concat(chunks, total) };
}

/** `Content-Length` como entero ≥ 0, o `null` si falta (chunked) o no es un número válido. */
export function parseContentLength(value: string | null): number | null {
  const trimmed = value?.trim();
  if (!trimmed || !/^\d{1,15}$/.test(trimmed)) return null;
  return Number(trimmed);
}
