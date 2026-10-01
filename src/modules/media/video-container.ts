/**
 * Estructura de un video MP4 o MOV (ISO-BMFF, ISO/IEC 14496-12, y QuickTime) leída SIN cargar el
 * archivo: se recorren las cajas de primer nivel con lecturas por rango hasta encontrar `ftyp` y
 * `moov`, y de `moov` salen la duración, las medidas y los códecs (ADR-062). Los videos no se
 * transcodifican: esta es su validación. Lo que no sea un MP4/MOV con video H.264 o HEVC (y audio AAC
 * u Opus, o sin audio) se rechaza antes de publicarse.
 *
 * Sin dependencias de Node: lo usan el servidor (sobre el disco o el bucket) y las pruebas.
 */

/** Lee `length` bytes desde `start` (menos si el archivo termina antes). */
export type RangeReader = (start: number, length: number) => Promise<Uint8Array>;

export const VIDEO_CODECS = ["avc1", "avc3", "hvc1", "hev1"] as const;
export type VideoCodec = (typeof VIDEO_CODECS)[number];
export const AUDIO_CODECS = ["mp4a", "Opus"] as const;
export type AudioCodec = (typeof AUDIO_CODECS)[number];

export type VideoFacts = {
  /** Marca principal de `ftyp` («isom», «mp42», «qt  »…). */
  brand: string;
  durationMs: number;
  /** Medidas como se ven (con la rotación del teléfono ya aplicada). */
  width: number;
  height: number;
  videoCodec: VideoCodec;
  audioCodec: AudioCodec | null;
};

export type VideoValidationCode =
  | "NOT_VIDEO"
  | "NO_VIDEO_TRACK"
  | "UNSUPPORTED_VIDEO"
  | "UNSUPPORTED_AUDIO"
  | "NO_DURATION"
  | "TOO_LONG"
  | "BAD_DIMENSIONS"
  | "CORRUPT"
  /** Todavía trae metadatos del teléfono o del lugar (`video-metadata.ts`). */
  | "HAS_METADATA";

export class VideoValidationError extends Error {
  override name = "VideoValidationError";
  constructor(readonly code: VideoValidationCode) {
    super(`Video inválido: ${code}`);
  }
}

/** Cajas de primer nivel que se revisan como máximo (un MP4 normal tiene de 3 a 6). */
export const MAX_TOP_LEVEL_BOXES = 32;
/** `moov` de un video de 60 s pesa de 20 KB a ~2 MB; más que esto no es un video corto normal. */
export const MAX_MOOV_BYTES = 8 * 1024 * 1024;
/** Profundidad y cajas por nivel dentro de `moov` (un archivo hecho a mano no las agota). */
const MAX_DEPTH = 8;
const MAX_CHILDREN = 512;

/** Una caja: `at` es donde empieza su encabezado; `start` y `end`, su contenido. */
export type Box = { type: string; at: number; start: number; end: number };

function fourcc(bytes: Uint8Array, at: number) {
  return String.fromCharCode(bytes[at]!, bytes[at + 1]!, bytes[at + 2]!, bytes[at + 3]!);
}

function view(bytes: Uint8Array) {
  return new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
}

function u64(data: DataView, at: number) {
  const value = data.getBigUint64(at);
  if (value > BigInt(Number.MAX_SAFE_INTEGER)) throw new VideoValidationError("CORRUPT");
  return Number(value);
}

/** Cajas hijas de `bytes[start, end)`: tamaño de 32 bits, de 64 (`size = 1`) o hasta el final (`0`). */
export function children(bytes: Uint8Array, start: number, end: number): Box[] {
  const data = view(bytes);
  const boxes: Box[] = [];
  let at = start;
  while (at + 8 <= end) {
    if (boxes.length >= MAX_CHILDREN) throw new VideoValidationError("CORRUPT");
    let size = data.getUint32(at);
    const type = fourcc(bytes, at + 4);
    let header = 8;
    if (size === 1) {
      if (at + 16 > end) throw new VideoValidationError("CORRUPT");
      size = u64(data, at + 8);
      header = 16;
    } else if (size === 0) {
      size = end - at;
    }
    if (size < header || at + size > end) throw new VideoValidationError("CORRUPT");
    boxes.push({ type, at, start: at + header, end: at + size });
    at += size;
  }
  return boxes;
}

function find(bytes: Uint8Array, box: Box, type: string) {
  return children(bytes, box.start, box.end).find((child) => child.type === type) ?? null;
}

/** Busca una ruta de cajas («mdia», «minf», «stbl», «stsd»). */
function path(bytes: Uint8Array, box: Box, types: string[], depth = 0): Box | null {
  if (depth > MAX_DEPTH) throw new VideoValidationError("CORRUPT");
  const [first, ...rest] = types;
  if (!first) return box;
  const next = find(bytes, box, first);
  return next ? path(bytes, next, rest, depth + 1) : null;
}

/** La caja debe tener al menos `bytes` de contenido para leer sus campos. */
function need(box: Box, bytes: number) {
  if (box.end - box.start < bytes) throw new VideoValidationError("CORRUPT");
}

/** `mvhd`: escala de tiempo y duración de la película. */
function movieHeader(bytes: Uint8Array, box: Box) {
  const data = view(bytes);
  if (bytes[box.start] === 1) {
    need(box, 32);
    return { timescale: data.getUint32(box.start + 20), duration: u64(data, box.start + 24) };
  }
  need(box, 20);
  return { timescale: data.getUint32(box.start + 12), duration: data.getUint32(box.start + 16) };
}

/** `mehd` (videos fragmentados): duración total en la escala de la película. */
function fragmentDuration(bytes: Uint8Array, box: Box) {
  const data = view(bytes);
  if (bytes[box.start] === 1) {
    need(box, 12);
    return u64(data, box.start + 4);
  }
  need(box, 8);
  return data.getUint32(box.start + 4);
}

/** `tkhd`: medidas (16.16) y si la matriz gira el video 90° o 270° (videos verticales de teléfono). */
function trackHeader(bytes: Uint8Array, box: Box) {
  const data = view(bytes);
  // Después de versión y banderas: fechas, id, reservado y duración (v1: 8, 8, 4, 4, 8; v0: 4 c/u).
  const afterDuration = box.start + 4 + (bytes[box.start] === 1 ? 32 : 20);
  // Reservado (8), capa (2), grupo (2), volumen (2) y reservado (2); luego la matriz (36), ancho y alto.
  const matrix = afterDuration + 16;
  need(box, matrix + 44 - box.start);
  const a = data.getInt32(matrix);
  const b = data.getInt32(matrix + 4);
  return {
    width: data.getUint32(matrix + 36) / 65536,
    height: data.getUint32(matrix + 40) / 65536,
    rotated: a === 0 && b !== 0,
  };
}

/** Primera entrada de `stsd`: su código («avc1», «mp4a»…) y, si es de video, su ancho y alto. */
function sampleEntry(bytes: Uint8Array, box: Box) {
  need(box, 8);
  const data = view(bytes);
  // Versión y banderas (4) y número de entradas (4).
  const [entry] = children(bytes, box.start + 8, box.end);
  if (!entry) return null;
  const codec = fourcc(bytes, entry.start - 4);
  // Entrada visual: 6 reservados, 2 de referencia y 16 predefinidos o reservados; luego ancho y alto.
  const visual = entry.end - entry.start >= 28;
  return {
    codec,
    width: visual ? data.getUint16(entry.start + 24) : 0,
    height: visual ? data.getUint16(entry.start + 26) : 0,
  };
}

type Track = { handler: string; codec: string; width: number; height: number; rotated: boolean };

function readTrack(bytes: Uint8Array, trak: Box): Track | null {
  const hdlr = path(bytes, trak, ["mdia", "hdlr"]);
  const stsd = path(bytes, trak, ["mdia", "minf", "stbl", "stsd"]);
  const tkhd = find(bytes, trak, "tkhd");
  if (!hdlr || !stsd || !tkhd) return null;
  need(hdlr, 12);
  const entry = sampleEntry(bytes, stsd);
  if (!entry) return null;
  const header = trackHeader(bytes, tkhd);
  return {
    handler: fourcc(bytes, hdlr.start + 8),
    codec: entry.codec,
    width: Math.round(header.width) || entry.width,
    height: Math.round(header.height) || entry.height,
    rotated: header.rotated,
  };
}

/**
 * Encabezado de la caja de primer nivel que empieza en `offset` (una lectura de 16 bytes). Con
 * `requireType`, otro tipo es NOT_VIDEO antes de mirar el tamaño (lo primero de un MP4 es `ftyp`).
 */
export async function topLevelBox(
  read: RangeReader,
  fileSize: number,
  offset: number,
  requireType?: string,
): Promise<{ type: string; size: number; headerSize: number }> {
  const header = await read(offset, Math.min(16, fileSize - offset));
  if (header.byteLength < 8) throw new VideoValidationError("CORRUPT");
  const data = view(header);
  let size = data.getUint32(0);
  const type = fourcc(header, 4);
  if (requireType && type !== requireType) throw new VideoValidationError("NOT_VIDEO");
  let headerSize = 8;
  if (size === 1) {
    if (header.byteLength < 16) throw new VideoValidationError("CORRUPT");
    size = u64(data, 8);
    headerSize = 16;
  } else if (size === 0) {
    size = fileSize - offset;
  }
  if (size < headerSize || offset + size > fileSize) throw new VideoValidationError("CORRUPT");
  return { type, size, headerSize };
}

/** Contenido de `moov` (con tope: uno más grande no es de un video corto normal). */
export async function readMovieBox(
  read: RangeReader,
  offset: number,
  { size, headerSize }: { size: number; headerSize: number },
): Promise<Uint8Array> {
  if (size - headerSize > MAX_MOOV_BYTES) throw new VideoValidationError("CORRUPT");
  const moov = await read(offset + headerSize, size - headerSize);
  if (moov.byteLength !== size - headerSize) throw new VideoValidationError("CORRUPT");
  return moov;
}

/**
 * Recorre el archivo y valida que sea un video corto que los navegadores reproducen. `maxDurationMs`
 * y `maxDimension` vienen de las reglas de video (`video-rules.ts`).
 */
export async function inspectVideo(
  read: RangeReader,
  fileSize: number,
  { maxDurationMs, maxDimension }: { maxDurationMs: number; maxDimension: number },
): Promise<VideoFacts> {
  let offset = 0;
  let brand: string | null = null;
  let moov: Uint8Array | null = null;
  for (let index = 0; offset < fileSize && index < MAX_TOP_LEVEL_BOXES; index += 1) {
    // Un MP4 o MOV de cualquier teléfono empieza con `ftyp`; sin ella no es un video (una foto, un
    // documento). Otro formato con la misma estructura, como HEIC, sí la trae pero no trae `moov`.
    const box = await topLevelBox(read, fileSize, offset, index === 0 ? "ftyp" : undefined);
    const { type, size, headerSize } = box;
    if (type === "ftyp") {
      if (size - headerSize < 4) throw new VideoValidationError("CORRUPT");
      brand = fourcc(await read(offset + headerSize, 4), 0);
    } else if (type === "moov") {
      moov = await readMovieBox(read, offset, box);
      break;
    }
    offset += size;
  }
  if (!brand || !moov) throw new VideoValidationError("NOT_VIDEO");

  const boxes = children(moov, 0, moov.byteLength);
  const mvhd = boxes.find((box) => box.type === "mvhd");
  if (!mvhd) throw new VideoValidationError("CORRUPT");
  const movie = movieHeader(moov, mvhd);
  let duration = movie.duration;
  // Sin duración declarada (video fragmentado o grabado en el navegador): la de `mvex/mehd`.
  if (duration === 0 || duration === 0xffffffff) {
    const mvex = boxes.find((box) => box.type === "mvex");
    const mehd = mvex ? find(moov, mvex, "mehd") : null;
    duration = mehd ? fragmentDuration(moov, mehd) : 0;
  }
  if (movie.timescale === 0 || duration === 0) throw new VideoValidationError("NO_DURATION");
  const durationMs = Math.round((duration / movie.timescale) * 1000);
  if (durationMs > maxDurationMs) throw new VideoValidationError("TOO_LONG");

  const container = moov;
  const tracks = boxes
    .filter((box) => box.type === "trak")
    .map((trak) => readTrack(container, trak))
    .filter((track): track is Track => track !== null);
  const video = tracks.find((track) => track.handler === "vide");
  if (!video) throw new VideoValidationError("NO_VIDEO_TRACK");
  if (!(VIDEO_CODECS as readonly string[]).includes(video.codec)) {
    throw new VideoValidationError("UNSUPPORTED_VIDEO");
  }
  const audio = tracks.find((track) => track.handler === "soun") ?? null;
  if (audio && !(AUDIO_CODECS as readonly string[]).includes(audio.codec)) {
    throw new VideoValidationError("UNSUPPORTED_AUDIO");
  }

  const [width, height] = video.rotated ? [video.height, video.width] : [video.width, video.height];
  if (width < 1 || height < 1 || width > maxDimension || height > maxDimension) {
    throw new VideoValidationError("BAD_DIMENSIONS");
  }
  return {
    brand,
    durationMs,
    width,
    height,
    videoCodec: video.codec as VideoCodec,
    audioCodec: (audio?.codec as AudioCodec | undefined) ?? null,
  };
}
