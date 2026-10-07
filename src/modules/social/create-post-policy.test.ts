import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Una publicación con una oferta prohibida (venta de facturas, IPTV, servicios sexuales…) no se
 * publica: un aviso con la categoría y la liga a los Términos, sin tocar la base ni sancionar la
 * cuenta. Hablar de algo no es venderlo: «dejé el vape» sí se publica. Las reglas se prueban en
 * trust/content-policy.test.
 */
const db = vi.hoisted(() => ({
  media: { findMany: vi.fn() },
  community: { findUnique: vi.fn() },
  product: { findUnique: vi.fn() },
  post: { create: vi.fn() },
  authenticityCheck: { findMany: vi.fn() },
  authenticityProofHistory: { findMany: vi.fn() },
  $transaction: vi.fn(),
}));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
);
const limits = vi.hoisted(() => ({ checkSocialLimit: vi.fn() }));

vi.mock("@/server/db", () => ({ db }));
vi.mock("next/navigation", () => ({
  redirect,
  RedirectType: { push: "push", replace: "replace" },
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identity/session", () => ({
  getViewer: vi.fn(),
  requireOnboardedViewer: vi.fn(async () => ({ userId: VIEWER })),
}));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
vi.mock("@/modules/notifications/notify", () => ({
  notifyComment: vi.fn(),
  notifyMentions: vi.fn(),
  notifyProductTagged: vi.fn(),
  notifyReaction: vi.fn(),
  removeReactionNotification: vi.fn(),
}));
vi.mock("./limits", () => limits);

const { createPostAction } = await import("./actions");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const PRODUCT = "0199a000-0000-7000-8000-0000000000b1";
const POST = "0199a000-0000-7000-8000-0000000000aa";
const HELP = { href: "/terminos#prohibidos", label: "Ver qué no se puede publicar" };

function form(body: string, productId?: string) {
  const data = new FormData();
  data.set("body", body);
  if (productId) data.set("productId", productId);
  return data;
}

let warn: ReturnType<typeof vi.spyOn>;
beforeEach(() => {
  vi.clearAllMocks();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  limits.checkSocialLimit.mockResolvedValue({ ok: true });
  db.media.findMany.mockResolvedValue([]);
  db.authenticityCheck.findMany.mockResolvedValue([]);
  db.authenticityProofHistory.findMany.mockResolvedValue([]);
  db.product.findUnique.mockResolvedValue({
    id: PRODUCT,
    status: "ACTIVE",
    moderationStatus: "VISIBLE",
    seller: { userId: VIEWER, status: "ACTIVE", acceptsCollaborations: false },
  });
  db.post.create.mockResolvedValue({ id: POST });
  db.$transaction.mockImplementation(async (run: (tx: typeof db) => unknown) => run(db));
});
afterEach(() => warn.mockRestore());

describe("createPostAction con contenido prohibido", () => {
  it("detiene una oferta prohibida antes de tocar la base y registra solo la categoría", async () => {
    await expect(
      createPostAction({}, form("Vendo facturas deducibles de todos los giros, inbox")),
    ).resolves.toEqual({
      error: expect.stringMatching(
        /^No se puede publicar\. Tu texto menciona la compra o venta de facturas.*«Artículos prohibidos y restringidos» en los Términos\.$/,
      ),
      helpLink: HELP,
    });

    expect(db.post.create).not.toHaveBeenCalled();
    expect(db.media.findMany).not.toHaveBeenCalled();
    expect(redirect).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledExactlyOnceWith(
      "[trust] publicación detenida por la política de contenido: fake_invoices (post.create)",
    );
  });

  it("cuenta el intento en el límite de publicaciones (no sirve para probar el filtro sin fin)", async () => {
    await createPostAction({}, form("Masajes con final feliz"));

    expect(limits.checkSocialLimit).toHaveBeenCalledWith("post", VIEWER);
  });

  it("hablar de algo no es venderlo: se publica", async () => {
    await expect(createPostAction({}, form("Dejé el vape hace un mes 💪"))).rejects.toThrow(
      `REDIRECT /p/${POST}`,
    );
    expect(db.post.create).toHaveBeenCalledOnce();
    expect(warn).not.toHaveBeenCalled();
  });

  it("con un producto etiquetado ya ofrece algo: el artículo prohibido se detiene", async () => {
    await expect(createPostAction({}, form("Mi vape favorito 😍", PRODUCT))).resolves.toEqual({
      error: expect.stringContaining("vapeadores"),
      helpLink: HELP,
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });
});
