import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

/**
 * P14: una foto de comprobante de autenticidad (vigente o reemplazada) nunca se adjunta a un
 * producto. `createProductAction` la excluye al validar las fotos y lo dice con un mensaje claro;
 * si el comprobante se guarda justo entre la validación y el INSERT, el trigger
 * `reject_proof_media_link` lo rechaza y la acción responde igual, sin un error de servidor.
 */
const { db, tx } = vi.hoisted(() => {
  const tx = {
    product: { create: vi.fn() },
    post: { create: vi.fn() },
  };
  return {
    tx,
    db: {
      media: { findMany: vi.fn() },
      category: { findUnique: vi.fn() },
      community: { findUnique: vi.fn() },
      authenticityCheck: { findMany: vi.fn() },
      authenticityProofHistory: { findMany: vi.fn() },
      $transaction: vi.fn((run: (client: typeof tx) => unknown) => run(tx)),
    },
  };
});
const redirect = vi.hoisted(() =>
  vi.fn((url: string) => {
    throw new Error(`REDIRECT ${url}`);
  }),
);

vi.mock("@/server/db", () => ({ db }));
vi.mock("next/navigation", () => ({ redirect }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identity/session", () => ({
  requireOnboardedViewer: vi.fn(async () => ({ userId: SELLER, sellerProfileId: "s-1" })),
}));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
// El límite de altas (SEC-15) se prueba en actions.test; aquí siempre pasa.
vi.mock("./limits", () => ({ checkCatalogLimit: vi.fn(async () => null) }));
vi.mock("@/modules/trust/service", () => ({ evaluateProductAuthenticity: vi.fn() }));
vi.mock("@/modules/trust/background", () => ({ scheduleAuthenticityAiSignal: vi.fn() }));
vi.mock("./service", () => ({
  ProductEditError: class extends Error {},
  updateProduct: vi.fn(),
  setProductStatus: vi.fn(),
}));

const { createProductAction } = await import("./actions");

const SELLER = "0199a000-0000-7000-8000-00000000000a";
const CATEGORY = "0199a000-0000-7000-8000-0000000000c1";
const PHOTO = "0199a000-0000-7000-8000-0000000000f1";
const PROOF = "0199a000-0000-7000-8000-0000000000f2";
const PROOF_MESSAGE =
  "Esa foto no se puede usar en un producto: es un comprobante de autenticidad. Elige otra.";

function form(mediaIds: string[]) {
  const values: Record<string, string> = {
    title: "Tenis Jordan 1 Retro",
    description: "Tenis nuevos en su caja, talla 27 MX.",
    price: "2,500",
    cost: "1,800",
    stock: "2",
    categoryId: CATEGORY,
    condition: "NEW",
    tags: "",
    city: "Ciudad de México",
    state: "CDMX",
    localDeliveryZones: "",
    warrantyType: "NONE",
    returnWindowDays: "0",
    authenticity: "DECLARED_ORIGINAL",
  };
  const data = new FormData();
  for (const [key, value] of Object.entries(values)) data.append(key, value);
  for (const id of mediaIds) data.append("mediaIds", id);
  return data;
}

/** Fotos propias y listas que NO están en la bitácora de comprobantes (el filtro de la consulta). */
const notProof = new Set([PHOTO]);

beforeEach(() => {
  vi.clearAllMocks();
  db.media.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.filter((id) => notProof.has(id)).map((id) => ({ id })),
  );
  db.category.findUnique.mockResolvedValue({ id: CATEGORY });
  db.authenticityCheck.findMany.mockResolvedValue([]);
  db.authenticityProofHistory.findMany.mockResolvedValue([]);
  tx.product.create.mockResolvedValue({ id: "0199a000-0000-7000-8000-0000000000aa" });
});

describe("createProductAction con fotos de comprobante (P14)", () => {
  it("la consulta de fotos excluye las que se enviaron como comprobante", async () => {
    await expect(createProductAction({}, form([PHOTO]))).rejects.toThrow(/^REDIRECT \/producto\//);
    expect(db.media.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          ownerId: SELLER,
          status: "READY",
          proofHistory: { none: {} },
        }),
      }),
    );
  });

  it("una foto de comprobante: mensaje claro, sin crear el producto", async () => {
    db.authenticityProofHistory.findMany.mockResolvedValue([{ mediaId: PROOF }]);

    await expect(createProductAction({}, form([PHOTO, PROOF]))).resolves.toEqual({
      error: PROOF_MESSAGE,
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("una foto ajena o que no existe sigue siendo «Alguna foto no es válida.»", async () => {
    const foreign = "0199a000-0000-7000-8000-0000000000f9";
    await expect(createProductAction({}, form([foreign]))).resolves.toEqual({
      error: "Alguna foto no es válida.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("si el trigger la rechaza (carrera con el comprobante), responde igual, sin excepción", async () => {
    tx.product.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Database error. Code: `23514`. Message: `proof_media_link: la foto es un comprobante`",
        { code: "P2039", clientVersion: "test" },
      ),
    );

    await expect(createProductAction({}, form([PHOTO]))).resolves.toEqual({
      error: PROOF_MESSAGE,
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("otros errores de la base no se disfrazan de foto inválida", async () => {
    tx.product.create.mockRejectedValue(new Error("se cayó la conexión"));
    await expect(createProductAction({}, form([PHOTO]))).rejects.toThrow("se cayó la conexión");
  });
});
