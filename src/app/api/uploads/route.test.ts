import { createHash } from "node:crypto";
import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getViewer = vi.fn();
const rateLimitMany = vi.fn();
const mediaCreate = vi.fn();
const mediaUpdate = vi.fn();
const mediaDelete = vi.fn();
const blockedFindUnique = vi.fn();
const put = vi.fn();

vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/modules/identity/session", () => ({ getViewer }));
vi.mock("@/server/client-ip", () => ({ clientIp: () => "203.0.113.7" }));
vi.mock("@/server/rate-limit", () => ({
  rateLimitMany,
  rateLimitKey: (scope: string, subject: string, value: string | null) =>
    value ? `${scope}:${subject}:${value}` : null,
  limitOrError: () => "Demasiados intentos. Intenta de nuevo en 5 minutos.",
}));
vi.mock("@/server/db", () => ({
  db: {
    media: { create: mediaCreate, update: mediaUpdate, delete: mediaDelete },
    blockedMediaHash: { findUnique: blockedFindUnique },
  },
}));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ put, publicUrl: (key: string) => `/media/${key}` }),
}));

const { POST } = await import("./route");

const USER = "0199a000-0000-7000-8000-000000000001";
const ONBOARDED = { userId: USER, profile: { onboarded: true } };

function multipart(file: Buffer, { type = "image/png", name = "file" } = {}) {
  const form = new FormData();
  form.append(name, new Blob([new Uint8Array(file)], { type }), "foto.png");
  return new Response(form);
}

async function uploadRequest(file: Buffer, headers: Record<string, string> = {}) {
  const body = multipart(file);
  const bytes = Buffer.from(await body.arrayBuffer());
  return new Request("http://localhost/api/uploads", {
    method: "POST",
    headers: {
      "content-type": body.headers.get("content-type")!,
      "content-length": String(bytes.byteLength),
      ...headers,
    },
    body: bytes,
  });
}

/** Cuerpo sin fin que cuenta cuántas veces se leyó (para probar que ni se toca). */
function endlessRequest(headers: Record<string, string>) {
  let pulled = 0;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(1024 * 1024));
    },
  });
  const request = new Request("http://localhost/api/uploads", {
    method: "POST",
    headers,
    body,
    duplex: "half",
  } as RequestInit);
  return { request, pulled: () => pulled };
}

const tinyPng = () =>
  sharp({ create: { width: 8, height: 6, channels: 3, background: "#e4007c" } })
    .png()
    .toBuffer();

/** PNG de ~70 bytes cuya cabecera declara 6320×6320 RGBA de 16 bits (pixel-flood, SEC-13). */
function pixelFloodPng() {
  const crc32 = (bytes: Buffer) => {
    let crc = 0xffffffff;
    for (const byte of bytes) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
    }
    return (crc ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const length = Buffer.alloc(4);
    length.writeUInt32BE(data.length);
    const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(body));
    return Buffer.concat([length, body, crc]);
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(6320, 0);
  header.writeUInt32BE(6320, 4);
  header[8] = 16;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(Buffer.alloc(16))),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue(ONBOARDED);
  rateLimitMany.mockResolvedValue({ ok: true });
  mediaCreate.mockResolvedValue({ id: "m1", width: 8, height: 6 });
  mediaUpdate.mockResolvedValue({});
  mediaDelete.mockResolvedValue({});
  blockedFindUnique.mockResolvedValue(null);
  put.mockResolvedValue(undefined);
});

const sha256 = (bytes: Buffer) => createHash("sha256").update(bytes).digest("hex");

describe("POST /api/uploads", () => {
  it("sin sesión 401 y sin perfil terminado 403, sin contar ni leer nada", async () => {
    getViewer.mockResolvedValueOnce(null);
    expect((await POST(await uploadRequest(await tinyPng()))).status).toBe(401);
    getViewer.mockResolvedValueOnce({ userId: USER, profile: { onboarded: false } });
    expect((await POST(await uploadRequest(await tinyPng()))).status).toBe(403);
    expect(rateLimitMany).not.toHaveBeenCalled();
  });

  it("sube, re-codifica y deja la fila en PROCESSING hasta que el archivo existe (SEC-14)", async () => {
    const response = await POST(await uploadRequest(await tinyPng()));

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: "m1",
      url: expect.stringMatching(/^\/media\/images\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.webp$/),
    });
    expect(mediaCreate.mock.calls[0]![0].data).toMatchObject({
      ownerId: USER,
      status: "PROCESSING",
      mimeType: "image/webp",
    });
    expect(put).toHaveBeenCalledOnce();
    expect(mediaUpdate).toHaveBeenCalledWith({ where: { id: "m1" }, data: { status: "READY" } });
    expect(mediaCreate.mock.invocationCallOrder[0]).toBeLessThan(put.mock.invocationCallOrder[0]!);
  });

  it("guarda la huella SHA-256 del archivo tal como llegó, no de la foto re-codificada (ADR-076)", async () => {
    const png = await tinyPng();

    expect((await POST(await uploadRequest(png))).status).toBe(201);

    expect(blockedFindUnique).toHaveBeenCalledWith({
      where: { sha256: sha256(png) },
      select: { sha256: true },
    });
    expect(mediaCreate.mock.calls[0]![0].data.sha256).toBe(sha256(png));
    expect(sha256(put.mock.calls[0]![1])).not.toBe(sha256(png));
  });

  it("lo retirado no se vuelve a subir desde ninguna cuenta: 422, sin fila ni archivo, y queda en el log sin datos de la persona", async () => {
    const png = await tinyPng();
    blockedFindUnique.mockResolvedValueOnce({ sha256: sha256(png) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(await uploadRequest(png));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error:
        "No puedes subir este archivo: se retiró de speeaking por un aviso de derechos o por nuestras reglas.",
    });
    expect(mediaCreate).not.toHaveBeenCalled();
    expect(put).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledOnce();
    const logged = String(warn.mock.calls[0]![0]);
    expect(logged).toContain(sha256(png));
    expect(logged).not.toContain(USER);
    expect(logged).not.toContain("203.0.113.7");
    warn.mockRestore();
  });

  it("un archivo bloqueado ni se decodifica: se revisa su huella antes de procesarlo", async () => {
    const flood = pixelFloodPng();
    blockedFindUnique.mockResolvedValueOnce({ sha256: sha256(flood) });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const response = await POST(await uploadRequest(flood));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: expect.stringContaining("se retiró de speeaking"),
    });
    warn.mockRestore();
  });

  it("si el archivo no se guarda, borra la fila (no queda media sin archivo)", async () => {
    put.mockRejectedValueOnce(new Error("disco lleno"));

    await expect(POST(await uploadRequest(await tinyPng()))).rejects.toThrow("disco lleno");
    expect(mediaDelete).toHaveBeenCalledWith({ where: { id: "m1" } });
    expect(mediaUpdate).not.toHaveBeenCalled();
  });

  it("cuenta cada intento ANTES de leer el cuerpo, también los inválidos (SEC-12)", async () => {
    const { request, pulled } = endlessRequest({ "content-type": "text/plain" });

    const response = await POST(request);

    expect(response.status).toBe(415);
    expect(pulled()).toBeLessThanOrEqual(1);
    expect(rateLimitMany).toHaveBeenCalledOnce();
    const keys = rateLimitMany.mock.calls[0]![0].map((rule: { key: string }) => rule.key);
    expect(keys).toEqual([
      "upload:ip:203.0.113.7",
      `upload:user:${USER}`,
      `upload.day:user:${USER}`,
    ]);
  });

  it("con el límite agotado responde 429 con Retry-After, sin leer el cuerpo", async () => {
    rateLimitMany.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 300 });
    const { request, pulled } = endlessRequest({
      "content-type": "multipart/form-data; boundary=x",
      "content-length": "1000",
    });

    const response = await POST(request);

    expect(response.status).toBe(429);
    expect(response.headers.get("Retry-After")).toBe("300");
    expect(pulled()).toBeLessThanOrEqual(1);
    expect(mediaCreate).not.toHaveBeenCalled();
  });

  it("SEC-03: chunked (sin Content-Length) → 411 y un Content-Length mayor al tope → 413, sin leer", async () => {
    const chunked = endlessRequest({ "content-type": "multipart/form-data; boundary=x" });
    const huge = endlessRequest({
      "content-type": "multipart/form-data; boundary=x",
      "content-length": String(200 * 1024 * 1024),
    });

    const chunkedResponse = await POST(chunked.request);
    const hugeResponse = await POST(huge.request);

    expect(chunkedResponse.status).toBe(411);
    expect(hugeResponse.status).toBe(413);
    expect(hugeResponse.headers.get("Connection")).toBe("close");
    expect(chunked.pulled() + huge.pulled()).toBeLessThanOrEqual(2);
  });

  it("SEC-03: aunque el Content-Length mienta, deja de leer al pasar el tope (413)", async () => {
    const { request, pulled } = endlessRequest({
      "content-type": "multipart/form-data; boundary=x",
      "content-length": "1000",
    });

    const response = await POST(request);

    expect(response.status).toBe(413);
    expect(pulled()).toBeLessThanOrEqual(13);
    expect(mediaCreate).not.toHaveBeenCalled();
  });

  it("SEC-13: un pixel-flood se rechaza por la cabecera (422), sin crear fila", async () => {
    const started = performance.now();

    const response = await POST(await uploadRequest(pixelFloodPng()));

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toEqual({
      error: "La imagen tiene demasiados píxeles. Redúcela e intenta de nuevo.",
    });
    expect(performance.now() - started).toBeLessThan(2000);
    expect(mediaCreate).not.toHaveBeenCalled();
  });

  it("miles de partes diminutas se rechazan sin pasar por el parser de formData (hilo principal)", async () => {
    const boundary = "----speeaking";
    const parts = Array.from(
      { length: 20_000 },
      (_, index) =>
        `--${boundary}\r\nContent-Disposition: form-data; name="f${index}"\r\n\r\nv\r\n`,
    );
    const bytes = Buffer.from(`${parts.join("")}--${boundary}--\r\n`);
    const formData = vi.spyOn(Response.prototype, "formData");

    const response = await POST(
      new Request("http://localhost/api/uploads", {
        method: "POST",
        headers: {
          "content-type": `multipart/form-data; boundary=${boundary}`,
          "content-length": String(bytes.byteLength),
        },
        body: bytes,
      }),
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Envía una sola imagen por subida." });
    expect(formData).not.toHaveBeenCalled();
    formData.mockRestore();
  });

  it("un formulario sin el campo `file` es 400", async () => {
    const body = multipart(await tinyPng(), { name: "otra" });
    const bytes = Buffer.from(await body.arrayBuffer());
    const request = new Request("http://localhost/api/uploads", {
      method: "POST",
      headers: {
        "content-type": body.headers.get("content-type")!,
        "content-length": String(bytes.byteLength),
      },
      body: bytes,
    });

    expect((await POST(request)).status).toBe(400);
  });
});
