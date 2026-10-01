import {
  children,
  MAX_TOP_LEVEL_BOXES,
  type RangeReader,
  readMovieBox,
  topLevelBox,
  VideoValidationError,
} from "./video-container";

/**
 * Metadatos de un video que pueden revelar a quien lo grabó (ADR-062): el lugar donde se grabó
 * (`©xyz` o `loci` dentro de `udta`; `com.apple.quicktime.location.ISO6709` dentro de `meta`), la
 * marca, el modelo y el programa del teléfono, y el XMP que dejan los editores (`uuid`). Las fotos
 * se re-codifican sin metadatos; los videos no se transcodifican, así que el navegador cambia cada
 * una de esas cajas por una caja vacía (`free`) del MISMO tamaño, llena de ceros, antes de subirlo:
 * el archivo mide lo mismo (la URL firmada sigue sirviendo), los cuadros no se mueven y el dato ya no
 * está en el archivo. El servidor revisa que ya no traiga ninguna (`assertNoMetadata`).
 *
 * Sin dependencias de Node ni del DOM (solo `Blob`): lo usan el navegador, el servidor y las pruebas.
 */

/** Cajas que solo guardan metadatos: de primer nivel y dentro de `moov`. */
const FILE_LEVEL = new Set(["udta", "meta", "uuid"]);
/** Dentro de cada pista (`trak`). */
const TRACK_LEVEL = new Set(["udta", "meta"]);

export type ByteRange = { start: number; end: number };

/** Rangos de las cajas de metadatos (completas, con su encabezado), en orden y sin encimarse. */
export async function metadataRanges(read: RangeReader, fileSize: number): Promise<ByteRange[]> {
  const ranges: ByteRange[] = [];
  let offset = 0;
  for (let index = 0; offset < fileSize; index += 1) {
    if (index >= MAX_TOP_LEVEL_BOXES) throw new VideoValidationError("CORRUPT");
    const box = await topLevelBox(read, fileSize, offset, index === 0 ? "ftyp" : undefined);
    if (FILE_LEVEL.has(box.type)) {
      ranges.push({ start: offset, end: offset + box.size });
    } else if (box.type === "moov") {
      const moov = await readMovieBox(read, offset, box);
      const base = offset + box.headerSize;
      for (const child of children(moov, 0, moov.byteLength)) {
        if (FILE_LEVEL.has(child.type)) {
          ranges.push({ start: base + child.at, end: base + child.end });
        } else if (child.type === "trak") {
          for (const inner of children(moov, child.start, child.end)) {
            if (TRACK_LEVEL.has(inner.type)) {
              ranges.push({ start: base + inner.at, end: base + inner.end });
            }
          }
        }
      }
    }
    offset += box.size;
  }
  return ranges.sort((a, b) => a.start - b.start);
}

/** Para el servidor: un video que todavía trae metadatos no se publica. */
export async function assertNoMetadata(read: RangeReader, fileSize: number): Promise<void> {
  if ((await metadataRanges(read, fileSize)).length > 0) {
    throw new VideoValidationError("HAS_METADATA");
  }
}

/** Lector por rangos sobre un `Blob` (el `File` que eligió la persona). */
export function blobReader(blob: Blob): RangeReader {
  return async (start, length) =>
    new Uint8Array(await blob.slice(start, start + length).arrayBuffer());
}

/** Caja `free` de `size` bytes (encabezado de 8 y ceros). */
function freeBox(size: number): Uint8Array<ArrayBuffer> {
  const box = new Uint8Array(size);
  new DataView(box.buffer).setUint32(0, size);
  box.set([0x66, 0x72, 0x65, 0x65], 4);
  return box;
}

/**
 * El video sin sus metadatos, del mismo tamaño: cada caja de metadatos se vuelve una caja `free` de
 * ceros. Si no trae ninguna, el mismo archivo. Lanza `VideoValidationError` si no es un MP4 o MOV.
 */
export async function withoutMetadata(file: Blob): Promise<Blob> {
  const ranges = await metadataRanges(blobReader(file), file.size);
  if (ranges.length === 0) return file;
  const parts: BlobPart[] = [];
  let at = 0;
  for (const range of ranges) {
    parts.push(file.slice(at, range.start), freeBox(range.end - range.start));
    at = range.end;
  }
  parts.push(file.slice(at));
  return new Blob(parts, { type: file.type });
}
