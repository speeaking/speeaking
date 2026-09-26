import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * P14: un producto oculto por moderación no se promociona en una publicación. El selector de
 * /crear/publicacion ya no lo ofrece; la acción lo rechaza igual (formulario viejo o manipulado) con
 * un mensaje claro, sin crear nada.
 */
const db = vi.hoisted(() => ({
  media: { findMany: vi.fn(async () => []) },
  community: { findUnique: vi.fn() },
  product: { findFirst: vi.fn() },
  post: { create: vi.fn() },
  authenticityCheck: { findMany: vi.fn(async () => []) },
  authenticityProofHistory: { findMany: vi.fn(async () => []) },
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
const PRODUCT = "0199a000-0000-7000-8000-0000000000b1";

function form(productId: string) {
  const data = new FormData();
  data.set("body", "Ya llegaron, pregúntame por tallas");
  data.set("productId", productId);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.post.create.mockResolvedValue({ id: "0199a000-0000-7000-8000-0000000000aa" });
});

describe("createPostAction con un producto oculto por moderación", () => {
  it("lo rechaza con un mensaje claro y no crea la publicación", async () => {
    db.product.findFirst.mockResolvedValue({ id: PRODUCT, moderationStatus: "HIDDEN" });

    await expect(createPostAction({}, form(PRODUCT))).resolves.toEqual({
      error:
        "Ese producto está oculto por moderación y no se puede publicar. Revisa su estado en Studio → Productos.",
    });
    expect(db.product.findFirst).toHaveBeenCalledWith({
      where: { id: PRODUCT, seller: { userId: VIEWER } },
      select: { id: true, moderationStatus: true },
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("un producto propio y visible sí se publica", async () => {
    db.product.findFirst.mockResolvedValue({ id: PRODUCT, moderationStatus: "VISIBLE" });

    await expect(createPostAction({}, form(PRODUCT))).rejects.toThrow(
      "REDIRECT /p/0199a000-0000-7000-8000-0000000000aa",
    );
    expect(db.post.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ productId: PRODUCT }) }),
    );
  });

  it("uno ajeno sigue siendo «Ese producto no es tuyo.»", async () => {
    db.product.findFirst.mockResolvedValue(null);

    await expect(createPostAction({}, form(PRODUCT))).resolves.toEqual({
      error: "Ese producto no es tuyo.",
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });
});
