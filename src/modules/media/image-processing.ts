import sharp, { type Metadata } from "sharp";
import { BusyError, createLimiter } from "./concurrency";

/** Límite por archivo subido (antes de procesar). */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
/** Lado mayor máximo de la imagen publicada. */
export const MAX_DIMENSION = 1600;
/**
 * Protección contra "bombas de descompresión" (pocos KB, píxeles enormes), SEC-13. Se decide con las
 * dimensiones de la cabecera, ANTES de decodificar. JPEG y WebP se decodifican ya reducidos
 * (shrink-on-load): su costo lo acota el peso del archivo, y el tope de píxeles es holgado.
 */
export const MAX_INPUT_PIXELS = 40_000_000;
/**
 * PNG, GIF y AVIF/HEIF se decodifican completos: el tope es el tamaño de la imagen decodificada
 * (100 MB ≈ 25 Mpx RGBA de 8 bits), que acota el tiempo. Un PNG RGBA de 16 bits de ~465 KB y 40 Mpx
 * pedía ~320 MB y ocupaba un hilo 4.6 s; hoy se rechaza sin decodificarlo. De todos modos se publica
 * a 1600 px.
 */
export const MAX_DECODED_BYTES = 100 * 1024 * 1024;
/**
 * Tope del pico de memoria de decodificar una imagen (se procesan hasta `MAX_CONCURRENT` a la vez).
 * La imagen decodificada no lo refleja: medido con sharp 0.35 / libvips 8.18 (pico de RSS por imagen,
 * `.data/security/abuse-review/`), AVIF/HEIF usa ~18 bytes por píxel (~25 con 10–12 bits) y un AVIF
 * de 1 KB y 25 Mpx pedía ~450 MB; un JPEG progresivo guarda todos sus coeficientes (2 bytes por
 * muestra) aunque se decodifique reducido: 40 Mpx en 4:4:4, ~270 MB.
 */
export const MAX_DECODE_MEMORY_BYTES = 256 * 1024 * 1024;
const SHRINK_ON_LOAD_FORMATS = new Set(["jpeg", "webp"]);
const SUPPORTED_FORMATS = new Set(["jpeg", "png", "webp", "avif", "gif", "heif"]);
/** Una imagen que tarda más que esto se rechaza en lugar de seguir ocupando un hilo. */
const PROCESS_TIMEOUT_SECONDS = 10;
/**
 * Imágenes que se procesan a la vez en este proceso y cuántas esperan turno. Cada una ocupa un hilo
 * del threadpool de libuv (4 por omisión); con 2 quedan hilos para leer disco (`/media`), scrypt
 * (login) y DNS aunque lleguen muchas subidas juntas. Si la cola se llena: `ImageBusyError`.
 */
const MAX_CONCURRENT = 2;
const MAX_QUEUED = 16;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
/** Marcas ISO-BMFF (`ftyp`) de AVIF y HEIF. */
const HEIF_BRANDS = new Set([
  "avif",
  "avis",
  "heic",
  "heix",
  "heim",
  "heis",
  "hevc",
  "hevx",
  "mif1",
  "msf1",
]);
const BYTES_PER_SAMPLE: Partial<Record<string, number>> = {
  uchar: 1,
  char: 1,
  ushort: 2,
  short: 2,
};

export type ImageValidationCode = "TOO_LARGE" | "TOO_COMPLEX" | "UNSUPPORTED_FORMAT" | "CORRUPT";

export class ImageValidationError extends Error {
  override name = "ImageValidationError";
  constructor(readonly code: ImageValidationCode) {
    super(`Imagen inválida: ${code}`);
  }
}

/** Hay demasiadas imágenes procesándose: reintentar en unos segundos (503). */
export class ImageBusyError extends BusyError {
  override name = "ImageBusyError";
}

export type ProcessedImage = {
  buffer: Buffer;
  mimeType: "image/webp";
  width: number;
  height: number;
  sizeBytes: number;
  blurDataUrl: string;
};

const queue = createLimiter(MAX_CONCURRENT, MAX_QUEUED);

/**
 * Valida una imagen por su contenido real (no por la extensión ni el MIME declarado), la orienta,
 * la reduce y la re-codifica a WebP. La re-codificación descarta EXIF/XMP/ICC, incluido el GPS,
 * que revelaría dónde se tomó la foto (p. ej. la casa del vendedor).
 */
export async function processImage(input: Buffer): Promise<ProcessedImage> {
  if (input.byteLength > MAX_UPLOAD_BYTES) {
    throw new ImageValidationError("TOO_LARGE");
  }
  // Antes de sharp: solo las firmas de los formatos permitidos. Así un SVG, TIFF o PDF ni siquiera
  // llega a sus decodificadores nativos (librsvg, libtiff), SEC-36.
  if (!sniffImageFormat(input)) {
    throw new ImageValidationError("UNSUPPORTED_FORMAT");
  }

  try {
    return await queue.run(() => decodeAndEncode(input));
  } catch (error) {
    if (error instanceof BusyError) throw new ImageBusyError();
    throw error;
  }
}

async function decodeAndEncode(input: Buffer): Promise<ProcessedImage> {
  let metadata: Metadata;
  try {
    // `metadata()` solo lee la cabecera: no decodifica píxeles. Sin tope aquí para que una imagen
    // enorme se rechace como TOO_COMPLEX (mensaje correcto) y no como formato inválido.
    metadata = await sharp(input, { limitInputPixels: false }).metadata();
  } catch {
    throw new ImageValidationError("UNSUPPORTED_FORMAT");
  }
  if (!metadata.format || !SUPPORTED_FORMATS.has(metadata.format)) {
    throw new ImageValidationError("UNSUPPORTED_FORMAT");
  }
  if (exceedsDecodeBudget(metadata)) {
    throw new ImageValidationError("TOO_COMPLEX");
  }

  try {
    const { data, info } = await sharp(input, {
      limitInputPixels: MAX_INPUT_PIXELS,
      sequentialRead: true,
      failOn: "error",
    })
      .timeout({ seconds: PROCESS_TIMEOUT_SECONDS })
      .rotate()
      .resize({
        width: MAX_DIMENSION,
        height: MAX_DIMENSION,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 82 })
      .toBuffer({ resolveWithObject: true });

    const blur = await sharp(data)
      .resize(16, 16, { fit: "inside" })
      .webp({ quality: 40 })
      .toBuffer();

    return {
      buffer: data,
      mimeType: "image/webp",
      width: info.width,
      height: info.height,
      sizeBytes: data.byteLength,
      blurDataUrl: `data:image/webp;base64,${blur.toString("base64")}`,
    };
  } catch (error) {
    if (error instanceof Error && /timeout/i.test(error.message)) {
      throw new ImageValidationError("TOO_COMPLEX");
    }
    throw new ImageValidationError("CORRUPT");
  }
}

type DecodeCostInput = Pick<
  Metadata,
  "format" | "width" | "height" | "pageHeight" | "channels" | "depth"
> &
  Partial<Pick<Metadata, "isProgressive" | "chromaSubsampling">>;

/** Costo de decodificar la primera página según la cabecera (sharp no decodifica las demás). */
export function exceedsDecodeBudget(metadata: DecodeCostInput) {
  const { format, width, height, pageHeight, channels, depth } = metadata;
  if (!width || !height) return true;
  const pixels = width * (pageHeight ?? height);
  if (pixels > MAX_INPUT_PIXELS) return true;
  if (estimatedDecodeMemory(metadata, pixels) > MAX_DECODE_MEMORY_BYTES) return true;
  if (SHRINK_ON_LOAD_FORMATS.has(format)) return false;
  const decodedBytes = pixels * (channels ?? 4) * (BYTES_PER_SAMPLE[depth] ?? 4);
  return decodedBytes > MAX_DECODED_BYTES;
}

/**
 * Pico de memoria aproximado (bytes) de decodificar `pixels`, con los factores medidos (ver
 * `MAX_DECODE_MEMORY_BYTES`). JPEG base y WebP se decodifican ya reducidos: su costo no crece así.
 */
function estimatedDecodeMemory(
  { format, channels, depth, isProgressive, chromaSubsampling }: DecodeCostInput,
  pixels: number,
) {
  const sampleBytes = BYTES_PER_SAMPLE[depth] ?? 4;
  const bands = channels ?? 4;
  switch (format) {
    case "heif":
      return pixels * (sampleBytes > 1 ? 25 : 18);
    case "gif":
      return pixels * 9;
    case "png":
      // Entrelazada (Adam7) se arma completa dos veces.
      return pixels * bands * sampleBytes * (isProgressive ? 2 : 1.35);
    case "jpeg": {
      if (!isProgressive) return 0;
      // Muestras por píxel: en 4:2:0 las dos de color van a un cuarto de resolución.
      const samples = chromaSubsampling?.startsWith("4:2:0") ? bands - 1.5 : bands;
      return pixels * samples * 2.3;
    }
    default:
      return 0;
  }
}

/** Familia por los primeros bytes (JPEG, PNG, GIF, WebP o AVIF/HEIF); `null` si no es ninguna. */
export function sniffImageFormat(input: Buffer): "jpeg" | "png" | "gif" | "webp" | "heif" | null {
  if (input.length < 12) return null;
  if (input[0] === 0xff && input[1] === 0xd8 && input[2] === 0xff) return "jpeg";
  if (input.subarray(0, 8).equals(PNG_SIGNATURE)) return "png";
  const head = input.subarray(0, 12).toString("latin1");
  if (head.startsWith("GIF87a") || head.startsWith("GIF89a")) return "gif";
  if (head.startsWith("RIFF") && head.slice(8, 12) === "WEBP") return "webp";
  if (head.slice(4, 8) === "ftyp" && HEIF_BRANDS.has(head.slice(8, 12))) return "heif";
  return null;
}
