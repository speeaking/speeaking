import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BLOCKED_UPLOAD_MESSAGE,
  blockMediaHashes,
  IncompleteFileError,
  isBlockedHash,
  logBlockedUpload,
  sha256Hex,
  sha256HexOfRanges,
  type StayDownClient,
} from "./stay-down";

const ABC = "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad";
const EMPTY = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const HASH_A = "a".repeat(64);
const HASH_B = "b".repeat(64);

const client = {
  media: { findMany: vi.fn() },
  blockedMediaHash: { findUnique: vi.fn(), createMany: vi.fn(), updateMany: vi.fn() },
};
const asClient = () => client as unknown as StayDownClient;

beforeEach(() => {
  vi.clearAllMocks();
  client.blockedMediaHash.findUnique.mockResolvedValue(null);
  client.blockedMediaHash.createMany.mockResolvedValue({ count: 0 });
  client.blockedMediaHash.updateMany.mockResolvedValue({ count: 0 });
  client.media.findMany.mockResolvedValue([]);
});

describe("sha256Hex", () => {
  it("da la huella en hexadecimal en minúsculas (vectores conocidos)", async () => {
    await expect(sha256Hex(new TextEncoder().encode("abc"))).resolves.toBe(ABC);
    await expect(sha256Hex(new Uint8Array(0))).resolves.toBe(EMPTY);
  });

  it("Buffer y Uint8Array con los mismos bytes dan lo mismo", async () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255]);
    await expect(sha256Hex(Buffer.from(bytes))).resolves.toBe(await sha256Hex(bytes));
  });

  it("solo cuenta los bytes de la vista, no el resto de su ArrayBuffer (Buffer del pool)", async () => {
    // `Buffer.from` de algo pequeño es una vista sobre un bloque compartido de 8 KB.
    const pooled = Buffer.from("abc");
    expect(pooled.buffer.byteLength).toBeGreaterThan(3);
    await expect(sha256Hex(pooled)).resolves.toBe(ABC);
    const view = new TextEncoder().encode("xxabcxx").subarray(2, 5);
    await expect(sha256Hex(view)).resolves.toBe(ABC);
  });
});

describe("sha256HexOfRanges", () => {
  const file = Buffer.from(Array.from({ length: 1000 }, (_, index) => index % 251));
  const expected = createHash("sha256").update(file).digest("hex");

  it("lee el archivo por tramos y da la misma huella que de corrido", async () => {
    const calls: Array<[number, number]> = [];
    const read = async (start: number, length: number) => {
      calls.push([start, length]);
      return file.subarray(start, start + length);
    };

    await expect(sha256HexOfRanges(read, file.byteLength, 300)).resolves.toBe(expected);
    expect(calls).toEqual([
      [0, 300],
      [300, 300],
      [600, 300],
      [900, 100],
    ]);
  });

  it("con lecturas cortas sigue desde donde quedó; si le mandan de más, usa solo lo pedido", async () => {
    const short = async (start: number, length: number) =>
      file.subarray(start, start + Math.min(length, 7));
    await expect(sha256HexOfRanges(short, file.byteLength, 300)).resolves.toBe(expected);

    const toEnd = async (start: number) => file.subarray(start);
    await expect(sha256HexOfRanges(toEnd, file.byteLength, 300)).resolves.toBe(expected);
  });

  it("si el archivo se acaba antes de su tamaño, no inventa una huella", async () => {
    const truncated = async (start: number, length: number) =>
      file.subarray(0, 500).subarray(start, start + length);

    await expect(sha256HexOfRanges(truncated, file.byteLength, 300)).rejects.toBeInstanceOf(
      IncompleteFileError,
    );
  });
});

describe("isBlockedHash", () => {
  it("busca la huella exacta en los archivos bloqueados", async () => {
    await expect(isBlockedHash(asClient(), HASH_A)).resolves.toBe(false);
    client.blockedMediaHash.findUnique.mockResolvedValueOnce({ sha256: HASH_A });
    await expect(isBlockedHash(asClient(), HASH_A)).resolves.toBe(true);
    expect(client.blockedMediaHash.findUnique).toHaveBeenLastCalledWith({
      where: { sha256: HASH_A },
      select: { sha256: true },
    });
  });

  it("acepta mayúsculas; una huella mal formada es un error, nunca un «no bloqueado»", async () => {
    await isBlockedHash(asClient(), HASH_A.toUpperCase());
    expect(client.blockedMediaHash.findUnique).toHaveBeenLastCalledWith(
      expect.objectContaining({ where: { sha256: HASH_A } }),
    );

    await expect(isBlockedHash(asClient(), "abc")).rejects.toThrow();
    await expect(isBlockedHash(asClient(), `${HASH_A}0`)).rejects.toThrow();
  });
});

describe("blockMediaHashes", () => {
  it("bloquea las huellas de esos archivos (no la portada de un video), sin repetir ni vacías", async () => {
    client.media.findMany.mockResolvedValueOnce([
      { sha256: HASH_A },
      { sha256: null },
      { sha256: HASH_B },
      { sha256: HASH_A },
    ]);
    client.blockedMediaHash.createMany.mockResolvedValueOnce({ count: 2 });

    await expect(
      blockMediaHashes(asClient(), ["m1", "m2", "m3"], "RIGHTS_NOTICE", "notice-1"),
    ).resolves.toBe(2);

    // La portada la genera el navegador desde el video: sus bytes no salen de ahí, y bloquearla solo
    // le quitaría la portada a otro video con el mismo cuadro (uno negro, por ejemplo).
    expect(client.media.findMany).toHaveBeenCalledWith({
      where: { id: { in: ["m1", "m2", "m3"] }, sha256: { not: null } },
      select: { sha256: true },
    });
    expect(client.blockedMediaHash.createMany).toHaveBeenCalledWith({
      data: [
        { sha256: HASH_A, reason: "RIGHTS_NOTICE", noticeId: "notice-1" },
        { sha256: HASH_B, reason: "RIGHTS_NOTICE", noticeId: "notice-1" },
      ],
      skipDuplicates: true,
    });
  });

  it("lo ya bloqueado no se repite ni falla: cuenta solo lo nuevo", async () => {
    client.media.findMany.mockResolvedValueOnce([{ sha256: HASH_A }]);
    client.blockedMediaHash.createMany.mockResolvedValueOnce({ count: 0 });

    await expect(blockMediaHashes(asClient(), ["m1"], "CHILD_SAFETY")).resolves.toBe(0);
    expect(client.blockedMediaHash.createMany).toHaveBeenCalledWith({
      data: [{ sha256: HASH_A, reason: "CHILD_SAFETY", noticeId: null }],
      skipDuplicates: true,
    });
  });

  it("un aviso de derechos no cambia lo ya bloqueado por otro motivo", async () => {
    client.media.findMany.mockResolvedValueOnce([{ sha256: HASH_A }]);

    await blockMediaHashes(asClient(), ["m1"], "RIGHTS_NOTICE", "notice-1");

    expect(client.blockedMediaHash.updateMany).not.toHaveBeenCalled();
  });

  it("nuestras reglas pesan más que un aviso: lo ya bloqueado sube de motivo y se suelta del aviso", async () => {
    // Si no, restaurar el aviso tras un contra-aviso (borrar sus huellas) volvería a permitir
    // contenido íntimo o de menores que también se retiró por eso.
    client.media.findMany.mockResolvedValue([{ sha256: HASH_A }, { sha256: HASH_B }]);

    await blockMediaHashes(asClient(), ["m1", "m2"], "MODERATION");
    expect(client.blockedMediaHash.updateMany).toHaveBeenLastCalledWith({
      where: { sha256: { in: [HASH_A, HASH_B] }, reason: { in: ["RIGHTS_NOTICE"] } },
      data: { reason: "MODERATION", noticeId: null },
    });

    await blockMediaHashes(asClient(), ["m1", "m2"], "INTIMATE_WITHOUT_CONSENT");
    expect(client.blockedMediaHash.updateMany).toHaveBeenLastCalledWith({
      where: {
        sha256: { in: [HASH_A, HASH_B] },
        reason: { in: ["RIGHTS_NOTICE", "MODERATION"] },
      },
      data: { reason: "INTIMATE_WITHOUT_CONSENT", noticeId: null },
    });

    await blockMediaHashes(asClient(), ["m1", "m2"], "CHILD_SAFETY");
    expect(client.blockedMediaHash.updateMany).toHaveBeenLastCalledWith({
      where: {
        sha256: { in: [HASH_A, HASH_B] },
        reason: { in: ["RIGHTS_NOTICE", "MODERATION", "INTIMATE_WITHOUT_CONSENT"] },
      },
      data: { reason: "CHILD_SAFETY", noticeId: null },
    });
  });

  it("sin archivos o sin huellas (subidos antes de ADR-076) no escribe nada", async () => {
    await expect(blockMediaHashes(asClient(), [], "MODERATION")).resolves.toBe(0);
    expect(client.media.findMany).not.toHaveBeenCalled();

    client.media.findMany.mockResolvedValueOnce([{ sha256: null }]);
    await expect(blockMediaHashes(asClient(), ["m1"], "MODERATION")).resolves.toBe(0);
    expect(client.blockedMediaHash.createMany).not.toHaveBeenCalled();
    expect(client.blockedMediaHash.updateMany).not.toHaveBeenCalled();
  });
});

describe("logBlockedUpload", () => {
  it("deja el intento en el log con la huella y sin datos de la persona", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    logBlockedUpload("image", HASH_A);

    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]).toEqual([`[stay-down] subida rechazada (foto): ${HASH_A}`]);
    warn.mockRestore();
  });

  it("el mensaje para la persona dice por qué, sin acusar", () => {
    expect(BLOCKED_UPLOAD_MESSAGE).toBe(
      "No puedes subir este archivo: se retiró de speeaking por un aviso de derechos o por nuestras reglas.",
    );
  });
});
