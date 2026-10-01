import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  media: { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
}));
const env = vi.hoisted(() => ({
  STORAGE_DRIVER: "local" as "local" | "s3",
  VIDEO_UPLOADS: undefined as boolean | undefined,
}));
const storage = vi.hoisted(() => ({ delete: vi.fn() }));
const videoStore = vi.hoisted(() => ({ uploadTarget: vi.fn(), size: vi.fn(), reader: vi.fn() }));
const rateLimitMany = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => storage,
  getVideoStore: () => videoStore,
}));
vi.mock("@/server/rate-limit", () => ({
  rateLimitMany,
  rateLimitKey: (scope: string, subject: string, id: string | null) => `${scope}:${subject}:${id}`,
  limitOrError: () => "Demasiados intentos. Intenta de nuevo en 10 minutos.",
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/client-ip", () => ({ clientIp: () => "203.0.113.7" }));

const { finishVideoUpload, startVideoUpload, videoUploadsEnabled } = await import("./video-upload");

const USER = "0199a000-0000-7000-8000-00000000000a";
const POSTER = "0199a000-0000-7000-8000-00000000000b";
const KEY = "videos/2026/10/video.mp4";
const video = readFileSync("tests/fixtures/video/video-corto.mp4");

beforeEach(() => {
  vi.clearAllMocks();
  env.STORAGE_DRIVER = "local";
  env.VIDEO_UPLOADS = undefined;
  rateLimitMany.mockResolvedValue({ ok: true });
  db.media.findFirst.mockResolvedValue({ id: POSTER });
  db.media.create.mockResolvedValue({ id: "video-1" });
  db.media.update.mockResolvedValue({});
  storage.delete.mockResolvedValue(undefined);
  videoStore.uploadTarget.mockResolvedValue({ url: "/api/uploads/video/video-1", headers: {} });
  videoStore.size.mockResolvedValue(video.byteLength);
  videoStore.reader.mockReturnValue(async (start: number, length: number) =>
    video.subarray(start, start + length),
  );
});

describe("videoUploadsEnabled", () => {
  it("en disco sí; con el bucket, solo con VIDEO_UPLOADS=true (después de su CORS)", () => {
    expect(videoUploadsEnabled()).toBe(true);
    env.STORAGE_DRIVER = "s3";
    expect(videoUploadsEnabled()).toBe(false);
    env.VIDEO_UPLOADS = true;
    expect(videoUploadsEnabled()).toBe(true);
  });
});

describe("startVideoUpload (ADR-062)", () => {
  const input = { sizeBytes: 5_000_000, contentType: "video/quicktime", posterId: POSTER };

  it("crea el video en PROCESSING con su portada y dice a dónde subir el archivo", async () => {
    await expect(startVideoUpload(USER, input)).resolves.toEqual({
      ok: true,
      mediaId: "video-1",
      upload: { url: "/api/uploads/video/video-1", headers: {} },
    });
    expect(db.media.findFirst).toHaveBeenCalledWith({
      where: {
        id: POSTER,
        ownerId: USER,
        status: "READY",
        kind: "IMAGE",
        posterOf: null,
      },
      select: { id: true },
    });
    const created = db.media.create.mock.calls[0]![0].data;
    expect(created).toMatchObject({
      ownerId: USER,
      kind: "VIDEO",
      status: "PROCESSING",
      mimeType: "video/mp4",
      sizeBytes: 5_000_000,
      posterId: POSTER,
    });
    expect(created.storageKey).toMatch(/^videos\/\d{4}\/\d{2}\/[0-9a-f-]{36}\.mp4$/);
    expect(videoStore.uploadTarget).toHaveBeenCalledWith({
      key: created.storageKey,
      mediaId: "video-1",
      sizeBytes: 5_000_000,
    });
  });

  it("antes de crear nada: apagado, muy pesado, otro tipo, cuota o una portada ajena", async () => {
    env.STORAGE_DRIVER = "s3";
    await expect(startVideoUpload(USER, input)).resolves.toEqual({
      ok: false,
      error: "Los videos todavía no están disponibles.",
    });
    env.STORAGE_DRIVER = "local";

    await expect(
      startVideoUpload(USER, { ...input, sizeBytes: 51 * 1024 * 1024 }),
    ).resolves.toEqual({ ok: false, error: "El video pesa más de 50 MB." });
    await expect(startVideoUpload(USER, { ...input, contentType: "video/webm" })).resolves.toEqual({
      ok: false,
      error: "Elige un video MP4 o MOV.",
    });

    rateLimitMany.mockResolvedValueOnce({ ok: false, retryAfterSeconds: 600 });
    await expect(startVideoUpload(USER, input)).resolves.toEqual({
      ok: false,
      error: "Demasiados intentos. Intenta de nuevo en 10 minutos.",
    });

    db.media.findFirst.mockResolvedValueOnce(null);
    await expect(startVideoUpload(USER, input)).resolves.toEqual({
      ok: false,
      error: "No pudimos usar la portada del video.",
    });
    expect(db.media.create).not.toHaveBeenCalled();
  });
});

describe("finishVideoUpload", () => {
  const row = {
    id: "video-1",
    status: "PROCESSING",
    storageKey: KEY,
    sizeBytes: video.byteLength,
    width: 0,
    height: 0,
    durationMs: null,
  };

  it("revisa el archivo guardado y lo deja listo con su duración y medidas", async () => {
    db.media.findFirst.mockResolvedValue(row);

    await expect(finishVideoUpload(USER, "video-1")).resolves.toEqual({
      ok: true,
      video: {
        id: "video-1",
        url: `/media/${KEY}`,
        width: 180,
        height: 320,
        durationMs: 2000,
      },
    });
    expect(db.media.update).toHaveBeenCalledWith({
      where: { id: "video-1" },
      data: { status: "READY", width: 180, height: 320, durationMs: 2000, videoCodec: "avc1" },
    });
  });

  it("si todavía no llega, lo dice sin borrar nada; si no coincide el tamaño, lo borra", async () => {
    db.media.findFirst.mockResolvedValue(row);
    videoStore.size.mockResolvedValueOnce(null);
    await expect(finishVideoUpload(USER, "video-1")).resolves.toEqual({
      ok: false,
      error: "Todavía no recibimos el video. Intenta de nuevo.",
    });
    expect(storage.delete).not.toHaveBeenCalled();

    videoStore.size.mockResolvedValueOnce(video.byteLength + 1);
    await expect(finishVideoUpload(USER, "video-1")).resolves.toEqual({
      ok: false,
      error: "El video no llegó completo. Intenta de nuevo.",
    });
    expect(db.media.update).toHaveBeenCalledWith({
      where: { id: "video-1" },
      data: { status: "FAILED" },
    });
    expect(storage.delete).toHaveBeenCalledWith(KEY);
  });

  it("lo que no es un video se borra con un motivo claro", async () => {
    const png = Buffer.from("89504e470d0a1a0a0000000d49484452", "hex");
    db.media.findFirst.mockResolvedValue({ ...row, sizeBytes: png.byteLength });
    videoStore.size.mockResolvedValue(png.byteLength);
    videoStore.reader.mockReturnValue(async (start: number, length: number) =>
      png.subarray(start, start + length),
    );

    await expect(finishVideoUpload(USER, "video-1")).resolves.toEqual({
      ok: false,
      error: "Ese archivo no es un video MP4 o MOV.",
    });
    expect(storage.delete).toHaveBeenCalledWith(KEY);
  });

  it("solo su dueño: el video de otra persona «no existe»; uno ya revisado responde igual", async () => {
    db.media.findFirst.mockResolvedValueOnce(null);
    await expect(finishVideoUpload(USER, "ajeno")).resolves.toEqual({
      ok: false,
      error: "No encontramos ese video.",
    });
    expect(db.media.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "ajeno", ownerId: USER, kind: "VIDEO" } }),
    );

    db.media.findFirst.mockResolvedValueOnce({
      ...row,
      status: "READY",
      width: 180,
      height: 320,
      durationMs: 2000,
    });
    await expect(finishVideoUpload(USER, "video-1")).resolves.toMatchObject({ ok: true });
    expect(videoStore.size).not.toHaveBeenCalled();
  });
});
