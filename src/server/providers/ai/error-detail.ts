/**
 * Mensaje de error del proveedor en una respuesta no exitosa (`{ error: { message } }` en la API de
 * OpenAI y OpenRouter), en una sola línea y acotado, para que el registro diga POR QUÉ falló (p. ej.
 * «No endpoints found matching your data policy») y no solo el código HTTP. `null` si no hay cuerpo
 * legible. Nunca lanza.
 */
export async function readErrorDetail(
  response: Pick<Response, "text">,
  maxLength = 160,
): Promise<string | null> {
  try {
    const text = await response.text();
    if (!text) return null;
    let message: unknown = text;
    try {
      const parsed = JSON.parse(text) as {
        error?: { message?: unknown } | string;
        message?: unknown;
      };
      message =
        typeof parsed.error === "string"
          ? parsed.error
          : (parsed.error?.message ?? parsed.message ?? null);
    } catch {
      // Cuerpo que no es JSON (HTML de un proxy, texto plano): se usa tal cual, acotado.
    }
    if (typeof message !== "string") return null;
    const oneLine = message.replace(/\s+/g, " ").trim();
    return oneLine ? oneLine.slice(0, maxLength) : null;
  } catch {
    return null;
  }
}
