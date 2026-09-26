import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { LocalStorageProvider } from "@/server/providers/storage/local-storage";
import {
  entityTag,
  isCompleteWebp,
  matchesEntityTag,
  parseDeliveryQuery,
  readVariant,
} from "./delivery";
import { variantKey } from "./variant-keys";

const KEY = "images/2026/09/0199a000-0000-7000-8000-00000000000a.webp";

let photo: Buffer;

beforeAll(async () => {
  photo = await sharp({ create: { width: 1000, height: 1250, channels: 3, background: "#0a7" } })
    .webp()
    .toBuffer();
});

describe("parseDeliveryQuery (ADR-039, SEC-35)", () => {
  const parse = (search: string) => parseDeliveryQuery(new URLSearchParams(search));

  it("sin query: el original", () => {
    expect(parse("")).toEqual({ ok: true, width: null });
  });

  it.each([256, 384, 640, 828, 1080, 1600])("?w=%i: un ancho permitido", (width) => {
    expect(parse(`w=${width}`)).toEqual({ ok: true, width });
  });

  it.each(["w=641", "w=2048", "w=0", "w=-640", "w=0640", "w=640.0", "w=6e2", "w= 640", "w=", "w"])(
    "ancho inválido %s",
    (search) => {
      expect(parse(search)).toEqual({ ok: false });
    },
  );

  it.each(["w=640&q=75", "w=640&w=640", "q=75", "v=1", "url=%2Fmedia%2Fa.webp", "W=640", "=640"])(
    "otros parámetros o repetidos: %s",
    (search) => {
      expect(parse(search)).toEqual({ ok: false });
    },
  );
});

describe("validadores HTTP", () => {
  it("ETag fuerte por contenido", () => {
    const tag = entityTag(Buffer.from("a"));
    expect(tag).toMatch(/^"[A-Za-z0-9_-]{32}"$/);
    expect(entityTag(Buffer.from("a"))).toBe(tag);
    expect(entityTag(Buffer.from("b"))).not.toBe(tag);
  });

  it("If-None-Match con comparación débil, lista o *", () => {
    const tag = entityTag(Buffer.from("a"));
    expect(matchesEntityTag(tag, tag)).toBe(true);
    expect(matchesEntityTag(`W/${tag}`, tag)).toBe(true);
    expect(matchesEntityTag(`"x", ${tag}`, tag)).toBe(true);
    expect(matchesEntityTag("*", tag)).toBe(true);
    expect(matchesEntityTag('"x"', tag)).toBe(false);
    expect(matchesEntityTag(null, tag)).toBe(false);
    expect(matchesEntityTag("", tag)).toBe(false);
  });

  it("isCompleteWebp distingue un WebP completo de uno truncado u otro formato", async () => {
    expect(isCompleteWebp(photo)).toBe(true);
    expect(isCompleteWebp(photo.subarray(0, photo.length - 1))).toBe(false);
    expect(isCompleteWebp(Buffer.from("RIFF"))).toBe(false);
    expect(isCompleteWebp(await sharp(photo).png().toBuffer())).toBe(false);
  });
});

describe("readVariant con el almacenamiento local", () => {
  let root: string;
  let storage: LocalStorageProvider;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), "vendeia-delivery-"));
    storage = new LocalStorageProvider(root);
    await storage.put(KEY, photo);
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("genera la variante, la guarda en disco junto al original y después la reutiliza", async () => {
    const first = await readVariant(storage, KEY, 640);

    expect(first?.cacheable).toBe(true);
    expect(first?.contentType).toBe("image/webp");
    const meta = await sharp(first!.data).metadata();
    expect([meta.width, meta.height]).toEqual([640, 800]);
    const stored = await storage.get(variantKey(KEY, 640));
    expect(stored?.data.equals(first!.data)).toBe(true);

    // Lo que esté en la caché (completo) es lo que se entrega: no se vuelve a generar.
    const marker = await sharp({
      create: { width: 640, height: 10, channels: 3, background: "#000" },
    })
      .webp()
      .toBuffer();
    await storage.put(variantKey(KEY, 640), marker);
    expect((await readVariant(storage, KEY, 640))?.data.equals(marker)).toBe(true);
  });

  it("sin original: null (y no deja variante)", async () => {
    await storage.delete(KEY);

    expect(await readVariant(storage, KEY, 256)).toBeNull();
    expect(await storage.get(variantKey(KEY, 256))).toBeNull();
  });

  it("original ilegible: entrega el original sin caché y no guarda variante", async () => {
    const broken = Buffer.concat([photo.subarray(0, 12), Buffer.alloc(64)]);
    await storage.put(KEY, broken);

    const result = await readVariant(storage, KEY, 256);

    expect(result).toEqual({ data: broken, contentType: "image/webp", cacheable: false });
    expect(await storage.get(variantKey(KEY, 256))).toBeNull();
  });

  it("si guardar la variante falla, la entrega igual", async () => {
    const readOnly = {
      get: (key: string) => storage.get(key),
      put: async () => {
        throw new Error("disco lleno");
      },
    };
    const errors: unknown[] = [];
    const original = console.error;
    console.error = (...args: unknown[]) => void errors.push(args);
    try {
      const result = await readVariant(readOnly, KEY, 384);
      expect(result?.cacheable).toBe(true);
      expect((await sharp(result!.data).metadata()).width).toBe(384);
      expect(errors).toHaveLength(1);
    } finally {
      console.error = original;
    }
  });
});
