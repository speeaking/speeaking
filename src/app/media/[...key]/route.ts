import { getStorage } from "@/server/providers/storage";
import { InvalidStorageKeyError } from "@/server/providers/storage/types";

/** Sirve archivos del almacenamiento local. En producción los sirve S3/R2 directamente. */
export async function GET(_request: Request, context: RouteContext<"/media/[...key]">) {
  const { key } = await context.params;

  try {
    const file = await getStorage().get(key.join("/"));
    if (!file) {
      return new Response("No encontrado", { status: 404 });
    }
    return new Response(new Uint8Array(file.data), {
      headers: {
        "Content-Type": file.contentType,
        // Las claves son únicas e inmutables.
        "Cache-Control": "public, max-age=31536000, immutable",
        // Aunque alguien lograra subir otro tipo de archivo, el navegador no ejecutaría nada.
        "Content-Security-Policy": "default-src 'none'; sandbox",
      },
    });
  } catch (error) {
    if (error instanceof InvalidStorageKeyError) {
      return new Response("Solicitud inválida", { status: 400 });
    }
    throw error;
  }
}
