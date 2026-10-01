import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  media: { findUnique: vi.fn() },
  profile: { update: vi.fn() },
}));
const getViewer = vi.hoisted(() => vi.fn());
const checkSocialLimit = vi.hoisted(() => vi.fn());
const isProofMedia = vi.hoisted(() => vi.fn());
const isTryOnMedia = vi.hoisted(() => vi.fn());
const revalidatePath = vi.hoisted(() => vi.fn());
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { url });
  }),
);

vi.mock("@/server/db", () => ({ db }));
vi.mock("./session", () => ({ getViewer }));
vi.mock("@/modules/social/limits", () => ({ checkSocialLimit }));
vi.mock("@/modules/trust/proof-media", () => ({ isProofMedia }));
vi.mock("@/modules/tryon/media", () => ({ isTryOnMedia }));
vi.mock("next/cache", () => ({ revalidatePath }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("@/server/providers/storage", () => ({
  getStorage: () => ({ publicUrl: (key: string) => `/media/${key}` }),
}));

const { updateProfileAction } = await import("./profile-actions");

const USER = "0199a000-0000-7000-8000-00000000000a";
const OTHER = "0199a000-0000-7000-8000-00000000000b";
const MEDIA = "0199a000-0000-7000-8000-0000000000f1";

function form(values: Record<string, string>) {
  const data = new FormData();
  for (const [key, value] of Object.entries({ displayName: "Ana López", ...values })) {
    data.set(key, value);
  }
  return data;
}

const image = (overrides: Record<string, unknown> = {}) => ({
  id: MEDIA,
  ownerId: USER,
  kind: "IMAGE",
  status: "READY",
  storageKey: "user/ana/foto.webp",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue({ userId: USER, profile: { onboarded: true, username: "ana" } });
  checkSocialLimit.mockResolvedValue({ ok: true });
  isProofMedia.mockResolvedValue(false);
  isTryOnMedia.mockResolvedValue(false);
  db.profile.update.mockResolvedValue({});
});

describe("updateProfileAction (ADR-058)", () => {
  it("guarda nombre, ciudad, presentación y la foto nueva con su URL pública, y regresa al perfil", async () => {
    db.media.findUnique.mockResolvedValue(image());

    await expect(
      updateProfileAction(
        {},
        form({ city: "CDMX", bio: "Vendo ropa linda", avatar: MEDIA, cover: "keep" }),
      ),
    ).rejects.toMatchObject({ url: "/u/ana" });

    expect(db.profile.update).toHaveBeenCalledWith({
      where: { userId: USER },
      data: {
        displayName: "Ana López",
        city: "CDMX",
        bio: "Vendo ropa linda",
        avatarMediaId: MEDIA,
        avatarUrl: "/media/user/ana/foto.webp",
      },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/", "layout");
  });

  it("quitar la foto y la portada las deja vacías", async () => {
    await expect(
      updateProfileAction({}, form({ avatar: "remove", cover: "remove" })),
    ).rejects.toMatchObject({ url: "/u/ana" });

    expect(db.profile.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ avatarMediaId: null, avatarUrl: null, coverMediaId: null }),
      }),
    );
  });

  it("una imagen de otra persona no se puede usar", async () => {
    db.media.findUnique.mockResolvedValue(image({ ownerId: OTHER }));

    const state = await updateProfileAction({}, form({ cover: MEDIA }));

    expect(state.fieldErrors?.cover).toMatch(/No pudimos usar esa imagen/);
    expect(db.profile.update).not.toHaveBeenCalled();
  });

  it("un comprobante de autenticidad o una foto de Pruébatelo nunca es foto de perfil", async () => {
    db.media.findUnique.mockResolvedValue(image());
    isTryOnMedia.mockResolvedValue(true);

    const state = await updateProfileAction({}, form({ avatar: MEDIA }));

    expect(state.fieldErrors?.avatar).toMatch(/No pudimos usar esa imagen/);
    expect(db.profile.update).not.toHaveBeenCalled();
  });

  it("sin sesión, con datos inválidos o con el límite agotado no guarda nada", async () => {
    getViewer.mockResolvedValueOnce(null);
    expect(await updateProfileAction({}, form({}))).toEqual({
      error: "Inicia sesión para editar tu perfil.",
    });

    const invalid = await updateProfileAction({}, form({ displayName: "A" }));
    expect(invalid.fieldErrors?.displayName).toBe("Escribe tu nombre.");

    checkSocialLimit.mockResolvedValueOnce({ ok: false, error: "Demasiados intentos." });
    expect(await updateProfileAction({}, form({}))).toEqual({ error: "Demasiados intentos." });

    expect(db.profile.update).not.toHaveBeenCalled();
  });
});
