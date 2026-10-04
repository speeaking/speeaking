import { createReadStream } from "node:fs";
import { mkdir, open, rm, stat } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  type S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createS3Client, S3_TIMEOUTS, type S3StorageConfig } from "./s3-storage";
import { assertSafeKey, InvalidStorageKeyError } from "./types";

/**
 * Videos cortos (ADR-062). Un video pesa hasta 50 MB y Vercel corta toda petición o respuesta de
 * más de 4.5 MB: el archivo NUNCA pasa por la app. Con el bucket (R2), el navegador lo sube con una
 * URL firmada (PUT, con su tamaño y tipo firmados) y `/media` lo entrega redirigiendo a otra URL
 * firmada de lectura, después de autorizar como siempre. En desarrollo (disco), una ruta local
 * recibe el archivo y `/media` lo sirve por rangos (Safari no reproduce sin `Range`).
 *
 * La app solo lee la estructura del video por rangos (`reader`): unos cuantos KB, nunca el archivo.
 */

/** Lee `length` bytes desde `start` (menos si el archivo termina antes). */
export type VideoRangeReader = (start: number, length: number) => Promise<Uint8Array>;

export type VideoUploadTarget = {
  /** A dónde manda el navegador el archivo con `PUT`. */
  url: string;
  /** Cabeceras que debe mandar tal cual (van firmadas). */
  headers: Record<string, string>;
};

export type VideoUploadInput = { key: string; mediaId: string; sizeBytes: number };

export interface VideoStore {
  uploadTarget(input: VideoUploadInput): Promise<VideoUploadTarget>;
  /** Tamaño guardado; `null` si el archivo no llegó. */
  size(key: string): Promise<number | null>;
  reader(key: string): VideoRangeReader;
  /** Respuesta de `/media` para un video YA autorizado (`headers`: caché y seguridad). */
  deliver(key: string, request: Request, headers: Record<string, string>): Promise<Response>;
}

/** Siempre `video/mp4`: un MOV de iPhone es el mismo formato y así lo reproducen todos. */
export const VIDEO_CONTENT_TYPE = "video/mp4";

/** Rango de bytes de una petición (`Range: bytes=…`), uno solo; `null` = el archivo completo. */
export function parseByteRange(
  header: string | null,
  size: number,
): { start: number; end: number } | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, from = "", to = ""] = match;
  if (from === "" && to === "") return null;
  let start: number;
  let end: number;
  if (from === "") {
    // Los últimos N bytes.
    const suffix = Number(to);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(from);
    end = to === "" ? size - 1 : Math.min(Number(to), size - 1);
  }
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) return "unsatisfiable";
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}

/** Disco local (desarrollo y pruebas). */
export class LocalVideoStore implements VideoStore {
  private readonly root: string;

  constructor(root: string) {
    this.root = resolve(root);
  }

  private pathFor(key: string) {
    assertSafeKey(key);
    const path = resolve(join(this.root, key));
    if (!path.startsWith(this.root + sep)) throw new InvalidStorageKeyError();
    return path;
  }

  async uploadTarget({ mediaId }: VideoUploadInput) {
    return {
      url: `/api/uploads/video/${mediaId}`,
      headers: { "Content-Type": VIDEO_CONTENT_TYPE },
    };
  }

  async size(key: string) {
    try {
      return (await stat(this.pathFor(key))).size;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
      throw error;
    }
  }

  reader(key: string): VideoRangeReader {
    const path = this.pathFor(key);
    return async (start, length) => {
      const handle = await open(path, "r");
      try {
        const buffer = Buffer.alloc(length);
        const { bytesRead } = await handle.read(buffer, 0, length, start);
        return buffer.subarray(0, bytesRead);
      } finally {
        await handle.close();
      }
    };
  }

  /**
   * Recibe el archivo que manda el navegador (solo en disco): exactamente `sizeBytes`, contando
   * mientras llega; si pasa del tamaño o queda corto, se borra.
   */
  async receive(
    key: string,
    body: AsyncIterable<Uint8Array>,
    sizeBytes: number,
  ): Promise<"ok" | "too_large" | "incomplete"> {
    const path = this.pathFor(key);
    await mkdir(dirname(path), { recursive: true });
    const handle = await open(path, "w");
    let total = 0;
    let result: "ok" | "too_large" | "incomplete" = "ok";
    try {
      for await (const chunk of body) {
        total += chunk.byteLength;
        if (total > sizeBytes) {
          result = "too_large";
          break;
        }
        await handle.write(chunk);
      }
      if (result === "ok" && total !== sizeBytes) result = "incomplete";
    } finally {
      await handle.close();
    }
    if (result !== "ok") await rm(path, { force: true });
    return result;
  }

  async deliver(key: string, request: Request, headers: Record<string, string>) {
    const size = await this.size(key);
    if (size === null) {
      return new Response("No encontrado", {
        status: 404,
        headers: { "Cache-Control": "no-store" },
      });
    }
    const range = parseByteRange(request.headers.get("range"), size);
    if (range === "unsatisfiable") {
      return new Response(null, {
        status: 416,
        headers: { ...headers, "Content-Range": `bytes */${size}` },
      });
    }
    const { start, end } = range ?? { start: 0, end: size - 1 };
    const stream = Readable.toWeb(createReadStream(this.pathFor(key), { start, end }));
    return new Response(stream as ReadableStream<Uint8Array>, {
      status: range ? 206 : 200,
      headers: {
        ...headers,
        "Content-Type": VIDEO_CONTENT_TYPE,
        "Accept-Ranges": "bytes",
        "Content-Length": String(end - start + 1),
        ...(range ? { "Content-Range": `bytes ${start}-${end}/${size}` } : {}),
      },
    });
  }
}

/** Vigencia de la URL de subida: de sobra para 50 MB en una red lenta. */
export const VIDEO_UPLOAD_URL_SECONDS = 15 * 60;
/** Vigencia de la URL de lectura. */
export const VIDEO_DOWNLOAD_URL_SECONDS = 60 * 60;
/** Contenido personal: firma nueva en cada petición, sin caché y con vigencia corta. */
export const PRIVATE_VIDEO_DOWNLOAD_URL_SECONDS = 2 * 60;
/**
 * La firma de lectura se fecha al inicio de su bloque de 10 minutos: dentro del bloque la URL es la
 * misma y el navegador reusa lo que ya descargó; sigue valiendo al menos 50 minutos.
 */
const SIGNING_BUCKET_MS = 10 * 60 * 1000;

/**
 * Bucket compatible con S3 (R2). URLs con la ruta (`<endpoint>/<bucket>/<clave>`): así su origen es
 * el de `S3_ENDPOINT`, el único que la CSP permite para subir y reproducir videos.
 */
export class S3VideoStore implements VideoStore {
  private readonly bucket: string;
  private readonly client: S3Client;
  private readonly now: () => Date;

  constructor(config: S3StorageConfig, options: { client?: S3Client; now?: () => Date } = {}) {
    this.bucket = config.bucket;
    this.client = options.client ?? createS3Client(config, undefined, { forcePathStyle: true });
    this.now = options.now ?? (() => new Date());
  }

  async uploadTarget({ key, sizeBytes }: VideoUploadInput) {
    assertSafeKey(key);
    const url = await getSignedUrl(
      this.client,
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ContentType: VIDEO_CONTENT_TYPE,
        ContentLength: sizeBytes,
      }),
      {
        expiresIn: VIDEO_UPLOAD_URL_SECONDS,
        // Firmados: el bucket rechaza otro tamaño (nadie sube 2 GB con una URL de 5 MB) u otro tipo.
        signableHeaders: new Set(["content-type", "content-length"]),
      },
    );
    return { url, headers: { "Content-Type": VIDEO_CONTENT_TYPE } };
  }

  async size(key: string) {
    assertSafeKey(key);
    try {
      const output = await this.client.send(
        new HeadObjectCommand({ Bucket: this.bucket, Key: key }),
        { abortSignal: AbortSignal.timeout(S3_TIMEOUTS.operationMs) },
      );
      return output.ContentLength ?? null;
    } catch (error) {
      if (isNotFound(error)) return null;
      throw error;
    }
  }

  reader(key: string): VideoRangeReader {
    assertSafeKey(key);
    return async (start, length) => {
      const output = await this.client.send(
        new GetObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Range: `bytes=${start}-${start + length - 1}`,
        }),
        { abortSignal: AbortSignal.timeout(S3_TIMEOUTS.operationMs) },
      );
      if (!output.Body) throw new Error("El almacenamiento respondió sin contenido.");
      const bytes = await output.Body.transformToByteArray();
      // Un servicio que ignore el rango mandaría el archivo completo: solo se usa lo pedido.
      return bytes.byteLength > length ? bytes.subarray(0, length) : bytes;
    };
  }

  async deliver(key: string, _request: Request, headers: Record<string, string>) {
    assertSafeKey(key);
    const privateVideo = headers["Cache-Control"]?.includes("no-store") ?? false;
    const now = this.now();
    const signingDate = privateVideo
      ? now
      : new Date(Math.floor(now.getTime() / SIGNING_BUCKET_MS) * SIGNING_BUCKET_MS);
    const url = await getSignedUrl(
      this.client,
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
        ResponseContentType: VIDEO_CONTENT_TYPE,
      }),
      {
        expiresIn: privateVideo ? PRIVATE_VIDEO_DOWNLOAD_URL_SECONDS : VIDEO_DOWNLOAD_URL_SECONDS,
        signingDate,
      },
    );
    return new Response(null, { status: 302, headers: { ...headers, Location: url } });
  }
}

function isNotFound(error: unknown) {
  if (!(error instanceof Error)) return false;
  const status = (error as { $metadata?: { httpStatusCode?: number } }).$metadata?.httpStatusCode;
  return error.name === "NotFound" || error.name === "NoSuchKey" || status === 404;
}
