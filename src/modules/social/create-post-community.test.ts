import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Publicar en una comunidad (README de `communities`): la fila de la comunidad se bloquea y la
 * autorización se vuelve a comprobar dentro de la misma transacción que crea la publicación. En un
 * grupo creado por usuarios hace falta ser miembro; en las oficiales no. A quien retiraron no
 * publica en ninguna de las dos.
 */
const db = vi.hoisted(() => {
  const client = {
    media: { findMany: vi.fn(async () => []) },
    community: { findUnique: vi.fn(), findUniqueOrThrow: vi.fn() },
    communityMembership: { findUnique: vi.fn() },
    communityRemoval: { findUnique: vi.fn() },
    product: { findUnique: vi.fn() },
    post: { create: vi.fn() },
    authenticityCheck: { findMany: vi.fn(async () => []) },
    authenticityProofHistory: { findMany: vi.fn(async () => []) },
    // `lockCommunity`: SELECT … FOR UPDATE de la fila de la comunidad.
    $queryRaw: vi.fn(),
    $transaction: vi.fn(async (run: (tx: unknown) => unknown) => run(client)),
  };
  return client;
});
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
vi.mock("@/modules/notifications/notify", () => ({
  notifyComment: vi.fn(),
  notifyReaction: vi.fn(),
  removeReactionNotification: vi.fn(),
  notifyProductTagged: vi.fn(),
  notifyMentions: vi.fn(async () => undefined),
}));
vi.mock("./limits", () => ({ checkSocialLimit: vi.fn(async () => ({ ok: true })) }));

const { createPostAction } = await import("./actions");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const OWNER = "0199a000-0000-7000-8000-00000000000b";
const COMMUNITY = "0199a000-0000-7000-8000-0000000000c1";
const POST = "0199a000-0000-7000-8000-0000000000aa";
const KEY = { userId_communityId: { userId: VIEWER, communityId: COMMUNITY } };

function form({ audience }: { audience?: string } = {}) {
  const data = new FormData();
  data.set("body", "¿Alguien sabe dónde venden masa para tamales?");
  data.set("communitySlug", "cocina");
  if (audience) data.set("audience", audience);
  return data;
}

function community(isOfficial: boolean) {
  db.community.findUniqueOrThrow.mockResolvedValue({
    id: COMMUNITY,
    slug: "cocina",
    ownerId: isOfficial ? null : OWNER,
    isOfficial,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  db.community.findUnique.mockResolvedValue({ id: COMMUNITY });
  db.$queryRaw.mockResolvedValue([{ id: COMMUNITY }]);
  db.communityRemoval.findUnique.mockResolvedValue(null);
  db.communityMembership.findUnique.mockResolvedValue(null);
  db.post.create.mockResolvedValue({ id: POST });
});

describe("createPostAction en una comunidad", () => {
  it("oficial: cualquiera con cuenta publica, con la audiencia que eligió", async () => {
    community(true);

    await expect(createPostAction({}, form({ audience: "PUBLIC" }))).rejects.toThrow(
      `REDIRECT /p/${POST}`,
    );
    expect(db.$queryRaw).toHaveBeenCalledTimes(1);
    expect(db.communityMembership.findUnique).not.toHaveBeenCalled();
    expect(db.post.create.mock.calls[0]![0].data).toMatchObject({
      authorId: VIEWER,
      communityId: COMMUNITY,
      audience: "PUBLIC",
    });
  });

  it("grupo de usuarios: sin ser miembro no se publica", async () => {
    community(false);

    await expect(createPostAction({}, form())).resolves.toEqual({
      error: "Únete a esta comunidad antes de publicar en ella.",
    });
    expect(db.communityMembership.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: KEY }),
    );
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("grupo de usuarios: un miembro publica", async () => {
    community(false);
    db.communityMembership.findUnique.mockResolvedValue({ userId: VIEWER });

    await expect(createPostAction({}, form())).rejects.toThrow(`REDIRECT /p/${POST}`);
    expect(db.post.create.mock.calls[0]![0].data).toMatchObject({ communityId: COMMUNITY });
  });

  it("a quien retiraron no publica, tampoco en una oficial", async () => {
    for (const isOfficial of [true, false]) {
      community(isOfficial);
      db.communityRemoval.findUnique.mockResolvedValue({ userId: VIEWER });
      db.communityMembership.findUnique.mockResolvedValue({ userId: VIEWER });

      await expect(createPostAction({}, form())).resolves.toEqual({
        error: "Tu acceso a esta comunidad fue retirado.",
      });
      expect(db.communityRemoval.findUnique).toHaveBeenLastCalledWith(
        expect.objectContaining({ where: KEY }),
      );
    }
    expect(db.post.create).not.toHaveBeenCalled();
  });

  it("si la comunidad se borró antes del bloqueo, responde amable y no publica", async () => {
    db.$queryRaw.mockResolvedValue([]);

    await expect(createPostAction({}, form())).resolves.toEqual({
      error: "Esa comunidad ya no existe.",
    });
    expect(db.post.create).not.toHaveBeenCalled();
  });
});
