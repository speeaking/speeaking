import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { inspectVideo, type VideoValidationCode, VideoValidationError } from "./video-container";

const LIMITS = { maxDurationMs: 60_500, maxDimension: 4096 };

/** Videos reales de 2 s hechos con ffmpeg (`tests/fixtures/video`, de 17 a 28 KB). */
function fixture(name: string) {
  return readFileSync(`tests/fixtures/video/${name}`);
}

/** Lector por rangos sobre los bytes, contando cuántas lecturas hace (cada una sería una petición). */
function readerOf(bytes: Uint8Array) {
  const reader = Object.assign(
    async (start: number, length: number) => {
      reader.reads += 1;
      return bytes.slice(start, start + length);
    },
    { reads: 0 },
  );
  return reader;
}

async function inspect(bytes: Uint8Array) {
  return inspectVideo(readerOf(bytes), bytes.byteLength, LIMITS);
}

async function rejection(bytes: Uint8Array): Promise<VideoValidationCode> {
  try {
    await inspect(bytes);
  } catch (error) {
    if (error instanceof VideoValidationError) return error.code;
    throw error;
  }
  throw new Error("Se esperaba un rechazo");
}

/** Posición del primer `type` (fourcc) a partir de `from`. */
function indexOfType(bytes: Uint8Array, type: string, from = 0) {
  return Buffer.from(bytes).indexOf(Buffer.from(type, "latin1"), from);
}

function patched(bytes: Uint8Array, patch: (copy: Buffer) => void) {
  const copy = Buffer.from(bytes);
  patch(copy);
  return copy;
}

describe("inspectVideo (ADR-062)", () => {
  it("lee duración, medidas y códecs de un MP4 de teléfono sin cargarlo completo", async () => {
    const bytes = fixture("video-corto.mp4");
    const reader = readerOf(bytes);

    await expect(inspectVideo(reader, bytes.byteLength, LIMITS)).resolves.toEqual({
      brand: "isom",
      durationMs: 2000,
      width: 180,
      height: 320,
      videoCodec: "avc1",
      audioCodec: "mp4a",
    });
    // `ftyp` (cabecera y marca) y `moov` (cabecera y contenido): unos KB, no los 28 KB.
    expect(reader.reads).toBe(4);
  });

  it("encuentra `moov` aunque esté al final, después del video", async () => {
    await expect(inspect(fixture("moov-al-final.mp4"))).resolves.toMatchObject({
      durationMs: 2000,
      width: 180,
      height: 320,
    });
  });

  it("un MOV de iPhone grabado vertical (girado 90°) da sus medidas como se ve", async () => {
    // El archivo guarda 320×180 con una matriz de rotación: se ve vertical, 180×320.
    await expect(inspect(fixture("girado.mov"))).resolves.toMatchObject({
      brand: "qt  ",
      width: 180,
      height: 320,
      audioCodec: null,
    });
  });

  it("acepta HEVC (la tarjeta avisa si el navegador no lo reproduce)", async () => {
    await expect(inspect(fixture("hevc.mp4"))).resolves.toMatchObject({ videoCodec: "hvc1" });
  });

  it("rechaza lo que dura más de 60 s", async () => {
    const bytes = patched(fixture("video-corto.mp4"), (copy) => {
      // `mvhd` versión 0: escala de tiempo en +12 y duración en +16 (después de versión y banderas).
      const at = indexOfType(copy, "mvhd") + 4;
      copy.writeUInt32BE(copy.readUInt32BE(at + 12) * 61, at + 16);
    });
    expect(await rejection(bytes)).toBe("TOO_LONG");
  });

  it("rechaza códecs que los navegadores no reproducen, de video o de audio", async () => {
    const original = fixture("video-corto.mp4");
    const stsd = indexOfType(original, "stsd");
    const mpeg4 = patched(original, (copy) =>
      copy.write("mp4v", indexOfType(copy, "avc1", stsd), "latin1"),
    );
    expect(await rejection(mpeg4)).toBe("UNSUPPORTED_VIDEO");

    const amr = patched(original, (copy) =>
      copy.write("samr", indexOfType(copy, "mp4a", stsd), "latin1"),
    );
    expect(await rejection(amr)).toBe("UNSUPPORTED_AUDIO");
  });

  it("rechaza lo que no es un video: una foto, un HEIC o un archivo cortado", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
      "base64",
    );
    expect(await rejection(png)).toBe("NOT_VIDEO");

    // Misma estructura (ISO-BMFF) pero sin `moov`: una foto HEIC.
    const heic = Buffer.alloc(32);
    heic.writeUInt32BE(24, 0);
    heic.write("ftypheic", 4, "latin1");
    heic.writeUInt32BE(8, 24);
    heic.write("meta", 28, "latin1");
    expect(await rejection(heic)).toBe("NOT_VIDEO");

    const original = fixture("video-corto.mp4");
    // Cortado a la mitad de `moov`: su tamaño declarado ya no cabe en el archivo.
    expect(await rejection(original.subarray(0, indexOfType(original, "moov") + 200))).toBe(
      "CORRUPT",
    );
  });

  it("rechaza un video sin duración o de más de 4K", async () => {
    const original = fixture("video-corto.mp4");
    const noDuration = patched(original, (copy) => {
      const at = indexOfType(copy, "mvhd") + 4;
      copy.writeUInt32BE(0, at + 16);
    });
    expect(await rejection(noDuration)).toBe("NO_DURATION");

    const huge = patched(original, (copy) => {
      // `tkhd` versión 0: el ancho (16.16) va 76 bytes después de versión y banderas.
      const at = indexOfType(copy, "tkhd") + 4;
      copy.writeUInt32BE(5000 * 65536, at + 76);
    });
    expect(await rejection(huge)).toBe("BAD_DIMENSIONS");
  });
});
