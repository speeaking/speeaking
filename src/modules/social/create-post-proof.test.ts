import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

/**
 * P14: una foto de comprobante de autenticidad (vigente o reemplazada) nunca se publica. La
 * validación de `createPostAction` la rechaza como cualquier foto inválida, y si el comprobante se
 * guarda justo entre la validación y el INSERT, el trigger `reject_proof_media_link` lo rechaza y la
 * acción responde igual (probado contra PostgreSQL en `trust/visibility.db.test.ts`).
 */
const db = vi.hoisted(() => ({
  media: { findMany: vi.fn() },
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
vi.mock("./limits", () => ({ checkSocialLimit: vi.fn(async () => ({ ok: true })) }));

const { createPostAction } = await import("./actions");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const PHOTO = "0199a000-0000-7000-8000-0000000000f1";
const PROOF = "0199a000-0000-7000-8000-0000000000f2";

function form(mediaIds: string[]) {
  const data = new FormData();
  data.set("body", "Mira lo que llegó");
  for (const id of mediaIds) data.append("mediaIds", id);
  return data;
}

beforeEach(() => {
  vi.clearAllMocks();
  db.media.findMany.mockImplementation(async ({ where }: { where: { id: { in: string[] } } }) =>
    where.id.in.map((id) => ({ id })),
  );
  db.authenticityCheck.findMany.mockResolvedValue([]);
  db.authenticityProofHistory.findMany.mockResolvedValue([]);
  db.post.create.mockResolvedValue({ id: "0199a000-0000-7000-8000-0000000000aa" });
});

describe("createPostAction con fotos de comprobante (P14)", () => {
  it("rechaza una foto del comprobante vigente sin crear la publicación", async () => {
    db.authenticityCheck.findMany.mockResolvedValue([{ proofMediaIds: [PROOF] }]);

    await expect(createPostAction({}, form([PHOTO, PROOF]))).resolves.toEqual({
      error: "Alguna imagen no es válida.",
    });
    expect(db.authenticityCheck.findMany).toHaveBeenCalledWith({
      where: { proofMediaIds: { hasSome: [PHOTO, PROOF] } },
      select: { proofMediaIds: true },
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("rechaza una foto de un comprobante ya reemplazado (bitácora)", async () => {
    db.authenticityProofHistory.findMany.mockResolvedValue([{ mediaId: PROOF }]);

    await expect(createPostAction({}, form([PROOF]))).resolves.toEqual({
      error: "Alguna imagen no es válida.",
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("si el trigger la rechaza (carrera con el comprobante), responde igual, sin excepción", async () => {
    db.post.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError(
        "Database error. Code: `23514`. Message: `proof_media_link: la foto es un comprobante`",
        { code: "P2039", clientVersion: "test" },
      ),
    );

    await expect(createPostAction({}, form([PHOTO]))).resolves.toEqual({
      error: "Alguna imagen no es válida.",
    });
    expect(redirect).not.toHaveBeenCalled();
  });

  it("otros errores de la base no se disfrazan de foto inválida", async () => {
    db.post.create.mockRejectedValue(new Error("se cayó la conexión"));

    await expect(createPostAction({}, form([PHOTO]))).rejects.toThrow("se cayó la conexión");
  });

  it("sin comprobantes publica y redirige a la publicación", async () => {
    await expect(createPostAction({}, form([PHOTO]))).rejects.toThrow(
      "REDIRECT /p/0199a000-0000-7000-8000-0000000000aa",
    );
    expect(db.post.create).toHaveBeenCalledOnce();
    expect(redirect).toHaveBeenCalledWith("/p/0199a000-0000-7000-8000-0000000000aa", "push");
  });

  it("desde la ventana encima del feed, la publicación reemplaza a la ventana en el historial (ADR-068)", async () => {
    const data = form([PHOTO]);
    data.set("enCapa", "1");

    await expect(createPostAction({}, data)).rejects.toThrow("REDIRECT /p/");
    expect(redirect).toHaveBeenCalledWith("/p/0199a000-0000-7000-8000-0000000000aa", "replace");
  });
});
