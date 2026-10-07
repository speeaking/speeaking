import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Unirse y salir de comunidades contra la base de desarrollo (`pnpm db:start`): el bloqueo
 * `FOR UPDATE`, los retiros y la propiedad (grupos de usuarios) no rompen el recorrido de siempre en
 * las comunidades oficiales. Crea cuentas `e2e.fix.unirse*@example.com` y dos comunidades, y las
 * borra al final.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});
const viewer = vi.hoisted(() => ({ userId: "" }));

vi.mock("@/server/db", async () => {
  const { createPrismaClient } = await import("@/server/db-client");
  return { db: createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base") };
});
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/modules/identity/session", () => ({ getViewer: vi.fn(async () => viewer) }));
vi.mock("@/modules/analytics/track", () => ({ track: vi.fn() }));
vi.mock("./limits", () => ({ checkSocialLimit: vi.fn(async () => ({ ok: true })) }));

const { db } = await import("@/server/db");
const { toggleMembershipAction } = await import("./community-actions");

const RUN = randomUUID().slice(0, 8);
const ids = { member: "", owner: "", official: "", group: "" };

async function createUser(tag: string) {
  const user = await db.user.create({
    data: { name: `Unirse ${tag}`, email: `e2e.fix.unirse.${RUN}.${tag}@example.com` },
    select: { id: true },
  });
  await db.profile.create({
    data: {
      userId: user.id,
      username: `e2e.fix.unirse.${RUN}.${tag}`,
      displayName: `Unirse ${tag}`,
      onboardedAt: new Date(),
    },
  });
  return user.id;
}

async function createCommunity(tag: string, ownerId: string | null) {
  const community = await db.community.create({
    data: {
      slug: `e2e-fix-unirse-${RUN}-${tag}`,
      name: `Unirse ${tag} ${RUN}`,
      description: "Comunidad de prueba",
      emoji: "🧪",
      isOfficial: ownerId === null,
      ownerId,
      memberCount: ownerId ? 1 : 0,
      ...(ownerId ? { memberships: { create: { userId: ownerId, role: "ADMIN" as const } } } : {}),
    },
    select: { id: true },
  });
  return community.id;
}

const isMember = async (userId: string, communityId: string) =>
  (await db.communityMembership.count({ where: { userId, communityId } })) === 1;

describe.skipIf(!databaseUrl)("unirse a comunidades contra PostgreSQL", () => {
  beforeAll(async () => {
    ids.member = await createUser("miembro");
    ids.owner = await createUser("propietaria");
    ids.official = await createCommunity("oficial", null);
    ids.group = await createCommunity("grupo", ids.owner);
  });

  beforeEach(() => {
    viewer.userId = ids.member;
  });

  afterAll(async () => {
    await db.community.deleteMany({
      where: { id: { in: [ids.official, ids.group].filter(Boolean) } },
    });
    await db.user.deleteMany({ where: { id: { in: [ids.member, ids.owner].filter(Boolean) } } });
    await db.$disconnect();
  });

  it("una comunidad oficial (sin propietario): unirse, repetir y salir ajustan el contador", async () => {
    await expect(toggleMembershipAction(ids.official, true)).resolves.toEqual({
      ok: true,
      active: true,
      count: 1,
    });
    expect(await isMember(ids.member, ids.official)).toBe(true);
    // «Deshacer» sobre una membresía que ya existe no cuenta doble.
    await expect(toggleMembershipAction(ids.official, true)).resolves.toEqual({
      ok: true,
      active: true,
      count: 1,
    });
    await expect(toggleMembershipAction(ids.official)).resolves.toEqual({
      ok: true,
      active: false,
      count: 0,
    });
    expect(await isMember(ids.member, ids.official)).toBe(false);
  });

  it("un grupo de usuarios: se une, la propietaria no sale y a quien retiraron no vuelve solo", async () => {
    await expect(toggleMembershipAction(ids.group)).resolves.toEqual({
      ok: true,
      active: true,
      count: 2,
    });

    viewer.userId = ids.owner;
    await expect(toggleMembershipAction(ids.group, false)).resolves.toEqual({
      ok: false,
      error: "Transfiere la propiedad a otro miembro antes de salir.",
    });
    expect(await isMember(ids.owner, ids.group)).toBe(true);

    // Retirarlo (como lo hace la administración del grupo) y que intente volver por su cuenta.
    viewer.userId = ids.member;
    await expect(toggleMembershipAction(ids.group, false)).resolves.toMatchObject({ ok: true });
    await db.communityRemoval.create({ data: { userId: ids.member, communityId: ids.group } });
    await expect(toggleMembershipAction(ids.group, true)).resolves.toEqual({
      ok: false,
      error: "Tu acceso fue retirado. Un administrador debe permitirte volver o invitarte.",
    });
    expect(await isMember(ids.member, ids.group)).toBe(false);
    expect((await db.community.findUniqueOrThrow({ where: { id: ids.group } })).memberCount).toBe(
      1,
    );
  });

  it("una comunidad que no existe responde amable", async () => {
    await expect(toggleMembershipAction(randomUUID())).resolves.toEqual({
      ok: false,
      error: "Esa comunidad ya no existe.",
    });
  });
});
