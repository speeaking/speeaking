import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import {
  BusyError,
  createKeyedLimiter,
  createLimiter,
  KeyBusyError,
} from "@/modules/media/concurrency";
import {
  type ImageValidationCode,
  ImageValidationError,
  MAX_UPLOAD_BYTES,
  processImage,
} from "@/modules/media/image-processing";
import { parseContentLength, readBodyWithLimit } from "@/modules/media/limited-body";
import { getViewer } from "@/modules/identity/session";
import {
  BLOCKED_UPLOAD_MESSAGE,
  isBlockedHash,
  logBlockedUpload,
  sha256Hex,
} from "@/modules/rights/stay-down";
import { clientIp } from "@/server/client-ip";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { limitOrError, rateLimitKey, rateLimitMany } from "@/server/rate-limit";

/** Cuerpo multipart máximo: la imagen más los encabezados de la parte y el delimitador. */
const MAX_BODY_BYTES = MAX_UPLOAD_BYTES + 64 * 1024;
/**
 * Intentos por ventana (ADR-021), contados ANTES de leer el cuerpo y aunque fallen (SEC-12): el
 * trabajo caro (leer 10 MB, decodificar) ya no es gratis para quien manda basura. Un vendedor con 10
 * fotos por producto cabe de sobra.
 */
const UPLOAD_LIMITS = {
  ipPerHour: 120,
  userPerHour: 60,
  userPerDay: 300,
} as const;
/**
 * Subidas que leen cuerpo o procesan a la vez en este proceso, y cuántas esperan turno. Esperar no
 * cuesta memoria (el cuerpo sigue en el socket); leer sí (hasta ~30 MB con las copias). Cada persona
 * ocupa a lo más 2 lugares: el selector sube varias fotos en paralelo y las demás esperan en su fila
 * sin quitarle lugar a nadie (SEC-03, SEC-13).
 */
const uploads = createKeyedLimiter(createLimiter(8, 48), 2, 10);
/** Un cuerpo que llega a cuentagotas deja de ocupar su lugar (10 MB a ~1 Mbps son ~80 s). */
const BODY_TIMEOUT_MS = 120_000;
/**
 * Partes que puede traer el formulario (el selector manda solo `file`). El parser de `formData()`
 * corre en el hilo principal: 10 MB de partes diminutas (~150 mil) lo bloqueaban ~0.5 s por petición.
 */
const MAX_FORM_PARTS = 4;

const MESSAGES: Record<ImageValidationCode, string> = {
  TOO_LARGE: "La imagen pesa más de 10 MB.",
  TOO_COMPLEX: "La imagen tiene demasiados píxeles. Redúcela e intenta de nuevo.",
  UNSUPPORTED_FORMAT: "Formato no admitido. Usa JPG, PNG, WebP, AVIF o GIF.",
  CORRUPT: "No pudimos leer la imagen. Prueba con otra.",
};

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store", ...extra } });
}

/**
 * Rechazo sin haber leído (todo) el cuerpo: se pide cerrar la conexión para que Node no se quede
 * esperando el resto de lo que mande el cliente.
 */
function reject(error: string, status: number, extra: Record<string, string> = {}) {
  return json({ error }, status, { Connection: "close", ...extra });
}

function isMultipart(contentType: string | null) {
  return /^multipart\/form-data\s*;\s*boundary=/i.test(contentType ?? "");
}

/**
 * ¿Trae más de `max` partes? Cuenta los delimitadores con `Buffer.indexOf` (nativo) y se detiene en
 * cuanto pasa el tope, sin interpretar nada. `n` partes llevan `n + 1` delimitadores (el último
 * cierra el formulario).
 */
function hasTooManyParts(body: Buffer, contentType: string, max: number) {
  const match = /;\s*boundary=(?:"([^"]{1,70})"|([^\s;"]{1,70}))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2];
  if (!boundary) return true;
  const delimiter = Buffer.from(`--${boundary}`, "latin1");
  let count = 0;
  for (
    let at = body.indexOf(delimiter);
    at !== -1;
    at = body.indexOf(delimiter, at + delimiter.length)
  ) {
    count += 1;
    if (count > max + 1) return true;
  }
  return false;
}

/** Clave única e irrepetible: el archivo nunca cambia (sí puede dejar de servirse, ver `/media`). */
function newStorageKey(now = new Date()) {
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  return `images/${now.getUTCFullYear()}/${month}/${randomUUID()}.webp`;
}

/**
 * Sube una imagen: rechaza un archivo que se retiró antes (ADR-076), valida su contenido real,
 * elimina metadatos (GPS) y la guarda con la huella del archivo original. La imagen queda
 * privada (solo su dueño la ve) hasta que se adjunta a una publicación o producto; si no se adjunta
 * en 24 h, `scripts/cleanup-orphan-media.ts` la borra (SEC-14).
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return reject("Inicia sesión para subir imágenes.", 401);
  if (!viewer.profile?.onboarded) return reject("Termina tu perfil para subir imágenes.", 403);

  const limited = await rateLimitMany([
    {
      key: rateLimitKey("upload", "ip", clientIp(await headers())),
      limit: UPLOAD_LIMITS.ipPerHour,
      windowSeconds: 3600,
    },
    {
      key: rateLimitKey("upload", "user", viewer.userId),
      limit: UPLOAD_LIMITS.userPerHour,
      windowSeconds: 3600,
    },
    {
      key: rateLimitKey("upload.day", "user", viewer.userId),
      limit: UPLOAD_LIMITS.userPerDay,
      windowSeconds: 86_400,
    },
  ]);
  if (!limited.ok) {
    return reject(limitOrError(limited)!, 429, {
      "Retry-After": String(limited.retryAfterSeconds),
    });
  }

  // SEC-03: sin `Content-Length` (chunked) no se sabe cuánto va a llegar; con uno mayor al tope, ni
  // se empieza a leer. El tope se vuelve a contar al leer (defensa en profundidad).
  const contentType = request.headers.get("content-type");
  if (!isMultipart(contentType)) return reject("Envía la imagen como formulario.", 415);
  const declaredLength = parseContentLength(request.headers.get("content-length"));
  if (declaredLength === null) return reject("Falta el tamaño de la imagen.", 411);
  if (declaredLength > MAX_BODY_BYTES) return reject(MESSAGES.TOO_LARGE, 413);

  try {
    return await uploads.run(viewer.userId, () =>
      receiveAndStore(request, contentType!, viewer.userId),
    );
  } catch (error) {
    if (error instanceof KeyBusyError) {
      return reject("Espera a que terminen tus otras subidas.", 429, { "Retry-After": "10" });
    }
    if (error instanceof BusyError) {
      return reject("Hay muchas subidas en este momento. Intenta en unos segundos.", 503, {
        "Retry-After": "5",
      });
    }
    throw error;
  }
}

async function receiveAndStore(request: Request, contentType: string, ownerId: string) {
  const body = await readBodyWithLimit(request.body, MAX_BODY_BYTES, {
    timeoutMs: BODY_TIMEOUT_MS,
  });
  if (!body.ok) {
    return body.reason === "TOO_LARGE"
      ? reject(MESSAGES.TOO_LARGE, 413)
      : reject("La subida tardó demasiado. Intenta de nuevo.", 408);
  }

  // El cuerpo ya está acotado: el parser de multipart no puede leer más de MAX_BODY_BYTES, ni más
  // de MAX_FORM_PARTS partes.
  if (hasTooManyParts(body.data, contentType, MAX_FORM_PARTS)) {
    return json({ error: "Envía una sola imagen por subida." }, 400);
  }
  let file: FormDataEntryValue | null;
  try {
    file = (
      await new Response(body.data, { headers: { "Content-Type": contentType } }).formData()
    ).get("file");
  } catch {
    return json({ error: "No recibimos ninguna imagen." }, 400);
  }
  if (!(file instanceof File)) return json({ error: "No recibimos ninguna imagen." }, 400);

  const original = Buffer.from(await file.arrayBuffer());
  // Lo retirado no vuelve (ADR-076): la huella es del archivo tal como llegó (la salida re-codificada
  // cambia) y se revisa antes de decodificar, desde cualquier cuenta.
  const sha256 = await sha256Hex(original);
  if (await isBlockedHash(db, sha256)) {
    logBlockedUpload("image", sha256);
    return json({ error: BLOCKED_UPLOAD_MESSAGE }, 422);
  }

  let image;
  try {
    image = await processImage(original);
  } catch (error) {
    if (error instanceof ImageValidationError) return json({ error: MESSAGES[error.code] }, 422);
    throw error;
  }

  // La fila va antes que el archivo: todo archivo en disco tiene fila, así que el recolector de
  // huérfanas lo encuentra aunque el proceso muera a la mitad (queda en PROCESSING).
  const storageKey = newStorageKey();
  const media = await db.media.create({
    data: {
      ownerId,
      storageKey,
      mimeType: image.mimeType,
      width: image.width,
      height: image.height,
      sizeBytes: image.sizeBytes,
      blurDataUrl: image.blurDataUrl,
      sha256,
      status: "PROCESSING",
    },
    select: { id: true, width: true, height: true },
  });
  const storage = getStorage();
  try {
    await storage.put(storageKey, image.buffer);
  } catch (error) {
    await db.media.delete({ where: { id: media.id } }).catch(() => {});
    throw error;
  }
  await db.media.update({ where: { id: media.id }, data: { status: "READY" } });
  return json({ ...media, url: storage.publicUrl(storageKey) }, 201);
}
