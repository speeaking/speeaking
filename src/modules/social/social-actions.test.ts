import { beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import type * as CommunitiesService from "@/modules/communities/service";

const db = vi.hoisted(() => {
  const tx = {
    communityMembership: { findUnique: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    community: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    communityRemoval: { findUnique: vi.fn() },
    communityInvitation: { deleteMany: vi.fn() },
    notification: { deleteMany: vi.fn() },
    savedItem: { deleteMany: vi.fn(), create: vi.fn() },
    post: { update: vi.fn(), findUniqueOrThrow: vi.fn() },
    product: { update: vi.fn() },
    like: {
      findUnique: vi.fn(),
      delete: vi.fn(),
      update: vi.fn(),
      create: vi.fn(),
      groupBy: vi.fn(),
    },
  };
  return {
    tx,
    user: { findUnique: vi.fn() },
    follow: { findUnique: vi.fn(), createMany: vi.fn(), deleteMany: vi.fn() },
    comment: { findFirst: vi.fn(), create: vi.fn() },
    post: { update: vi.fn(), findFirst: vi.fn() },
    // Función (transacción interactiva) o arreglo de operaciones (transacción por lotes).
    $transaction: vi.fn(async (run: unknown) =>
      Array.isArray(run) ? Promise.all(run) : (run as (client: typeof tx) => unknown)(tx),
    ),
  };
});
const revalidatePath = vi.hoisted(() => vi.fn());
const getViewer = vi.hoisted(() => vi.fn());
const requireOnboardedViewer = vi.hoisted(() => vi.fn());
const checkSocialLimit = vi.hoisted(() => vi.fn());
const track = vi.hoisted(() => vi.fn());
/** Avisos (ADR-059): se prueban por separado; aquí, que cada acción avise a quien corresponde. */
const notify = vi.hoisted(() => ({
  notifyReaction: vi.fn(),
  removeReactionNotification: vi.fn(),
  notifyComment: vi.fn(),
  notifyMentions: vi.fn(),
  notifyProductTagged: vi.fn(),
  notifyFollow: vi.fn(),
  removeFollowNotification: vi.fn(),
}));
/** El candado de la comunidad es SQL (`FOR UPDATE`): aquí devuelve la comunidad bloqueada. */
const lockCommunity = vi.hoisted(() => vi.fn());

vi.mock("@/server/db", () => ({ db }));
vi.mock("next/cache", () => ({ revalidatePath, refresh: vi.fn() }));
vi.mock("@/modules/identity/session", () => ({ getViewer, requireOnboardedViewer }));
vi.mock("@/modules/analytics/track", () => ({ track }));
vi.mock("./limits", () => ({ checkSocialLimit }));
vi.mock("@/modules/notifications/notify", () => notify);
vi.mock("@/modules/communities/service", async (importActual) => ({
  ...(await importActual<typeof CommunitiesService>()),
  lockCommunity,
}));

const { toggleFollowAction } = await import("./follow-actions");
const { toggleMembershipAction } = await import("./community-actions");
const { createCommentAction, createPostAction, reactAction, toggleSaveAction } =
  await import("./actions");
const { recordShareAction } = await import("./interaction-actions");
const { CommunityError } = await import("@/modules/communities/service");
const { postVisibleTo } = await import("@/modules/relationships/privacy");

const VIEWER = "0199a000-0000-7000-8000-00000000000a";
const OTHER = "0199a000-0000-7000-8000-00000000000b";
const TARGET = "0199a000-0000-7000-8000-0000000000c1";
/** Solo se interactúa con lo publicado que la persona puede ver (docs/post-audience.md). */
const VISIBLE_TO_VIEWER = expect.arrayContaining([postVisibleTo(VIEWER)]);

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
  db.tx.like.groupBy.mockResolvedValue([]);
  lockCommunity.mockResolvedValue({ id: TARGET, slug: "gaming", ownerId: null, isOfficial: true });
  db.tx.communityRemoval.findUnique.mockResolvedValue(null);
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
    // Dejar de seguir quita el aviso de «empezó a seguirte», una sola vez (ADR-059).
    expect(notify.removeFollowNotification).toHaveBeenCalledTimes(1);
    expect(notify.removeFollowNotification).toHaveBeenCalledWith({
      recipientId: OTHER,
      actorId: VIEWER,
    });
  });

  it("revalida todo el layout social (perfil, feed y «Gente de tus comunidades»)", async () => {
    db.user.findUnique.mockResolvedValue({ id: OTHER });
    db.follow.findUnique.mockResolvedValue(null);

    await expect(toggleFollowAction(OTHER)).resolves.toEqual({ ok: true, following: true });
    expect(revalidatePath).toHaveBeenCalledWith("/(social)", "layout");
    expect(notify.notifyFollow).toHaveBeenCalledWith({ recipientId: OTHER, actorId: VIEWER });
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
    // Con la comunidad bloqueada (`FOR UPDATE`) mientras cambia el contador.
    expect(lockCommunity).toHaveBeenCalledWith(db.tx, TARGET);
    // Unirse consume las invitaciones pendientes.
    expect(db.tx.communityInvitation.deleteMany).toHaveBeenCalledWith({
      where: { userId: VIEWER, communityId: TARGET },
    });
    expect(revalidatePath).toHaveBeenCalledWith("/(social)", "layout");
  });

  it("quien la creó no puede salir sin transferir la propiedad", async () => {
    lockCommunity.mockResolvedValue({
      id: TARGET,
      slug: "mia",
      ownerId: VIEWER,
      isOfficial: false,
    });
    db.tx.communityMembership.findUnique.mockResolvedValue({ userId: VIEWER });

    await expect(toggleMembershipAction(TARGET, false)).resolves.toEqual({
      ok: false,
      error: "Transfiere la propiedad a otro miembro antes de salir.",
    });
    expect(db.tx.communityMembership.deleteMany).not.toHaveBeenCalled();
    expect(revalidatePath).not.toHaveBeenCalled();
  });

  it("a quien retiraron no puede volver a unirse por su cuenta", async () => {
    db.tx.communityMembership.findUnique.mockResolvedValue(null);
    db.tx.communityRemoval.findUnique.mockResolvedValue({ userId: VIEWER });

    await expect(toggleMembershipAction(TARGET, true)).resolves.toEqual({
      ok: false,
      error: "Tu acceso fue retirado. Un administrador debe permitirte volver o invitarte.",
    });
    expect(db.tx.communityMembership.createMany).not.toHaveBeenCalled();
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

    lockCommunity.mockRejectedValue(new CommunityError("Esa comunidad ya no existe."));
    await expect(toggleMembershipAction(TARGET)).resolves.toEqual({
      ok: false,
      error: "Esa comunidad ya no existe.",
    });
    expect(revalidatePath).not.toHaveBeenCalled();
  });
});

describe("toggleSaveAction", () => {
  it("solo guarda publicaciones PUBLISHED que la persona puede ver", async () => {
    db.tx.savedItem.deleteMany.mockResolvedValue({ count: 0 });
    db.tx.post.update.mockRejectedValue(prismaError("P2025"));

    await expect(toggleSaveAction({ postId: TARGET })).resolves.toEqual({
      ok: false,
      error: "Esta publicación ya no está disponible.",
    });
    expect(db.tx.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET, status: "PUBLISHED", AND: VISIBLE_TO_VIEWER },
      }),
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

describe("reactAction (ADR-054)", () => {
  const where = { userId_postId: { userId: VIEWER, postId: TARGET } };

  it("reaccionar por primera vez crea la reacción, suma uno y registra LIKE con el tipo", async () => {
    db.tx.like.findUnique.mockResolvedValue(null);
    db.tx.post.update.mockResolvedValue({ likeCount: 4, authorId: OTHER });
    db.tx.like.groupBy.mockResolvedValue([
      { postId: TARGET, kind: "LIKE", _count: { _all: 3 } },
      { postId: TARGET, kind: "HAHA", _count: { _all: 1 } },
    ]);

    await expect(reactAction(TARGET, "HAHA")).resolves.toEqual({
      ok: true,
      kind: "HAHA",
      count: 4,
      top: ["LIKE", "HAHA"],
    });
    expect(db.tx.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET, status: "PUBLISHED", AND: VISIBLE_TO_VIEWER },
        data: { likeCount: { increment: 1 } },
      }),
    );
    expect(db.tx.like.create).toHaveBeenCalledWith({
      data: { userId: VIEWER, postId: TARGET, kind: "HAHA" },
    });
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIKE", metadata: { reaction: "HAHA" } }),
    );
    // Aviso a quien publicó (ADR-059).
    expect(notify.notifyReaction).toHaveBeenCalledWith({
      recipientId: OTHER,
      actorId: VIEWER,
      postId: TARGET,
      reaction: "HAHA",
    });
  });

  it("repetir la misma reacción la quita, resta uno y registra UNLIKE", async () => {
    db.tx.like.findUnique.mockResolvedValue({ kind: "HAHA" });
    db.tx.post.update.mockResolvedValue({ likeCount: 3, authorId: OTHER });

    await expect(reactAction(TARGET, "HAHA")).resolves.toEqual({
      ok: true,
      kind: null,
      count: 3,
      top: [],
    });
    expect(db.tx.like.delete).toHaveBeenCalledWith({ where });
    // Quitar funciona aunque la publicación ya no esté visible (como en guardados).
    expect(db.tx.post.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: TARGET }, data: { likeCount: { decrement: 1 } } }),
    );
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ type: "UNLIKE", metadata: { reaction: "HAHA" } }),
    );
    expect(notify.removeReactionNotification).toHaveBeenCalledWith({
      actorId: VIEWER,
      postId: TARGET,
    });
    expect(notify.notifyReaction).not.toHaveBeenCalled();
  });

  it("sin acceso, quitar la propia reacción funciona pero no dice el total ni el resumen", async () => {
    // ADR-054: la reacción es de quien la puso. Sin acceso (p. ej. tras dejar de ser amigos) se
    // puede quitar, pero la respuesta no revela nada de la publicación: `count: -1` hace que la
    // interfaz conserve lo que ya tenía.
    db.post.findFirst.mockResolvedValueOnce(null);
    db.tx.like.findUnique.mockResolvedValue({ kind: "LIKE" });
    db.tx.post.update.mockResolvedValue({ likeCount: 3, authorId: OTHER });

    await expect(reactAction(TARGET, null)).resolves.toEqual({
      ok: true,
      kind: null,
      count: -1,
      top: [],
    });
    expect(db.tx.like.delete).toHaveBeenCalledWith({ where });
  });

  it("cambiar de reacción actualiza el tipo sin mover el contador y lo dice en el evento", async () => {
    db.tx.like.findUnique.mockResolvedValue({ kind: "LIKE" });
    db.tx.post.findUniqueOrThrow.mockResolvedValue({ likeCount: 5 });

    await expect(reactAction(TARGET, "WOW")).resolves.toMatchObject({
      ok: true,
      kind: "WOW",
      count: 5,
    });
    expect(db.tx.like.update).toHaveBeenCalledWith({ where, data: { kind: "WOW" } });
    expect(db.tx.post.update).not.toHaveBeenCalled();
    expect(track).toHaveBeenCalledWith(
      expect.objectContaining({ type: "LIKE", metadata: { reaction: "WOW", replaced: "LIKE" } }),
    );
  });

  it("quitar (null) sin reacción previa no toca el contador ni registra nada", async () => {
    db.tx.like.findUnique.mockResolvedValue(null);
    db.tx.post.findUniqueOrThrow.mockResolvedValue({ likeCount: 2 });

    await expect(reactAction(TARGET, null)).resolves.toEqual({
      ok: true,
      kind: null,
      count: 2,
      top: [],
    });
    expect(db.tx.post.update).not.toHaveBeenCalled();
    expect(db.tx.like.delete).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("solo se reacciona a publicaciones PUBLISHED que la persona puede ver", async () => {
    db.tx.like.findUnique.mockResolvedValue(null);
    db.tx.post.update.mockRejectedValue(prismaError("P2025"));

    await expect(reactAction(TARGET, "LIKE")).resolves.toEqual({
      ok: false,
      error: "Esta publicación ya no está disponible.",
    });
    expect(db.tx.like.create).not.toHaveBeenCalled();
  });

  it("cambiar la reacción en algo que ya no ve se rechaza (la transacción se deshace)", async () => {
    db.tx.like.findUnique.mockResolvedValue({ kind: "LIKE" });
    db.tx.post.findUniqueOrThrow.mockRejectedValue(prismaError("P2025"));

    await expect(reactAction(TARGET, "WOW")).resolves.toEqual({
      ok: false,
      error: "Esta publicación ya no está disponible.",
    });
    expect(db.tx.post.findUniqueOrThrow).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET, status: "PUBLISHED", AND: VISIBLE_TO_VIEWER },
      }),
    );
    expect(notify.notifyReaction).not.toHaveBeenCalled();
  });

  it("un tipo de reacción desconocido (llega del cliente) se rechaza sin tocar la base", async () => {
    await expect(reactAction(TARGET, "PULGAR" as unknown as "LIKE")).resolves.toEqual({
      ok: false,
      error: "Reacción inválida.",
    });
    expect(db.$transaction).not.toHaveBeenCalled();
  });
});

describe("límites de frecuencia (SEC-15)", () => {
  it("like, guardar, seguir y unirse: con el límite agotado no tocan la base", async () => {
    checkSocialLimit.mockResolvedValue(LIMITED);

    await expect(reactAction(TARGET, "LIKE")).resolves.toEqual({
      ok: false,
      error: LIMITED.error,
    });
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

  it("comentar avisa a quien publicó (ADR-059)", async () => {
    getViewer.mockResolvedValue({ userId: VIEWER, profile: { onboarded: true } });
    db.comment.findFirst.mockResolvedValue(null);
    db.comment.create.mockResolvedValue({ id: "comentario-1" });
    db.post.update.mockResolvedValue({ authorId: OTHER });

    await expect(createCommentAction({}, commentForm("¡Felicidades!"))).resolves.toEqual({
      ok: true,
    });
    expect(notify.notifyComment).toHaveBeenCalledWith({
      recipientId: OTHER,
      actorId: VIEWER,
      postId: TARGET,
      commentId: "comentario-1",
    });
    // Las menciones no le mandan un segundo aviso a quien publicó (docs/social-activity.md).
    expect(notify.notifyMentions).toHaveBeenCalledWith({
      actorId: VIEWER,
      postId: TARGET,
      commentId: "comentario-1",
      body: "¡Felicidades!",
      skipRecipientId: OTHER,
    });
    // Solo se comenta lo que la persona puede ver.
    expect(db.post.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TARGET, status: "PUBLISHED", AND: VISIBLE_TO_VIEWER },
      }),
    );
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
    db.post.findFirst.mockResolvedValue({ id: TARGET });
    checkSocialLimit.mockResolvedValue(LIMITED);

    await recordShareAction(TARGET, "copy");

    expect(checkSocialLimit).toHaveBeenCalledWith("share", null);
    // SEC-15: el límite va antes de cualquier consulta; si no, sin cuenta se podían pedir lecturas
    // a la base sin tope con publicaciones que no existen o no se ven.
    expect(db.post.findFirst).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it("compartir algo que la persona no puede ver no registra nada", async () => {
    getViewer.mockResolvedValue(null);
    db.post.findFirst.mockResolvedValue(null);

    await recordShareAction(TARGET, "native");

    // Sin sesión solo cuenta lo Público.
    expect(db.post.findFirst).toHaveBeenCalledWith({
      where: {
        id: TARGET,
        status: "PUBLISHED",
        AND: expect.arrayContaining([postVisibleTo(null)]),
      },
      select: { id: true },
    });
    expect(track).not.toHaveBeenCalled();
  });
});

describe("argumentos que llegan del cliente (SEC-38)", () => {
  it("una superficie desconocida se registra como FEED en lugar de romper el evento", async () => {
    db.post.findFirst.mockResolvedValueOnce({ id: TARGET });
    db.tx.like.findUnique.mockResolvedValue(null);
    db.tx.post.update.mockResolvedValue({ likeCount: 1 });

    await expect(
      reactAction(TARGET, "LIKE", "'; DROP TABLE" as unknown as "FEED"),
    ).resolves.toMatchObject({ ok: true, kind: "LIKE" });
    expect(track).toHaveBeenCalledWith(expect.objectContaining({ type: "LIKE", surface: "FEED" }));
  });
});
