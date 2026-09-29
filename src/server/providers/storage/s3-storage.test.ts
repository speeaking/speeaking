import { createHash } from "node:crypto";
import { Readable } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import {
  createS3Client,
  S3_MAX_ATTEMPTS,
  type S3Sender,
  type S3StorageConfig,
  S3StorageProvider,
} from "./s3-storage";
import { InvalidStorageKeyError } from "./types";

/**
 * Sin red: el cliente REAL del SDK con un manejador HTTP falso (así se prueban la firma, las cabeceras,
 * los errores XML de S3 y los reintentos), o un `send` falso para la lógica propia.
 */

const config: S3StorageConfig = {
  endpoint: "https://0123456789abcdef.r2.cloudflarestorage.com",
  bucket: "vendeia-media",
  region: "auto",
  accessKeyId: "a".repeat(32),
  secretAccessKey: "secreto-de-prueba-".repeat(4),
};

type FakeRequest = {
  method: string;
  hostname: string;
  path: string;
  headers: Record<string, string>;
  body?: unknown;
};
type FakeResponse = { status: number; headers?: Record<string, string>; body?: string | Buffer };

/** Manejador HTTP falso: registra cada petición y responde con `respond` (llamada n, desde 0). */
function fakeS3(respond: (request: FakeRequest, call: number) => FakeResponse) {
  const requests: FakeRequest[] = [];
  const handler = {
    handle(request: FakeRequest) {
      requests.push({ ...request, headers: { ...request.headers } });
      const { status, headers = {}, body = "" } = respond(request, requests.length - 1);
      const bytes = Buffer.from(body);
      return Promise.resolve({
        response: {
          statusCode: status,
          headers: { "content-length": String(bytes.length), ...headers },
          body: Readable.from([bytes]),
        },
      });
    },
    updateHttpClientConfig() {},
    httpHandlerConfigs() {
      return {};
    },
  };
  const storage = new S3StorageProvider(config, { client: createS3Client(config, handler) });
  return { storage, requests };
}

function s3Error(status: number, code: string): FakeResponse {
  return {
    status,
    headers: { "content-type": "application/xml" },
    body: `<?xml version="1.0" encoding="UTF-8"?><Error><Code>${code}</Code><Message>${code}</Message></Error>`,
  };
}

const header = (request: FakeRequest | undefined, name: string) =>
  Object.entries(request?.headers ?? {}).find(([key]) => key.toLowerCase() === name)?.[1];

describe("S3StorageProvider (R2) con el cliente del SDK", () => {
  it("sube al bucket con tipo, largo y Content-MD5, firmado y sin sumas CRC", async () => {
    const { storage, requests } = fakeS3(() => ({ status: 200, headers: { etag: '"x"' } }));
    const data = Buffer.from("datos de la foto");

    await storage.put("images/2026/09/foto.webp", data);

    expect(requests).toHaveLength(1);
    const [request] = requests;
    expect(request?.method).toBe("PUT");
    expect(`${request?.hostname}${request?.path}`).toContain("vendeia-media");
    expect(request?.path.endsWith("/images/2026/09/foto.webp")).toBe(true);
    expect(header(request, "content-type")).toBe("image/webp");
    expect(header(request, "content-length")).toBe(String(data.length));
    expect(header(request, "content-md5")).toBe(createHash("md5").update(data).digest("base64"));
    expect(header(request, "authorization")).toMatch(/^AWS4-HMAC-SHA256 Credential=a{32}\//);
    expect(Object.keys(request?.headers ?? {}).some((key) => /x-amz-checksum-/i.test(key))).toBe(
      false,
    );
    // Sin ACL pública: el bucket y sus objetos son privados.
    expect(header(request, "x-amz-acl")).toBeUndefined();
    expect(JSON.stringify(requests)).not.toContain(config.secretAccessKey);
    expect(Buffer.from(request?.body as Uint8Array).toString()).toBe("datos de la foto");
  });

  it("descarga el archivo con el tipo que dice la clave", async () => {
    const { storage, requests } = fakeS3(() => ({
      status: 200,
      // Aunque el objeto diga otra cosa, manda la extensión de la clave (como en disco).
      headers: { "content-type": "text/html" },
      body: Buffer.from("RIFF-bytes"),
    }));

    const file = await storage.get("images/a.webp");

    expect(requests[0]?.method).toBe("GET");
    expect(file?.data.toString()).toBe("RIFF-bytes");
    expect(file?.contentType).toBe("image/webp");
  });

  it("devuelve null solo con NoSuchKey", async () => {
    const { storage } = fakeS3(() => s3Error(404, "NoSuchKey"));
    expect(await storage.get("images/no-existe.webp")).toBeNull();
  });

  it("un bucket equivocado o sin permiso lanza (no se confunde con una foto borrada)", async () => {
    const noBucket = fakeS3(() => s3Error(404, "NoSuchBucket"));
    await expect(noBucket.storage.get("images/a.webp")).rejects.toMatchObject({
      name: "NoSuchBucket",
    });
    const denied = fakeS3(() => s3Error(403, "AccessDenied"));
    await expect(denied.storage.get("images/a.webp")).rejects.toMatchObject({
      name: "AccessDenied",
    });
    // Un 403 no se reintenta.
    expect(denied.requests).toHaveLength(1);
  });

  it("borra sin fallar si ya no existe", async () => {
    const { storage, requests } = fakeS3(() => ({ status: 204 }));
    await storage.delete("variants/w640/images/a-webp.webp");
    expect(requests[0]?.method).toBe("DELETE");
    expect(requests[0]?.path.endsWith("/variants/w640/images/a-webp.webp")).toBe(true);

    const missing = fakeS3(() => s3Error(404, "NoSuchKey"));
    await expect(missing.storage.delete("images/a.webp")).resolves.toBeUndefined();
  });

  it("reintenta fallas temporales (503 SlowDown, 500) y se rinde tras 3 intentos", async () => {
    const recovers = fakeS3((_, call) => (call < 2 ? s3Error(503, "SlowDown") : { status: 200 }));
    await recovers.storage.put("images/a.webp", Buffer.from("x"));
    expect(recovers.requests).toHaveLength(3);

    const fails = fakeS3(() => s3Error(500, "InternalError"));
    await expect(fails.storage.get("images/a.webp")).rejects.toMatchObject({
      name: "InternalError",
    });
    expect(fails.requests).toHaveLength(S3_MAX_ATTEMPTS);
  });
});

describe("S3StorageProvider (lógica propia)", () => {
  function withSend(send: S3Sender["send"], options = {}) {
    return new S3StorageProvider(config, { client: { send }, ...options });
  }

  it.each(["../secreto.webp", "images/../../x.webp", "/abs.webp", "images\\x.webp", "a.exe", ""])(
    "rechaza la clave %j sin llamar al servicio",
    async (key) => {
      const send = vi.fn();
      const s3 = withSend(send as unknown as S3Sender["send"]);
      await expect(s3.put(key, Buffer.from("x"))).rejects.toBeInstanceOf(InvalidStorageKeyError);
      await expect(s3.get(key)).rejects.toBeInstanceOf(InvalidStorageKeyError);
      await expect(s3.delete(key)).rejects.toBeInstanceOf(InvalidStorageKeyError);
      expect(() => s3.publicUrl(key)).toThrow(InvalidStorageKeyError);
      expect(send).not.toHaveBeenCalled();
    },
  );

  it("la URL pública es siempre /media (el bucket es privado)", () => {
    const s3 = withSend(vi.fn() as unknown as S3Sender["send"]);
    expect(s3.publicUrl("images/a.webp")).toBe("/media/images/a.webp");
  });

  it("aborta la operación al pasar el tope de tiempo", async () => {
    const send = vi.fn(
      (_command: unknown, options?: { abortSignal?: AbortSignal }) =>
        new Promise((_, reject) => {
          options?.abortSignal?.addEventListener("abort", () => {
            reject(options.abortSignal?.reason as Error);
          });
        }),
    );
    const s3 = withSend(send as unknown as S3Sender["send"], { operationTimeoutMs: 20 });
    await expect(s3.get("images/a.webp")).rejects.toMatchObject({ name: "TimeoutError" });
  });

  it("no carga en memoria un objeto más grande que el tope", async () => {
    const destroy = vi.fn();
    const transformToByteArray = vi.fn();
    const send = vi.fn(() =>
      Promise.resolve({ ContentLength: 2_000, Body: { destroy, transformToByteArray } }),
    );
    const s3 = withSend(send as unknown as S3Sender["send"], { maxObjectBytes: 1_000 });
    await expect(s3.get("images/a.webp")).rejects.toThrow(/excede 1000 bytes/);
    expect(destroy).toHaveBeenCalled();
    expect(transformToByteArray).not.toHaveBeenCalled();
  });

  it("corta la lectura al pasar el tope aunque la respuesta no declare su largo", async () => {
    let produced = 0;
    const body = Readable.from(
      (function* () {
        for (let i = 0; i < 1_000; i += 1) {
          produced += 1;
          yield Buffer.alloc(600);
        }
      })(),
    );
    const send = vi.fn(() => Promise.resolve({ Body: body }));
    const s3 = withSend(send as unknown as S3Sender["send"], { maxObjectBytes: 1_000 });

    await expect(s3.get("images/a.webp")).rejects.toThrow(/excede 1000 bytes/);
    // Se detuvo al pasar el tope: no leyó (ni guardó en memoria) el resto del objeto.
    expect(produced).toBeLessThan(100);
    expect(body.destroyed).toBe(true);
  });
});
