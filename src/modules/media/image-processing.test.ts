import { deflateSync } from "node:zlib";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import {
  exceedsDecodeBudget,
  ImageValidationError,
  MAX_UPLOAD_BYTES,
  processImage,
  resizeForDelivery,
  resizeForVision,
  sniffImageFormat,
} from "./image-processing";

async function jpegWithGps(width = 64, height = 48) {
  return sharp({ create: { width, height, channels: 3, background: "#ca2352" } })
    .jpeg()
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "19/1 25/1 0/1" } })
    .toBuffer();
}

function crc32(bytes: Buffer) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function pngChunk(type: string, data: Buffer) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
}

/**
 * PNG de ~70 bytes cuya cabecera declara `width`×`height` RGBA (el PoC de SEC-13 usaba uno real de
 * 465 KB y 6320×6320 de 16 bits). Sus píxeles no existen: si se intentara decodificar, fallaría como
 * CORRUPT; que falle como TOO_COMPLEX prueba que se rechazó solo con la cabecera.
 */
function pngHeaderOnly(width: number, height: number, bitDepth: 8 | 16) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = bitDepth;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk("IHDR", header),
    pngChunk("IDAT", deflateSync(Buffer.alloc(16))),
    pngChunk("IEND", Buffer.alloc(0)),
  ]);
}

describe("processImage", () => {
  it("re-codifica a WebP y elimina los metadatos EXIF (incluido el GPS)", async () => {
    const input = await jpegWithGps();
    expect((await sharp(input).metadata()).exif).toBeDefined();

    const result = await processImage(input);
    const meta = await sharp(result.buffer).metadata();

    expect(result.mimeType).toBe("image/webp");
    expect(meta.format).toBe("webp");
    expect(meta.exif).toBeUndefined();
    expect(result.sizeBytes).toBe(result.buffer.byteLength);
  });

  it("reduce imágenes grandes sin deformarlas y conserva las pequeñas", async () => {
    const big = await jpegWithGps(4000, 2000);
    const small = await jpegWithGps(300, 200);

    const resized = await processImage(big);
    const untouched = await processImage(small);

    expect([resized.width, resized.height]).toEqual([1600, 800]);
    expect([untouched.width, untouched.height]).toEqual([300, 200]);
  });

  it("genera una miniatura borrosa en base64 para la carga progresiva", async () => {
    const result = await processImage(await jpegWithGps());

    expect(result.blurDataUrl).toMatch(/^data:image\/webp;base64,/);
  });

  it("rechaza archivos que no son imágenes aunque digan serlo", async () => {
    const fake = Buffer.from("<html>no soy una imagen</html>");

    await expect(processImage(fake)).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("rechaza SVG (puede contener scripts)", async () => {
    const svg = Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"><script>alert(1)</script></svg>',
    );

    await expect(processImage(svg)).rejects.toBeInstanceOf(ImageValidationError);
    await expect(processImage(svg)).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  it("rechaza archivos más pesados que el límite", async () => {
    const tooBig = Buffer.alloc(MAX_UPLOAD_BYTES + 1);

    await expect(processImage(tooBig)).rejects.toMatchObject({ code: "TOO_LARGE" });
  });

  it("pixel-flood (SEC-13): rechaza por las dimensiones de la cabecera, sin decodificar", async () => {
    const started = performance.now();

    await expect(processImage(pngHeaderOnly(6320, 6320, 16))).rejects.toMatchObject({
      code: "TOO_COMPLEX",
    });
    await expect(processImage(pngHeaderOnly(8000, 8000, 8))).rejects.toMatchObject({
      code: "TOO_COMPLEX",
    });
    // Decodificar 40 Mpx de 16 bits tardaba ~4.6 s; leer la cabecera, milisegundos.
    expect(performance.now() - started).toBeLessThan(1000);
  });

  it("rechaza TIFF antes de pasarlo a sharp (solo firmas permitidas, SEC-36)", async () => {
    const tiff = await sharp({ create: { width: 8, height: 8, channels: 3, background: "#000" } })
      .tiff()
      .toBuffer();

    await expect(processImage(tiff)).rejects.toMatchObject({ code: "UNSUPPORTED_FORMAT" });
  });

  // Codificar y decodificar AVIF es caro: con toda la suite en paralelo pasa de los 5 s por omisión.
  it("acepta AVIF (sharp lo identifica como HEIF)", { timeout: 30_000 }, async () => {
    const avif = await sharp({ create: { width: 32, height: 24, channels: 3, background: "#123" } })
      .avif()
      .toBuffer();

    await expect(processImage(avif)).resolves.toMatchObject({ width: 32, height: 24 });
  });

  it(
    "un AVIF de ~1 KB que declara 25 Mpx (~440 MB al decodificarlo) se rechaza por la cabecera",
    {
      timeout: 30_000,
    },
    async () => {
      const bomb = await sharp({
        create: { width: 5000, height: 5000, channels: 3, background: "#e4007c" },
        limitInputPixels: false,
      })
        .avif({ effort: 0, quality: 30 })
        .toBuffer();
      expect(bomb.byteLength).toBeLessThan(4096);

      await expect(processImage(bomb)).rejects.toMatchObject({ code: "TOO_COMPLEX" });
    },
  );
});

describe("exceedsDecodeBudget", () => {
  const meta = (format: string, width: number, height: number, depth = "uchar", channels = 4) =>
    ({ format, width, height, depth, channels }) as Parameters<typeof exceedsDecodeBudget>[0];

  it("JPEG y WebP (shrink-on-load): hasta 40 Mpx", () => {
    expect(exceedsDecodeBudget(meta("jpeg", 8000, 5000, "uchar", 3))).toBe(false);
    expect(exceedsDecodeBudget(meta("webp", 8000, 5000))).toBe(false);
    expect(exceedsDecodeBudget(meta("jpeg", 8000, 5001, "uchar", 3))).toBe(true);
  });

  it("PNG y GIF (decodificación completa): hasta 100 MB decodificados", () => {
    // 25 Mpx RGBA de 8 bits = 100 MB: justo cabe (~130 MB de pico real; entrelazado, ~200 MB).
    expect(exceedsDecodeBudget(meta("png", 5000, 5000))).toBe(false);
    expect(exceedsDecodeBudget({ ...meta("png", 5000, 5000), isProgressive: true })).toBe(false);
    expect(exceedsDecodeBudget(meta("gif", 5000, 5000))).toBe(false);
    expect(exceedsDecodeBudget(meta("png", 6320, 6320))).toBe(true);
    // 16 bits por muestra: el doble de memoria.
    expect(exceedsDecodeBudget(meta("png", 4000, 4000, "ushort"))).toBe(true);
    expect(exceedsDecodeBudget(meta("png", 3000, 3000, "ushort"))).toBe(false);
  });

  it("AVIF/HEIF: por la memoria medida (~18 B/px), no por la imagen decodificada", () => {
    // 25 Mpx RGB de 8 bits son 75 MB decodificados, pero ~440 MB de pico: antes pasaba.
    expect(exceedsDecodeBudget(meta("heif", 5000, 5000, "uchar", 3))).toBe(true);
    expect(exceedsDecodeBudget(meta("heif", 4000, 4000, "uchar", 3))).toBe(true);
    // Una foto de 12 Mpx (~210 MB medidos) sí cabe; con 10 bits (~270 MB), ya no.
    expect(exceedsDecodeBudget(meta("heif", 4000, 3000, "uchar", 3))).toBe(false);
    expect(exceedsDecodeBudget(meta("heif", 4000, 3000, "ushort", 3))).toBe(true);
    expect(exceedsDecodeBudget(meta("heif", 3000, 3000, "ushort", 3))).toBe(false);
  });

  it("JPEG progresivo: guarda todos los coeficientes aunque se decodifique reducido", () => {
    const jpeg = (chromaSubsampling: string, isProgressive: boolean, channels = 3) => ({
      ...meta("jpeg", 6320, 6320, "uchar", channels),
      chromaSubsampling,
      isProgressive,
    });
    // 40 Mpx 4:4:4 progresivo: ~270 MB medidos.
    expect(exceedsDecodeBudget(jpeg("4:4:4", true))).toBe(true);
    // El mismo en 4:2:0 (~155 MB) o sin progresivo (~45 MB) sí cabe.
    expect(exceedsDecodeBudget(jpeg("4:2:0", true))).toBe(false);
    expect(exceedsDecodeBudget(jpeg("4:4:4", false))).toBe(false);
  });

  it("un GIF animado cuenta solo la primera página (lo único que se decodifica)", () => {
    const gif = { ...meta("gif", 1000, 1000), pageHeight: 1000 };
    expect(exceedsDecodeBudget(gif)).toBe(false);
  });

  it("sin dimensiones no se procesa", () => {
    expect(exceedsDecodeBudget(meta("png", 0, 0))).toBe(true);
  });
});

describe("sniffImageFormat", () => {
  it("reconoce las firmas permitidas", { timeout: 30_000 }, async () => {
    const make = (format: "jpeg" | "png" | "gif" | "webp" | "avif") =>
      sharp({ create: { width: 4, height: 4, channels: 3, background: "#fff" } })
        .toFormat(format)
        .toBuffer();

    expect(sniffImageFormat(await make("jpeg"))).toBe("jpeg");
    expect(sniffImageFormat(await make("png"))).toBe("png");
    expect(sniffImageFormat(await make("gif"))).toBe("gif");
    expect(sniffImageFormat(await make("webp"))).toBe("webp");
    expect(sniffImageFormat(await make("avif"))).toBe("heif");
  });

  it("rechaza SVG, PDF y archivos diminutos", () => {
    expect(sniffImageFormat(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'))).toBeNull();
    expect(sniffImageFormat(Buffer.from("%PDF-1.7 documento"))).toBeNull();
    expect(sniffImageFormat(Buffer.from([0xff, 0xd8]))).toBeNull();
  });
});

describe("resizeForDelivery (variantes de /media, ADR-039)", () => {
  it("reduce al ancho pedido, conserva la proporción y entrega WebP sin metadatos", async () => {
    const input = await jpegWithGps(1200, 900);

    const output = await resizeForDelivery(input, 640);
    const meta = await sharp(output).metadata();

    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 640, 480]);
    expect(meta.exif).toBeUndefined();
  });

  it("nunca agranda una foto más angosta que el ancho pedido", async () => {
    const meta = await sharp(await resizeForDelivery(await jpegWithGps(300, 200), 1080)).metadata();

    expect([meta.width, meta.height]).toEqual([300, 200]);
  });

  it("aplica los mismos topes que una subida: firma y cabecera antes de decodificar", async () => {
    await expect(resizeForDelivery(Buffer.from("<svg></svg>".padEnd(64)), 256)).rejects.toEqual(
      new ImageValidationError("UNSUPPORTED_FORMAT"),
    );
    await expect(resizeForDelivery(pngHeaderOnly(20_000, 20_000, 8), 256)).rejects.toEqual(
      new ImageValidationError("TOO_COMPLEX"),
    );
  });

  it("rechaza anchos fuera de rango", async () => {
    const input = await jpegWithGps();
    for (const width of [0, -1, 1.5, 1601, Number.NaN]) {
      await expect(resizeForDelivery(input, width)).rejects.toBeInstanceOf(RangeError);
    }
  });
});

describe("resizeForVision (búsqueda por foto, ADR-061)", () => {
  it("reduce a 768 px por lado, en JPEG y sin ubicación ni metadatos", async () => {
    const meta = await sharp(await resizeForVision(await jpegWithGps(1600, 1200))).metadata();

    expect([meta.format, meta.width, meta.height]).toEqual(["jpeg", 768, 576]);
    expect(meta.exif).toBeUndefined();
  });

  it("una foto alta también cabe en 768 px y una chica no se agranda", async () => {
    const tall = await sharp(await resizeForVision(await jpegWithGps(900, 3000))).metadata();
    expect(Math.max(tall.width!, tall.height!)).toBe(768);
    const small = await sharp(await resizeForVision(await jpegWithGps(300, 200))).metadata();
    expect([small.width, small.height]).toEqual([300, 200]);
  });

  it("los mismos topes que una subida: nada que no sea una foto llega al decodificador", async () => {
    await expect(resizeForVision(Buffer.from("<svg></svg>".padEnd(64)))).rejects.toEqual(
      new ImageValidationError("UNSUPPORTED_FORMAT"),
    );
    await expect(resizeForVision(pngHeaderOnly(20_000, 20_000, 8))).rejects.toEqual(
      new ImageValidationError("TOO_COMPLEX"),
    );
  });
});
