import { ImageBusyError, ImageValidationError } from "@/modules/media/image-processing";
import { parseContentLength, readBodyWithLimit } from "@/modules/media/limited-body";
import { editorialActor } from "@/modules/editorial/automation-auth";
import { editorialSubmission } from "@/modules/editorial/automation-schema";
import {
  editorialIllustrations,
  editorialPlan,
  EditorialSubmissionError,
  submitEditorial,
} from "@/modules/editorial/automation-service";
import { clientIp } from "@/server/client-ip";
import { db } from "@/server/db";
import { env } from "@/server/env";
import { rateLimit, rateLimitKey } from "@/server/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 120;
const MAX_BODY = 3 * 1024 * 1024;
const MAX_MANIFEST = 12_000;

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Robots-Tag": "noindex, nofollow",
      ...extra,
    },
  });
}

async function actor(request: Request) {
  const ip = clientIp(request.headers);
  const key = rateLimitKey("editorial-auth", "ip", ip);
  if (key) {
    const limited = await rateLimit({ key, limit: 120, windowSeconds: 3600 });
    if (!limited.ok)
      return json({ error: "RATE_LIMITED" }, 429, {
        "Retry-After": String(limited.retryAfterSeconds),
      });
  }
  const credential = await editorialActor(request);
  if (!credential) return json({ error: "UNAUTHORIZED" }, 401);
  return credential;
}

/** Estado y material editorial para preparar la tanda. No entrega datos de personas. */
export async function GET(request: Request) {
  try {
    const credential = await actor(request);
    if (credential instanceof Response) return credential;
    const [plan, illustrations] = await Promise.all([
      editorialPlan(credential.userId),
      editorialIllustrations(credential.userId),
    ]);
    return json({
      ...plan,
      illustrations,
      durableStorage: env.NODE_ENV !== "production" || env.STORAGE_DRIVER === "s3",
    });
  } catch {
    console.error("[editorial] no se pudo consultar la programación.");
    return json({ error: "EDITORIAL_UNAVAILABLE" }, 503);
  }
}

/** El token solo autoriza publicación editorial y reemplazo de sus ilustraciones. */
export async function POST(request: Request) {
  try {
    const credential = await actor(request);
    if (credential instanceof Response) return credential;
    const limited = await rateLimit({
      key: `editorial-submit:user:${credential.userId}`,
      limit: 30,
      windowSeconds: 3600,
    });
    if (!limited.ok)
      return json({ error: "RATE_LIMITED" }, 429, {
        "Retry-After": String(limited.retryAfterSeconds),
      });
    if (env.NODE_ENV === "production" && env.STORAGE_DRIVER !== "s3")
      return json({ error: "DURABLE_STORAGE_REQUIRED" }, 503);
    const contentType = request.headers.get("Content-Type") ?? "";
    if (!/^multipart\/form-data;\s*boundary=/i.test(contentType))
      return json({ error: "MULTIPART_REQUIRED" }, 415);
    const size = parseContentLength(request.headers.get("Content-Length"));
    if (size !== null && size > MAX_BODY)
      return json({ error: "BODY_TOO_LARGE" }, 413, { Connection: "close" });
    const read = await readBodyWithLimit(request.body, MAX_BODY, { timeoutMs: 20_000 });
    if (!read.ok)
      return json({ error: read.reason }, read.reason === "TOO_LARGE" ? 413 : 408, {
        Connection: "close",
      });
    // Antes del parser: a lo más tres partes. Así no se crean miles de campos con un cuerpo pequeño.
    const marker = /boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
    const boundary = marker?.[1] ?? marker?.[2];
    if (!boundary || boundary.length > 70) return json({ error: "INVALID_MULTIPART" }, 400);
    const separator = Buffer.from(`\r\n--${boundary}`);
    let index = -1;
    let delimiters = 0;
    while ((index = read.data.indexOf(separator, index + 1)) !== -1) {
      if (++delimiters > 3) return json({ error: "TOO_MANY_PARTS" }, 400);
    }
    let form: FormData;
    try {
      form = await new Response(read.data, { headers: { "Content-Type": contentType } }).formData();
    } catch {
      return json({ error: "INVALID_MULTIPART" }, 400);
    }
    const keys = [...form.keys()];
    if (
      keys.length > 3 ||
      new Set(keys).size !== keys.length ||
      keys.some((key) => !["manifest", "image0", "image1"].includes(key))
    )
      return json({ error: "INVALID_PARTS" }, 400);
    const raw = form.get("manifest");
    if (typeof raw !== "string" || raw.length > MAX_MANIFEST)
      return json({ error: "INVALID_MANIFEST" }, 400);
    let manifest: unknown;
    try {
      manifest = JSON.parse(raw);
    } catch {
      return json({ error: "INVALID_MANIFEST" }, 400);
    }
    const parsed = editorialSubmission.safeParse(manifest);
    if (!parsed.success) return json({ error: "INVALID_MANIFEST" }, 400);
    const files = new Map<string, File>();
    for (const entry of parsed.data.posts) {
      const file = form.get(entry.imagePart);
      if (
        !(file instanceof File) ||
        file.size < 12 ||
        file.size > 1024 * 1024 ||
        file.type !== "image/webp"
      )
        return json({ error: "INVALID_IMAGE" }, 422);
      files.set(entry.imagePart, file);
    }
    if (keys.length !== files.size + 1) return json({ error: "UNUSED_PARTS" }, 400);
    const result = await submitEditorial(credential.userId, parsed.data, files);
    await db.editorialAutomationToken.updateMany({
      where: { id: credential.credentialId, revokedAt: null },
      data: { lastUsedAt: new Date() },
    });
    return json(result);
  } catch (error) {
    if (error instanceof EditorialSubmissionError) return json({ error: error.code }, error.status);
    if (error instanceof ImageValidationError) return json({ error: "INVALID_IMAGE" }, 422);
    if (error instanceof ImageBusyError)
      return json({ error: "IMAGE_PROCESSING_BUSY" }, 503, { "Retry-After": "10" });
    console.error("[editorial] no se pudo publicar el contenido programado.");
    return json({ error: "EDITORIAL_UNAVAILABLE" }, 503);
  }
}
