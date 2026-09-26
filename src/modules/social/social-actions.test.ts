import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";

const db = vi.hoisted(() => {
  const tx = {
    communityMembership: { findUnique: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    community: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    savedItem: { deleteMany: vi.fn(), create: vi.fn() },
    post: { update: vi.fn() },
    product: { update: vi.fn() },
    like: { deleteMany: vi.fn(), create: vi.fn() },
  };
  return {
    tx,
    user: { findUnique: vi.fn() },
    follow: { findUnique: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    comment: { findFirst: vi.fn(), create: vi.fn() },
    post: { update: vi.fn() },
    $transaction: vi.fn(async (run: (client: typeof tx) => unknown) => run(tx)),
  };
});
const revalidatePath = vi.hoisted(() => vi.fn());
const getViewer = vi.hoisted(() => vi.fn());
const requireOnboardedViewer = vi.hoisted(() => vi.fn());
const checkSocialLimit = vi.hoisted(() => vi.fn());
const track = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath, refresh: vi.fn() }));
vi.mock("@/modules/identity/session", () => ({ getViewer, requireOnboardedViewer }));
vi.mock("@/modules/analytics/track", () => ({ track }));
vi.mock("./limits", () => ({ checkSocialLimit }));

const { toggleFollowAction } = await import("./follow-actions");
const { toggleMembershipAction } = await import("./community-actions");
const { createCommentAction, createPostAction, toggleLikeAction, toggleSaveAction } =
  await import("./actions");
const { recordShareAction } = await import("./interaction-actions");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const OTHER = "0199a000-0000-7000-8000-00000000000b";
const TARGET = "0199a000-0000-7000-8000-0000000000c1";

function prismaError(code: string) {
  return new Prisma.PrismaClientKnownRequestError(`error ${code}`, {
    code,
    clientVersion: "test",
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  getViewer.mockResolvedValue({ userId: VIEWER });
  db.follow.createMany.mockResolvedValue({ count: 1 });
  db.tx.communityMembership.createMany.mockResolvedValue({ count: 1 });
  checkSocialLimit.mockResolvedValue({ ok: true });
});

const LIMITED = {
  ok: false,
  error: "Demasiados intentos. Intenta de nuevo en 12 minutos.",
  retryAfterSeconds: 700,
} as const;

function commentForm(body: string) {
  const form = new FormData();
  form.set("postId", TARGET);
  form.set("body", body);
  return form;
}

describe("toggleFollowAction", () => {
  it("una cuenta que no existe da un error amable, no una excepción", async () => {
    db.user.findUnique.mockResolvedValue(null);
    db.follow.findUnique.mockResolvedValue(null);

    await expect(toggleFollowAction(OTHER)).resolves.toEqual({
      ok: false,
      error: "No es posible seguir a esta cuenta.",
    });
    expect(db.follow.createMany).not.toHaveBeenCalled();
  });

  it("si la cuenta se borra justo antes de seguirla, también responde amable", async () => {
    db.user.findUnique.mockResolvedValue({ id: OTHER });
    db.follow.findUnique.mockResolvedValue(null);
    db.follow.createMany.mockRejectedValue(prismaError("P2003"));

    await expect(toggleFollowAction(OTHER)).resolves.toMatchObject({ ok: false });
  });

  it("con un estado explícito es idempotente: seguir a quien ya sigues no lo deja de seguir", async () => {
    db.user.findUnique.mockResolvedValue({ id: OTHER });
    db.follow.findUnique.mockResolvedValue({ followerId: VIEWER });

    await expect(toggleFollowAction(OTHER, true)).resolves.toEqual({ ok: true, following: true });
    expect(db.follow.deleteMany).not.toHaveBeenCalled();
    expect(db.follow.createMany).not.toHaveBeenCalled();
    // Nada cambió: no se vuelve a renderizar todo el layout (SEC-15, llamadas en bucle).
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("dejar de seguir revalida; si otra pestaña ya lo había hecho, no", async () => {
    db.user.findUnique.mockResolvedValue({ id: OTHER });
    db.follow.findUnique.mockResolvedValue({ followerId: VIEWER });
    db.follow.deleteMany.mockResolvedValueOnce({ count: 1 }).mockResolvedValueOnce({ count: 0 });

    await expect(toggleFollowAction(OTHER, false)).resolves.toEqual({ ok: true, following: false });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
    await expect(toggleFollowAction(OTHER, false)).resolves.toEqual({ ok: true, following: false });
    expect(revalidatePath).toHaveBeenCalledTimes(1);
  });

  it("revalida todo el layout social (perfil, feed y «Gente de tus comunidades»)", async () => {
    db.user.findUnique.mockResolvedValue({ id: OTHER });
    db.follow.findUnique.mockResolvedValue(null);

    await expect(toggleFollowAction(OTHER)).resolves.toEqual({ ok: true, following: true });
    expect(revalidatePath).toHaveBeenCalledWith("/(social)", "layout");
  });

  it("un estado que no es booleano (llega del cliente) se rechaza sin tocar la base", async () => {
    await expect(toggleFollowAction(OTHER, "false" as unknown as boolean)).resolves.toMatchObject({
      ok: false,
    });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });

  it("sin sesión pide crear cuenta; a una misma no se puede seguir", async () => {
    getViewer.mockResolvedValueOnce(null);
    await expect(toggleFollowAction(OTHER)).resolves.toMatchObject({ ok: false, needsAuth: true });
    await expect(toggleFollowAction(VIEWER)).resolves.toMatchObject({ ok: false });
    expect(db.user.findUnique).not.toHaveBeenCalled();
  });
});

describe("toggleMembershipAction", () => {
  it("al unirse ajusta el contador y revalida el layout (columna izquierda y derecha)", async () => {
    db.tx.communityMembership.findUnique.mockResolvedValue(null);
    db.tx.communityMembership.createMany.mockResolvedValue({ count: 1 });
    db.tx.community.update.mockResolvedValue({ memberCount: 11 });

    await expect(toggleMembershipAction(TARGET)).resolves.toEqual({
      ok: true,
      active: true,
      count: 11,
    });
    expect(db.tx.community.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { memberCount: { increment: 1 } } }),
    );
    expect(revalidatePath).toHaveBeenCalledWith("/(social)", "layout");
  });

  it("«Deshacer» (join = true) sobre una membresía que ya existe no cuenta doble", async () => {
    db.tx.communityMembership.findUnique.mockResolvedValue({ userId: VIEWER });
    db.tx.community.findUniqueOrThrow.mockResolvedValue({ memberCount: 11 });

    await expect(toggleMembershipAction(TARGET, true)).resolves.toEqual({
      ok: true,
      active: true,
      count: 11,
    });
    expect(db.tx.communityMembership.createMany).not.toHaveBeenCalled();
    expect(db.tx.community.update).not.toHaveBeenCalled();
    // Nada cambió: no se vuelve a renderizar todo el layout (SEC-15, llamadas en bucle).
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("salir resta uno", async () => {
    db.tx.communityMembership.findUnique.mockResolvedValue({ userId: VIEWER });
    db.tx.communityMembership.deleteMany.mockResolvedValue({ count: 1 });
    db.tx.community.update.mockResolvedValue({ memberCount: 10 });

    await expect(toggleMembershipAction(TARGET, false)).resolves.toMatchObject({
      ok: true,
      active: false,
    });
    expect(db.tx.community.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { memberCount: { increment: -1 } } }),
    );
  });

  it("un `join` que no es booleano (llega del cliente) se rechaza sin tocar la base", async () => {
    await expect(toggleMembershipAction(TARGET, "false" as unknown as boolean)).resolves.toEqual({
      ok: false,
      error: "Comunidad inválida.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("una comunidad que no existe da un error amable", async () => {
    db.tx.communityMembership.findUnique.mockResolvedValue(null);
    db.tx.communityMembership.createMany.mockRejectedValue(prismaError("P2003"));

    await expect(toggleMembershipAction(TARGET)).resolves.toEqual({
      ok: false,
      error: "Esa comunidad ya no existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("toggleSaveAction", () => {
  it("solo guarda publicaciones PUBLISHED", async () => {
    db.tx.savedItem.deleteMany.mockResolvedValue({ count: 0 });
    db.tx.post.update.mockRejectedValue(prismaError("P2025"));

    await expect(toggleSaveAction({ postId: TARGET })).resolves.toEqual({
      ok: false,
      error: "Esta publicación ya no está disponible.",
    });
    expect(db.tx.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET, status: "PUBLISHED" } }),
    );
    expect(db.tx.savedItem.create).not.toHaveBeenCalled();
  });

  it("quitar de guardados funciona aunque la publicación ya no esté visible", async () => {
    db.tx.savedItem.deleteMany.mockResolvedValue({ count: 1 });
    db.tx.post.update.mockResolvedValue({ saveCount: 0 });

    await expect(toggleSaveAction({ postId: TARGET })).resolves.toEqual({
      ok: true,
      active: false,
      count: 0,
    });
    expect(db.tx.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET } }),
    );
  });

  it("un destino mal formado (llega del cliente) responde con error, sin excepción", async () => {
    for (const target of [null, {}, { postId: "no-es-uuid" }]) {
      await expect(
        toggleSaveAction(target as unknown as { postId: string }),
      ).resolves.toMatchObject({ ok: false, error: "Elemento inválido." });
    }
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("un producto solo se guarda si tiene página pública", async () => {
    db.tx.savedItem.deleteMany.mockResolvedValue({ count: 0 });
    db.tx.product.update.mockResolvedValue({ saveCount: 3 });

    await expect(toggleSaveAction({ productId: TARGET })).resolves.toMatchObject({
      ok: true,
      active: true,
    });
    expect(db.tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET, status: { in: ["ACTIVE", "PAUSED", "SOLD_OUT"] } },
      }),
    );
  });
});

describe("límites de frecuencia (SEC-15)", () => {
  it("like, guardar, seguir y unirse: con el límite agotado no tocan la base", async () => {
    checkSocialLimit.mockResolvedValue(LIMITED);

    await expect(toggleLikeAction(TARGET)).resolves.toEqual({ ok: false, error: LIMITED.error });
    await expect(toggleSaveAction({ postId: TARGET })).resolves.toEqual({
      ok: false,
      error: LIMITED.error,
    });
    await expect(toggleFollowAction(OTHER)).resolves.toEqual({ ok: false, error: LIMITED.error });
    await expect(toggleMembershipAction(TARGET)).resolves.toEqual({
      ok: false,
      error: LIMITED.error,
    });
    expect(checkSocialLimit.mock.calls.map(([action]) => action)).toEqual([
      "like",
      "save",
      "follow",
      "join",
    ]);
    expect(db.$transaction).not.toHaveBeenCalled();
    expect(db.user.findUnique).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("comentar: con el límite agotado no crea el comentario", async () => {
    getViewer.mockResolvedValue({ userId: VIEWER, profile: { onboarded: true } });
    checkSocialLimit.mockResolvedValue(LIMITED);

    await expect(createCommentAction({}, commentForm("hola"))).resolves.toEqual({
      error: LIMITED.error,
    });
    expect(checkSocialLimit).toHaveBeenCalledWith("comment", VIEWER);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("comentar dos veces seguidas el mismo texto en la misma publicación se rechaza", async () => {
    getViewer.mockResolvedValue({ userId: VIEWER, profile: { onboarded: true } });
    db.comment.findFirst.mockResolvedValue({ body: "¡Qué buena!" });

    await expect(createCommentAction({}, commentForm("  ¡Qué buena!  "))).resolves.toEqual({
      error: "Ya publicaste ese comentario.",
    });
    expect(db.comment.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { postId: TARGET, authorId: VIEWER } }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("publicar: con el límite agotado no consulta ni crea nada", async () => {
    requireOnboardedViewer.mockResolvedValue({ userId: VIEWER });
    checkSocialLimit.mockResolvedValue(LIMITED);
    const form = new FormData();
    form.set("body", "Mi publicación");

    await expect(createPostAction({}, form)).resolves.toEqual({ error: LIMITED.error });
    expect(checkSocialLimit).toHaveBeenCalledWith("post", VIEWER);
  });

  it("compartir sin cuenta cuenta por IP; con el límite agotado no registra el evento", async () => {
    getViewer.mockResolvedValue(null);
    checkSocialLimit.mockResolvedValue(LIMITED);

    await recordShareAction(TARGET, "copy");

    expect(checkSocialLimit).toHaveBeenCalledWith("share", null);
    expect(track).not.toHaveBeenCalled();
  });
});

describe("argumentos que llegan del cliente (SEC-38)", () => {
  it("una superficie desconocida se registra como FEED en lugar de romper el evento", async () => {
    db.tx.post.update.mockResolvedValue({ likeCount: 1 });
    db.tx.like.deleteMany.mockResolvedValue({ count: 0 });

    await expect(
      toggleLikeAction(TARGET, "'; DROP TABLE" as unknown as "FEED"),
    ).resolves.toMatchObject({ ok: true, active: true });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ type: "LIKE", surface: "FEED" }));
  });
});
