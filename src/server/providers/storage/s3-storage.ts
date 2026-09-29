import { createHash } from "node:crypto";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  type GetObjectCommandOutput,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from "@aws-sdk/client-s3";
import { assertSafeKey, mediaUrl, type StorageProvider } from "./types";

/**
 * Almacenamiento en un bucket compatible con S3 (ADR-040): Cloudflare R2 en producción, o S3 u otro
 * compatible. El bucket es PRIVADO: el navegador nunca recibe una URL del bucket; `/media` autoriza
 * cada petición y lee el archivo desde aquí (SEC-14, ADR-039). Las variantes de entrega
 * (`variants/w<ancho>/…`) viven en el mismo bucket.
 *
 * Sin `server-only` (como `local-storage.ts`): los scripts de la terminal también pueden usarlo.
 */

export type S3StorageConfig = {
  /** Solo el origen: `https://<cuenta>.r2.cloudflarestorage.com` en R2. */
  endpoint: string;
  bucket: string;
  /** R2 pide `auto`. */
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
};

/** Tiempos de cada operación. */
export const S3_TIMEOUTS = {
  /** Abrir la conexión (TCP + TLS). */
  connectionMs: 3_000,
  /** Tope de cada intento (petición y respuesta): al pasarlo lanza `TimeoutError` y se reintenta. */
  requestMs: 10_000,
  /** Socket sin recibir datos (también mientras se lee el cuerpo de una descarga). */
  socketIdleMs: 10_000,
  /** Tope de toda la operación, reintentos incluidos: después se aborta y lanza. */
  operationMs: 20_000,
} as const;

/**
 * Intentos por operación: 1 + 2 reintentos con espera exponencial (modo `standard` del SDK: 5xx,
 * `SlowDown`/429, cortes de red y tiempos agotados). Reintentar es seguro: subir la misma clave con
 * los mismos bytes, leer y borrar son idempotentes.
 */
export const S3_MAX_ATTEMPTS = 3;

/**
 * Tope de lo que `get` carga en memoria. Lo que guardamos son fotos re-codificadas de ≤ 1600 px
 * (cientos de KB); algo mayor no lo escribió esta app y no se carga.
 */
export const S3_MAX_OBJECT_BYTES = 32 * 1024 * 1024;

/** Lo único que se usa del cliente (las pruebas lo sustituyen). */
export type S3Sender = Pick<S3Client, "send">;

export type S3StorageOptions = {
  client?: S3Sender;
  operationTimeoutMs?: number;
  maxObjectBytes?: number;
};

/**
 * Cliente del SDK oficial (AWS SDK v3) con tiempos, reintentos y sumas de verificación compatibles con
 * R2. `requestHandler` solo se pasa en pruebas (un manejador falso, sin red).
 */
export function createS3Client(
  config: S3StorageConfig,
  requestHandler?: S3ClientConfig["requestHandler"],
) {
  return new S3Client({
    endpoint: config.endpoint,
    region: config.region,
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    maxAttempts: S3_MAX_ATTEMPTS,
    retryMode: "standard",
    // Desde la versión 3.729 el SDK agrega por omisión sumas CRC32 que no todos los servicios
    // compatibles con S3 aceptan; se mandan solo cuando la operación las exige. La integridad de la
    // subida la da `Content-MD5` (ver `put`), que S3 y R2 verifican.
    requestChecksumCalculation: "WHEN_REQUIRED",
    responseChecksumValidation: "WHEN_REQUIRED",
    requestHandler: requestHandler ?? {
      connectionTimeout: S3_TIMEOUTS.connectionMs,
      requestTimeout: S3_TIMEOUTS.requestMs,
      // Sin esto, pasar `requestTimeout` solo deja un aviso en el log y el intento sigue esperando.
      throwOnRequestTimeout: true,
      socketTimeout: S3_TIMEOUTS.socketIdleMs,
    },
  });
}

export class S3StorageProvider implements StorageProvider {
  private readonly bucket: string;
  private readonly client: S3Sender;
  private readonly operationTimeoutMs: number;
  private readonly maxObjectBytes: number;

  constructor(config: S3StorageConfig, options: S3StorageOptions = {}) {
    this.bucket = config.bucket;
    this.client = options.client ?? createS3Client(config);
    this.operationTimeoutMs = options.operationTimeoutMs ?? S3_TIMEOUTS.operationMs;
    this.maxObjectBytes = options.maxObjectBytes ?? S3_MAX_OBJECT_BYTES;
  }

  private deadline() {
    return { abortSignal: AbortSignal.timeout(this.operationTimeoutMs) };
  }

  async put(key: string, data: Buffer) {
    const contentType = assertSafeKey(key);
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: data,
        ContentType: contentType,
        ContentLength: data.length,
        // El servicio rechaza la subida si los bytes que recibe no son estos.
        ContentMD5: createHash("md5").update(data).digest("base64"),
      }),
      this.deadline(),
    );
  }

  async get(key: string) {
    // El tipo sale de la clave (como en disco), no de lo que diga el objeto guardado.
    const contentType = assertSafeKey(key);
    let output: GetObjectCommandOutput;
    try {
      output = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
        this.deadline(),
      );
    } catch (error) {
      if (isNoSuchKey(error)) return null;
      throw error;
    }

    const body = output.Body;
    if (!body) throw new Error("El almacenamiento respondió sin contenido.");
    const tooLarge = () =>
      new Error(`El archivo ${key} excede ${this.maxObjectBytes} bytes; no se carga.`);
    if (output.ContentLength !== undefined && output.ContentLength > this.maxObjectBytes) {
      // Se descarta el cuerpo sin leerlo (libera la conexión).
      destroyBody(body);
      throw tooLarge();
    }
    // En Node el cuerpo es un stream: se cuenta mientras se lee y se corta al pasar el tope, aunque
    // la respuesta no declare su largo (así el tope protege la memoria, no solo se revisa al final).
    if (isAsyncIterable(body)) {
      const chunks: Uint8Array[] = [];
      let total = 0;
      for await (const chunk of body) {
        const bytes = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
        total += bytes.byteLength;
        if (total > this.maxObjectBytes) {
          destroyBody(body);
          throw tooLarge();
        }
        chunks.push(bytes);
      }
      return { data: Buffer.concat(chunks, total), contentType };
    }
    const bytes = await body.transformToByteArray();
    if (bytes.byteLength > this.maxObjectBytes) throw tooLarge();
    return { data: Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength), contentType };
  }

  async delete(key: string) {
    assertSafeKey(key);
    try {
      await this.client.send(
        new DeleteObjectCommand({ Bucket: this.bucket, Key: key }),
        this.deadline(),
      );
    } catch (error) {
      // S3 y R2 responden 204 aunque no exista; algún compatible responde 404.
      if (isNoSuchKey(error)) return;
      throw error;
    }
  }

  publicUrl(key: string) {
    return mediaUrl(key);
  }
}

/**
 * Solo `NoSuchKey` significa «no existe». Un bucket equivocado (`NoSuchBucket`, también 404) o un
 * permiso faltante (403) lanzan: un error de configuración nunca se confunde con una foto borrada.
 */
function isNoSuchKey(error: unknown) {
  return error instanceof Error && error.name === "NoSuchKey";
}

function isAsyncIterable(value: unknown): value is AsyncIterable<Uint8Array | string> {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as { [Symbol.asyncIterator]?: unknown })[Symbol.asyncIterator] === "function"
  );
}

/** Cierra el stream de la respuesta sin leerlo (libera el socket). */
function destroyBody(body: unknown) {
  (body as { destroy?: () => void }).destroy?.();
}
