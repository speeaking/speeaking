import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Qué producto se puede etiquetar en una publicación (P14, ADR-063). Lo propio, siempre, salvo lo
 * oculto por moderación (el selector de /crear/publicacion ya no lo ofrece; la acción lo rechaza
 * igual). Lo de otra tienda, solo si aceptó colaboraciones y está a la venta: se publica, con la
 * marca de «Colaboración» si quien publica declaró un acuerdo, y la tienda recibe un aviso.
 */
const db = vi.hoisted(() => ({
  media: { findMany: vi.fn(async () => []) },
  community: { findUnique: vi.fn() },
  product: { findUnique: vi.fn() },
  post: { create: vi.fn() },
  authenticityCheck: { findMany: vi.fn(async () => []) },
  authenticityProofHistory: { findMany: vi.fn(async () => []) },
  // La publicación se crea en una transacción (por la comunidad): aquí corre con el mismo cliente.
  $transaction: vi.fn(),
}));
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
);
const notifyProductTagged = vi.hoisted(() => vi.fn(async () => undefined));

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
  notifyReaction: vi.fn(),
  removeReactionNotification: vi.fn(),
  notifyProductTagged,
}));
vi.mock("./limits", () => ({ checkSocialLimit: vi.fn(async () => ({ ok: true })) }));

const { createPostAction } = await import("./actions");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const STORE = "0199a000-0000-7000-8000-00000000000b";
const PRODUCT = "0199a000-0000-7000-8000-0000000000b1";
const POST = "0199a000-0000-7000-8000-0000000000aa";

function form(productId: string, { collaboration = false } = {}) {
  const data = new FormData();
  data.set("body", "Ya llegaron, pregúntame por tallas");
  data.set("productId", productId);
  if (collaboration) data.set("collaboration", "on");
  return data;
}

const mine = (overrides: Record<string, unknown> = {}) => ({
  id: PRODUCT,
  status: "ACTIVE",
  moderationStatus: "VISIBLE",
  seller: { userId: VIEWER, status: "ACTIVE", acceptsCollaborations: false },
  ...overrides,
});
const theirs = (overrides: Record<string, unknown> = {}) => ({
  id: PRODUCT,
  status: "ACTIVE",
  moderationStatus: "VISIBLE",
  seller: { userId: STORE, status: "ACTIVE", acceptsCollaborations: true },
  ...overrides,
});
const created = () => db.post.create.mock.calls[0]![0].data;

beforeEach(() => {
  vi.clearAllMocks();
  db.post.create.mockResolvedValue({ id: POST });
  db.$transaction.mockImplementation(async (run: (tx: typeof db) => unknown) => run(db));
});

describe("createPostAction con un producto propio", () => {
  it("oculto por moderación: lo rechaza con un mensaje claro y no crea la publicación", async () => {
    db.product.findUnique.mockResolvedValue(mine({ moderationStatus: "HIDDEN" }));

    await expect(createPostAction({}, form(PRODUCT))).resolves.toEqual({
      error:
        "Ese producto está oculto por moderación y no se puede publicar. Revisa su estado en Studio → Productos.",
    });
    expect(db.product.findUnique).toHaveBeenCalledWith({
      where: { id: PRODUCT },
      select: {
        id: true,
        status: true,
        moderationStatus: true,
        seller: { select: { userId: true, status: true, acceptsCollaborations: true } },
      },
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("visible: se publica sin marca de colaboración (aunque llegue la casilla) y sin avisos", async () => {
    db.product.findUnique.mockResolvedValue(mine());

    await expect(createPostAction({}, form(PRODUCT, { collaboration: true }))).rejects.toThrow(
      `REDIRECT /p/${POST}`,
    );
    expect(created()).toMatchObject({ productId: PRODUCT, collaboration: false });
    expect(notifyProductTagged).not.toHaveBeenCalled();
  });

  it("un producto que ya no existe no se etiqueta", async () => {
    db.product.findUnique.mockResolvedValue(null);

    await expect(createPostAction({}, form(PRODUCT))).resolves.toEqual({
      error: "Ese producto ya no existe.",
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });
});

describe("createPostAction con el producto de otra tienda (ADR-063)", () => {
  it("la tienda acepta colaboraciones: se publica y la tienda recibe un aviso", async () => {
    db.product.findUnique.mockResolvedValue(theirs());

    await expect(createPostAction({}, form(PRODUCT))).rejects.toThrow(`REDIRECT /p/${POST}`);
    expect(created()).toMatchObject({ productId: PRODUCT, collaboration: false });
    expect(notifyProductTagged).toHaveBeenCalledWith({
      recipientId: STORE,
      actorId: VIEWER,
      postId: POST,
    });
  });

  it("con un acuerdo declarado queda marcada como colaboración", async () => {
    db.product.findUnique.mockResolvedValue(theirs());

    await expect(createPostAction({}, form(PRODUCT, { collaboration: true }))).rejects.toThrow(
      `REDIRECT /p/${POST}`,
    );
    expect(created()).toMatchObject({ productId: PRODUCT, collaboration: true });
  });

  it("la tienda no las aceptó: nadie promociona sus productos sin permiso", async () => {
    db.product.findUnique.mockResolvedValue(
      theirs({ seller: { userId: STORE, status: "ACTIVE", acceptsCollaborations: false } }),
    );

    await expect(createPostAction({}, form(PRODUCT))).resolves.toEqual({
      error: "Esa tienda no acepta colaboraciones.",
    });
    expect(db.post.create).not.toHaveBeenCalled();
    expect(notifyProductTagged).not.toHaveBeenCalled();
  });

  it("pausado, agotado u oculto: ya no está disponible para etiquetarse", async () => {
    for (const product of [
      theirs({ status: "PAUSED" }),
      theirs({ status: "SOLD_OUT" }),
      theirs({ moderationStatus: "HIDDEN" }),
    ]) {
      db.product.findUnique.mockResolvedValue(product);
      await expect(createPostAction({}, form(PRODUCT))).resolves.toEqual({
        error: "Ese producto ya no está disponible para etiquetarse.",
      });
    }
    expect(db.post.create).not.toHaveBeenCalled();
  });
});
