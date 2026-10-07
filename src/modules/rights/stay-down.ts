import { createHash, webcrypto } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import type { Database } from "@/server/db-client";

/**
 * Lo retirado no vuelve (ADR-076): la LFDA (art. 114 Octies fr. II a), párrafo segundo, que la SCJN
 * validó) pide medidas razonables para que lo retirado por un aviso de derechos o una orden de
 * autoridad no se vuelva a subir; con el contenido íntimo sin consentimiento (Ley Olimpia) y el de
 * menores, volver a publicarlo repite el daño.
 *
 * Cada subida guarda la huella SHA-256 del archivo tal como llegó (`Media.sha256`), antes de
 * re-codificarlo. Al retirar algo, sus huellas pasan a `BlockedMediaHash` y `/api/uploads` y la
 * revisión de videos rechazan ese mismo archivo desde cualquier cuenta. Es coincidencia EXACTA: un
 * solo byte distinto (otra compresión, un recorte) ya no coincide; la coincidencia aproximada
 * (huella perceptual, a revisión humana) queda pendiente.
 *
 * El cliente de Prisma va INYECTADO (la app o una transacción). Sin `server-only` a propósito, como
 * `ai/budget-ledger.ts`; nada aquí llega al navegador.
 */

export type StayDownClient = Prisma.TransactionClient | Database;

/** Motivo guardado en `BlockedMediaHash.reason`. */
export type BlockReason =
  "RIGHTS_NOTICE" | "INTIMATE_WITHOUT_CONSENT" | "CHILD_SAFETY" | "MODERATION";

/**
 * De menor a mayor peso. Hay una sola fila por huella: lo que se retiró por nuestras reglas no puede
 * quedar colgado de un aviso, porque restaurar ese aviso tras un contra-aviso (borrar sus huellas)
 * volvería a permitir el archivo.
 */
const BLOCK_REASONS_BY_WEIGHT: readonly BlockReason[] = [
  "RIGHTS_NOTICE",
  "MODERATION",
  "INTIMATE_WITHOUT_CONSENT",
  "CHILD_SAFETY",
];

/** Lo que ve quien intenta subirlo: el motivo general, sin decir de quién fue el aviso. */
export const BLOCKED_UPLOAD_MESSAGE =
  "No puedes subir este archivo: se retiró de speeaking por un aviso de derechos o por nuestras reglas.";

const SHA256_HEX = /^[0-9a-f]{64}$/;
/** Tramo al leer un video guardado: 50 MB son 7 lecturas y nunca el archivo entero en memoria. */
const RANGE_CHUNK_BYTES = 8 * 1024 * 1024;

/**
 * SHA-256 en hexadecimal (minúsculas). WebCrypto calcula fuera del hilo principal: 10 MB de foto no
 * detienen las demás peticiones. Solo cuenta los bytes de la vista (un `Buffer` pequeño comparte su
 * `ArrayBuffer` con otros).
 */
export async function sha256Hex(bytes: Uint8Array | Buffer): Promise<string> {
  const digest = await webcrypto.subtle.digest("SHA-256", bytes);
  return Buffer.from(digest).toString("hex");
}

/** Lee `length` bytes desde `start` (menos si el archivo termina antes), como `VideoRangeReader`. */
export type RangeReader = (start: number, length: number) => Promise<Uint8Array>;

/** El archivo guardado se acabó antes de su tamaño: cambió o se cortó mientras se leía. */
export class IncompleteFileError extends Error {
  constructor() {
    super("El archivo terminó antes de su tamaño.");
    this.name = "IncompleteFileError";
  }
}

/**
 * SHA-256 de un archivo guardado que se lee por rangos (un video en el bucket: nunca pasa por la
 * app). Si el archivo se acaba antes de `size`, lanza `IncompleteFileError`: nunca una huella de un
 * archivo a medias.
 */
export async function sha256HexOfRanges(
  read: RangeReader,
  size: number,
  chunkBytes = RANGE_CHUNK_BYTES,
): Promise<string> {
  const hash = createHash("sha256");
  let offset = 0;
  while (offset < size) {
    const wanted = Math.min(chunkBytes, size - offset);
    const bytes = await read(offset, wanted);
    if (bytes.byteLength === 0) throw new IncompleteFileError();
    // Un servicio que ignore el rango mandaría de más: solo se usa lo pedido.
    const used = bytes.byteLength > wanted ? bytes.subarray(0, wanted) : bytes;
    hash.update(used);
    offset += used.byteLength;
  }
  return hash.digest("hex");
}

/**
 * ¿Este archivo se retiró antes? Una huella mal formada es un error del código que llama: lanza en
 * lugar de responder «no bloqueado».
 */
export async function isBlockedHash(client: StayDownClient, sha256: string): Promise<boolean> {
  const normalized = sha256.toLowerCase();
  if (!SHA256_HEX.test(normalized)) throw new Error("Huella SHA-256 mal formada.");
  const row = await client.blockedMediaHash.findUnique({
    where: { sha256: normalized },
    select: { sha256: true },
  });
  return row !== null;
}

/**
 * Bloquea las huellas de esos archivos para que nadie los vuelva a subir. Omite los que no tienen
 * huella (subidos antes de ADR-076) y no repite lo ya bloqueado (`ON CONFLICT DO NOTHING`: también
 * con dos retiros a la vez). Lo ya bloqueado por un motivo de menor peso pasa a este y se suelta de
 * su aviso; con uno de igual o mayor peso conserva su motivo y su aviso. Devuelve cuántas huellas
 * bloqueó ahora.
 *
 * La portada de un video no entra sola: la genera el navegador y sus bytes no salen de ahí, así que
 * bloquearla no detiene nada y le quitaría la portada a otro video con el mismo cuadro (uno negro).
 */
export async function blockMediaHashes(
  client: StayDownClient,
  mediaIds: string[],
  reason: BlockReason,
  noticeId?: string,
): Promise<number> {
  if (mediaIds.length === 0) return 0;
  const media = await client.media.findMany({
    where: { id: { in: mediaIds }, sha256: { not: null } },
    select: { sha256: true },
  });
  const hashes = [
    ...new Set(media.flatMap((row) => (row.sha256 ? [row.sha256.toLowerCase()] : []))),
  ];
  if (hashes.length === 0) return 0;
  const { count } = await client.blockedMediaHash.createMany({
    data: hashes.map((sha256) => ({ sha256, reason, noticeId: noticeId ?? null })),
    skipDuplicates: true,
  });
  const lighter = BLOCK_REASONS_BY_WEIGHT.slice(0, BLOCK_REASONS_BY_WEIGHT.indexOf(reason));
  if (lighter.length > 0) {
    await client.blockedMediaHash.updateMany({
      where: { sha256: { in: hashes }, reason: { in: lighter } },
      data: { reason, noticeId: null },
    });
  }
  return count;
}

/**
 * Intento de volver a subir algo retirado. Al log va la huella (con ella el equipo encuentra el
 * motivo y el aviso en `blocked_media_hashes`), nunca la cuenta ni la IP de quien lo intentó.
 */
export function logBlockedUpload(kind: "image" | "video", sha256: string) {
  console.warn(`[stay-down] subida rechazada (${kind === "image" ? "foto" : "video"}): ${sha256}`);
}
