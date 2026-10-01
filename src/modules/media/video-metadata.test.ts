import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { children, inspectVideo, VideoValidationError } from "./video-container";
import { assertNoMetadata, blobReader, metadataRanges, withoutMetadata } from "./video-metadata";

const LIMITS = { maxDurationMs: 60_500, maxDimension: 4096 };
const FIXTURES = ["video-corto.mp4", "moov-al-final.mp4", "hevc.mp4", "girado.mov"] as const;

/** Videos reales de 2 s hechos con ffmpeg (`tests/fixtures/video`): traen `udta` del programa. */
function fixture(name: string) {
  return new Uint8Array(readFileSync(`tests/fixtures/video/${name}`));
}

function readerOf(bytes: Uint8Array) {
  return async (start: number, length: number) => bytes.slice(start, start + length);
}

async function bytesOf(blob: Blob) {
  return new Uint8Array(await blob.arrayBuffer());
}

function concat(...parts: Uint8Array[]) {
  const out = new Uint8Array(parts.reduce((total, part) => total + part.byteLength, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.byteLength;
  }
  return out;
}

const text = (value: string) => new TextEncoder().encode(value);
/** El tipo de una caja: 4 bytes en latin1 («©xyz» es 0xA9 + «xyz»). */
const fourcc = (type: string) => Uint8Array.from(type, (char) => char.charCodeAt(0));

/** Una caja con encabezado de 32 bits (o de 64, `size = 1`, si `large`). */
function box(type: string, payload: Uint8Array, large = false) {
  const header = new Uint8Array(large ? 16 : 8);
  const data = new DataView(header.buffer);
  if (large) {
    data.setUint32(0, 1);
    data.setBigUint64(8, BigInt(16 + payload.byteLength));
  } else {
    data.setUint32(0, 8 + payload.byteLength);
  }
  header.set(fourcc(type), 4);
  return concat(header, payload);
}

function contains(haystack: Uint8Array, needle: string) {
  return Buffer.from(haystack).includes(Buffer.from(needle, "latin1"));
}

/**
 * Un video con la ubicación donde se grabó, como lo dejan los teléfonos: Android en `udta/©xyz`,
 * iPhone en `meta` (`com.apple.quicktime.location.ISO6709`), una pista con su propio `meta` y el XMP
 * de un editor en una caja `uuid` de 64 bits al final. `moov` va al final del archivo, así las
 * posiciones de los cuadros en `mdat` no cambian y sigue siendo un video válido.
 */
function withLocation() {
  const original = fixture("moov-al-final.mp4");
  const read = new DataView(original.buffer, original.byteOffset, original.byteLength);
  let at = 0;
  while (at < original.byteLength) {
    const size = read.getUint32(at);
    const type = new TextDecoder("latin1").decode(original.subarray(at + 4, at + 8));
    if (type === "moov") break;
    at += size;
  }
  const moovSize = read.getUint32(at);
  const payload = original.subarray(at + 8, at + moovSize);
  const parts = children(payload, 0, payload.byteLength).map((child) => {
    const whole = payload.subarray(child.at, child.end);
    if (child.type !== "trak") return whole;
    // La primera pista lleva sus propios metadatos (modelo del teléfono).
    return box(
      "trak",
      concat(payload.subarray(child.start, child.end), box("meta", text("iPhone 15 Pro"))),
    );
  });
  const android = box("udta", box("©xyz", text("+19.4326-099.1332/")));
  const iphone = box(
    "meta",
    concat(text("com.apple.quicktime.location.ISO6709"), text("+19.4326-099.1332+2240.000/")),
  );
  const moov = box("moov", concat(...parts, android, iphone));
  const xmp = box("uuid", text("<exif:GPSLatitude>19,25.956N</exif:GPSLatitude>"), true);
  return concat(original.subarray(0, at), moov, original.subarray(at + moovSize), xmp);
}

describe("metadatos de un video (ADR-062)", () => {
  it.each(FIXTURES)("%s: se quitan sin cambiar el tamaño ni lo que se reproduce", async (name) => {
    const bytes = fixture(name);
    const ranges = await metadataRanges(readerOf(bytes), bytes.byteLength);
    expect(ranges.length).toBeGreaterThan(0);

    const cleaned = await bytesOf(await withoutMetadata(new Blob([bytes])));
    expect(cleaned.byteLength).toBe(bytes.byteLength);
    expect(await metadataRanges(readerOf(cleaned), cleaned.byteLength)).toEqual([]);
    // Lo que se reproduce no cambia: mismas medidas, duración y códecs.
    expect(await inspectVideo(readerOf(cleaned), cleaned.byteLength, LIMITS)).toEqual(
      await inspectVideo(readerOf(bytes), bytes.byteLength, LIMITS),
    );
    // Fuera de las cajas quitadas, cada byte es igual; dentro, una caja `free` de ceros.
    let at = 0;
    for (const { start, end } of ranges) {
      expect(
        Buffer.from(cleaned.subarray(at, start)).equals(Buffer.from(bytes.subarray(at, start))),
      ).toBe(true);
      const free = cleaned.subarray(start, end);
      expect(new DataView(free.buffer, free.byteOffset).getUint32(0)).toBe(end - start);
      expect(new TextDecoder().decode(free.subarray(4, 8))).toBe("free");
      expect(free.subarray(8).every((byte) => byte === 0)).toBe(true);
      at = end;
    }
    expect(Buffer.from(cleaned.subarray(at)).equals(Buffer.from(bytes.subarray(at)))).toBe(true);
  });

  it("quita la ubicación de Android, de iPhone, de cada pista y del XMP de un editor", async () => {
    const bytes = withLocation();
    for (const secret of ["+19.4326", "ISO6709", "GPSLatitude", "iPhone 15 Pro"]) {
      expect(contains(bytes, secret)).toBe(true);
    }
    const before = await inspectVideo(readerOf(bytes), bytes.byteLength, LIMITS);

    const cleaned = await bytesOf(await withoutMetadata(new Blob([bytes], { type: "video/mp4" })));
    expect(cleaned.byteLength).toBe(bytes.byteLength);
    for (const secret of ["+19.4326", "ISO6709", "GPSLatitude", "iPhone 15 Pro"]) {
      expect(contains(cleaned, secret)).toBe(false);
    }
    expect(await inspectVideo(readerOf(cleaned), cleaned.byteLength, LIMITS)).toEqual(before);
    await expect(assertNoMetadata(readerOf(cleaned), cleaned.byteLength)).resolves.toBeUndefined();
  });

  it("el servidor rechaza un video que todavía los trae", async () => {
    const bytes = withLocation();
    await expect(assertNoMetadata(readerOf(bytes), bytes.byteLength)).rejects.toMatchObject({
      code: "HAS_METADATA",
    });
  });

  it("sin metadatos devuelve el mismo archivo, y el lector de un Blob lee por rangos", async () => {
    const cleaned = await withoutMetadata(new Blob([fixture("video-corto.mp4")]));
    expect(await withoutMetadata(cleaned)).toBe(cleaned);
    const head = await blobReader(cleaned)(4, 4);
    expect(new TextDecoder().decode(head)).toBe("ftyp");
  });

  it("lo que no es un video MP4 o MOV no se toca: NOT_VIDEO o CORRUPT", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    await expect(withoutMetadata(new Blob([png]))).rejects.toMatchObject({ code: "NOT_VIDEO" });
    const cut = fixture("video-corto.mp4").subarray(0, 1_000);
    const error = await withoutMetadata(new Blob([cut])).catch((reason: unknown) => reason);
    expect(error).toBeInstanceOf(VideoValidationError);
    expect((error as VideoValidationError).code).toBe("CORRUPT");
  });
});
