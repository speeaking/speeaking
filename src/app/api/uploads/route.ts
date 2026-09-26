import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import {
  ImageValidationError,
  MAX_UPLOAD_BYTES,
  processImage,
} from "@/modules/media/image-processing";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";

const MAX_UPLOADS_PER_HOUR = 60;

const MESSAGES: Record<ImageValidationError["code"], string> = {
  TOO_LARGE: "La imagen pesa más de 10 MB.",
  UNSUPPORTED_FORMAT: "Formato no admitido. Usa JPG, PNG, WebP, AVIF o GIF.",
  CORRUPT: "No pudimos leer la imagen. Prueba con otra.",
};

function json(body: unknown, status = 200) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/** Sube una imagen: valida su contenido real, elimina metadatos (GPS) y la guarda. */
export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return json({ error: "Inicia sesión para subir imágenes." }, 401);

  const declaredLength = Number(request.headers.get("content-length") ?? 0);
  if (declaredLength > MAX_UPLOAD_BYTES + 64 * 1024) {
    return json({ error: MESSAGES.TOO_LARGE }, 413);
  }

  const recent = await db.media.count({
    where: { ownerId: session.user.id, createdAt: { gte: new Date(Date.now() - 3_600_000) } },
  });
  if (recent >= MAX_UPLOADS_PER_HOUR) {
    return json({ error: "Subiste muchas imágenes en poco tiempo. Espera un momento." }, 429);
  }

  const file = (await request.formData()).get("file");
  if (!(file instanceof File)) return json({ error: "No recibimos ninguna imagen." }, 400);

  try {
    const image = await processImage(Buffer.from(await file.arrayBuffer()));
    const now = new Date();
    const storageKey = `images/${now.getUTCFullYear()}/${String(now.getUTCMonth() + 1).padStart(2, "0")}/${randomUUID()}.webp`;
    const storage = getStorage();
    await storage.put(storageKey, image.buffer);
    const media = await db.media.create({
      data: {
        ownerId: session.user.id,
        storageKey,
        mimeType: image.mimeType,
        width: image.width,
        height: image.height,
        sizeBytes: image.sizeBytes,
        blurDataUrl: image.blurDataUrl,
      },
      select: { id: true, width: true, height: true },
    });
    return json({ ...media, url: storage.publicUrl(storageKey) }, 201);
  } catch (error) {
    if (error instanceof ImageValidationError) return json({ error: MESSAGES[error.code] }, 422);
    throw error;
  }
}
