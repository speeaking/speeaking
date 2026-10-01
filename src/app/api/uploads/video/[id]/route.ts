import { z } from "zod";
import { parseContentLength } from "@/modules/media/limited-body";
import { getViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { getVideoStore } from "@/server/providers/storage";
import { LocalVideoStore } from "@/server/providers/storage/video-store";

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Recibe el archivo de un video en DESARROLLO (disco local, ADR-062). Con el bucket, el navegador
 * sube directo a R2 con una URL firmada y esta ruta responde 404. Solo acepta el video que su dueño
 * empezó con `startVideoUpload` (fila en PROCESSING) y exactamente el tamaño que declaró.
 */
export async function PUT(request: Request, context: RouteContext<"/api/uploads/video/[id]">) {
  const store = getVideoStore();
  if (!(store instanceof LocalVideoStore)) return json({ error: "No encontrado." }, 404);
  const viewer = await getViewer();
  if (!viewer) return json({ error: "Inicia sesión para subir videos." }, 401);

  const { id } = await context.params;
  if (!z.uuid().safeParse(id).success) return json({ error: "No encontrado." }, 404);
  const media = await db.media.findFirst({
    where: { id, ownerId: viewer.userId, kind: "VIDEO", status: "PROCESSING" },
    select: { storageKey: true, sizeBytes: true },
  });
  if (!media) return json({ error: "No encontrado." }, 404);
  if (parseContentLength(request.headers.get("content-length")) !== media.sizeBytes) {
    return json({ error: "El tamaño del video no coincide." }, 400);
  }
  if (!request.body) return json({ error: "No recibimos el video." }, 400);

  const result = await store.receive(
    media.storageKey,
    request.body as unknown as AsyncIterable<Uint8Array>,
    media.sizeBytes,
  );
  if (result === "too_large") return json({ error: "El video pesa más de lo declarado." }, 413);
  if (result === "incomplete") return json({ error: "El video no llegó completo." }, 400);
  return json({ ok: true });
}
