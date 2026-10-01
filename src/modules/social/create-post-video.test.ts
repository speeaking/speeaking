import { beforeEach, describe, expect, it, vi } from "vitest";

/** Videos cortos (ADR-062): una publicación lleva fotos o un video propio ya revisado, nunca ambos. */
const db = vi.hoisted(() => ({
  media: { findMany: vi.fn(), findFirst: vi.fn() },
  community: { findUnique: vi.fn() },
  product: { findFirst: vi.fn() },
  post: { create: vi.fn() },
  authenticityCheck: { findMany: vi.fn() },
  authenticityProofHistory: { findMany: vi.fn() },
}));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
);

vi.mock("@/server/db", () => ({ db }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identity/session", () => ({
  getViewer: vi.fn(),
  requireOnboardedViewer: vi.fn(async () => ({ userId: VIEWER })),
}));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
vi.mock("./limits", () => ({ checkSocialLimit: vi.fn(async () => ({ ok: true })) }));

const { createPostAction } = await import("./actions");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const PHOTO = "0199a000-0000-7000-8000-0000000000f1";
const VIDEO = "0199a000-0000-7000-8000-0000000000f3";

function form({ mediaIds = [], videoId }: { mediaIds?: string[]; videoId?: string }) {
  const data = new FormData();
  data.set("body", "Miren el atardecer");
  for (const id of mediaIds) data.append("mediaIds", id);
  if (videoId) data.set("videoId", videoId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.media.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({ id })),
  );
  db.media.findFirst.mockResolvedValue({ id: VIDEO });
  db.authenticityCheck.findMany.mockResolvedValue([]);
  db.authenticityProofHistory.findMany.mockResolvedValue([]);
  db.post.create.mockResolvedValue({ id: "0199a000-0000-7000-8000-0000000000aa" });
});

describe("createPostAction con video (ADR-062)", () => {
  it("publica el video propio y revisado como publicación de tipo VIDEO", async () => {
    await expect(createPostAction({}, form({ videoId: VIDEO }))).rejects.toThrow(
      "REDIRECT /p/0199a000-0000-7000-8000-0000000000aa",
    );

    expect(db.media.findFirst).toHaveBeenCalledWith({
      where: { id: VIDEO, ownerId: VIEWER, status: "READY", kind: "VIDEO" },
      select: { id: true },
    });
    expect(db.post.create.mock.calls[0]![0].data).toMatchObject({
      authorId: VIEWER,
      type: "VIDEO",
      media: { create: [{ mediaId: VIDEO, position: 0 }] },
    });
  });

  it("un video ajeno, sin revisar o fallido no se publica", async () => {
    db.media.findFirst.mockResolvedValue(null);

    await expect(createPostAction({}, form({ videoId: VIDEO }))).resolves.toEqual({
      error: "El video no es válido. Vuelve a subirlo.",
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("fotos y video juntos no: se elige uno", async () => {
    await expect(
      createPostAction({}, form({ mediaIds: [PHOTO], videoId: VIDEO })),
    ).resolves.toEqual({
      fieldErrors: { body: ["Publica fotos o un video, no los dos juntos."] },
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("un video no se cuela como foto: las fotos deben ser imágenes", async () => {
    db.media.findMany.mockResolvedValue([]);

    await expect(createPostAction({}, form({ mediaIds: [VIDEO] }))).resolves.toEqual({
      error: "Alguna imagen no es válida.",
    });
    expect(db.media.findMany).toHaveBeenCalledWith({
      where: { id: { in: [VIDEO] }, ownerId: VIEWER, status: "READY", kind: "IMAGE" },
      select: { id: true },
    });
  });
});
