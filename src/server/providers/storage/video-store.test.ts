import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createS3Client } from "./s3-storage";
import { LocalVideoStore, parseByteRange, S3VideoStore } from "./video-store";

const KEY = "videos/2026/10/0199a000-0000-7000-8000-000000000001.mp4";

async function* chunks(...parts: string[]) {
  for (const part of parts) yield new TextEncoder().encode(part);
}

describe("parseByteRange", () => {
  it("entiende los rangos que piden los navegadores al reproducir", () => {
    expect(parseByteRange(null, 100)).toBeNull();
    expect(parseByteRange("bytes=0-", 100)).toEqual({ start: 0, end: 99 });
    expect(parseByteRange("bytes=10-19", 100)).toEqual({ start: 10, end: 19 });
    expect(parseByteRange("bytes=90-500", 100)).toEqual({ start: 90, end: 99 });
    expect(parseByteRange("bytes=-10", 100)).toEqual({ start: 90, end: 99 });
  });

  it("lo imposible es 416 y lo que no entiende se ignora (archivo completo)", () => {
    expect(parseByteRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=20-10", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=-0", 100)).toBe("unsatisfiable");
    expect(parseByteRange("bytes=0-1,5-9", 100)).toBeNull();
    expect(parseByteRange("elementos=0-1", 100)).toBeNull();
  });
});

describe("LocalVideoStore (desarrollo)", () => {
  let root: string;
  let store: LocalVideoStore;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "videos-"));
    store = new LocalVideoStore(root);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("recibe exactamente el tamaño declarado; de más o de menos, no queda nada", async () => {
    await expect(store.receive(KEY, chunks("hola ", "mundo"), 10)).resolves.toBe("ok");
    expect(await readFile(join(root, KEY), "utf8")).toBe("hola mundo");
    await expect(store.size(KEY)).resolves.toBe(10);

    await expect(store.receive(KEY, chunks("hola ", "mundo!"), 10)).resolves.toBe("too_large");
    await expect(stat(join(root, KEY))).rejects.toThrow();
    await expect(store.receive(KEY, chunks("hola"), 10)).resolves.toBe("incomplete");
    await expect(store.size(KEY)).resolves.toBeNull();
  });

  it("sirve por rangos (Safari no reproduce sin ellos) con las cabeceras de `/media`", async () => {
    await store.receive(KEY, chunks("0123456789"), 10);
    const headers = { "Cache-Control": "private, max-age=600" };

    const whole = await store.deliver(KEY, new Request("http://x/media"), headers);
    expect(whole.status).toBe(200);
    expect(whole.headers.get("accept-ranges")).toBe("bytes");
    expect(whole.headers.get("content-type")).toBe("video/mp4");
    expect(whole.headers.get("cache-control")).toBe("private, max-age=600");
    expect(await whole.text()).toBe("0123456789");

    const part = await store.deliver(
      KEY,
      new Request("http://x/media", { headers: { Range: "bytes=2-5" } }),
      headers,
    );
    expect(part.status).toBe(206);
    expect(part.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(part.headers.get("content-length")).toBe("4");
    expect(await part.text()).toBe("2345");

    const outside = await store.deliver(
      KEY,
      new Request("http://x/media", { headers: { Range: "bytes=50-" } }),
      headers,
    );
    expect(outside.status).toBe(416);
    expect(outside.headers.get("content-range")).toBe("bytes */10");
  });

  it("lee la estructura por rangos y sube por la ruta local de desarrollo", async () => {
    await store.receive(KEY, chunks("0123456789"), 10);
    const read = store.reader(KEY);
    expect(new TextDecoder().decode(await read(3, 4))).toBe("3456");
    expect((await read(8, 10)).byteLength).toBe(2);
    await expect(store.uploadTarget({ key: KEY, mediaId: "m-1", sizeBytes: 10 })).resolves.toEqual({
      url: "/api/uploads/video/m-1",
      headers: { "Content-Type": "video/mp4" },
    });
  });

  it("una clave fuera de lo permitido no toca el disco", async () => {
    await expect(store.size("../../etc/passwd")).rejects.toThrow(
      "Clave de almacenamiento inválida",
    );
  });
});

describe("S3VideoStore (R2)", () => {
  const config = {
    endpoint: "https://cuenta.r2.cloudflarestorage.com",
    bucket: "speeaking-media",
    region: "auto",
    accessKeyId: "llave-de-prueba",
    secretAccessKey: "secreto-de-prueba",
  };
  // Firmar no usa la red: el cliente real calcula la firma en el proceso.
  const client = createS3Client(config, undefined, { forcePathStyle: true });

  it("la subida va directo al bucket con tamaño y tipo FIRMADOS (otro tamaño se rechaza)", async () => {
    const store = new S3VideoStore(config, { client });
    const target = await store.uploadTarget({ key: KEY, mediaId: "m-1", sizeBytes: 1234 });
    const url = new URL(target.url);

    // Con la ruta: el origen es el de `S3_ENDPOINT`, el único que permite la CSP.
    expect(url.origin).toBe("https://cuenta.r2.cloudflarestorage.com");
    expect(url.pathname).toBe(`/speeaking-media/${KEY}`);
    expect(url.searchParams.get("X-Amz-SignedHeaders")?.split(";")).toEqual(
      expect.arrayContaining(["content-length", "content-type", "host"]),
    );
    expect(Number(url.searchParams.get("X-Amz-Expires"))).toBe(15 * 60);
    expect(target.headers).toEqual({ "Content-Type": "video/mp4" });
    // La llave secreta nunca viaja; solo su id en la credencial.
    expect(target.url).not.toContain("secreto-de-prueba");
  });

  it("entrega con una redirección a una URL firmada, igual dentro de un bloque de 10 minutos", async () => {
    let now = new Date("2026-10-01T15:02:00Z");
    const store = new S3VideoStore(config, { client, now: () => now });
    const headers = { "Cache-Control": "private, max-age=600" };

    const first = await store.deliver(KEY, new Request("http://x/media"), headers);
    expect(first.status).toBe(302);
    expect(first.headers.get("cache-control")).toBe("private, max-age=600");
    const location = new URL(first.headers.get("location")!);
    expect(location.origin).toBe("https://cuenta.r2.cloudflarestorage.com");
    expect(location.searchParams.get("response-content-type")).toBe("video/mp4");
    expect(location.searchParams.get("X-Amz-Date")).toBe("20261001T150000Z");

    now = new Date("2026-10-01T15:09:59Z");
    const same = await store.deliver(KEY, new Request("http://x/media"), headers);
    expect(same.headers.get("location")).toBe(first.headers.get("location"));

    now = new Date("2026-10-01T15:10:00Z");
    const next = await store.deliver(KEY, new Request("http://x/media"), headers);
    expect(next.headers.get("location")).not.toBe(first.headers.get("location"));
  });
});
