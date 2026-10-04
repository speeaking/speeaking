import "server-only";
import { db } from "@/server/db";
import { Prisma } from "@/generated/prisma/client";
import type { ContactDTO, FriendshipState, PeopleTab } from "./types";

const PAGE_SIZE = 30;
const personSelect = {
  id: true,
  profile: { select: { username: true, displayName: true, avatarUrl: true } },
} as const;
type Person = {
  id: string;
  profile: { username: string; displayName: string; avatarUrl: string | null } | null;
};
const myPairs = (userId: string) => ({ OR: [{ userAId: userId }, { userBId: userId }] });

/** Relaciones propias junto a la identidad pública; sin sesión no consulta relaciones privadas. */
export async function hydrateContacts(
  viewerId: string | null,
  people: Person[],
): Promise<ContactDTO[]> {
  const ids = people.map((person) => person.id);
  if (!ids.length) return [];
  if (!viewerId)
    return people.flatMap((person) =>
      person.profile
        ? [
            {
              userId: person.id,
              ...person.profile,
              friendship: "none" as const,
              viewerFollows: false,
            },
          ]
        : [],
    );
  const [pairs, follows, blocks] = await Promise.all([
    db.friendship.findMany({
      where: {
        OR: [
          { userAId: viewerId, userBId: { in: ids } },
          { userBId: viewerId, userAId: { in: ids } },
        ],
      },
      select: { userAId: true, userBId: true, requesterId: true, status: true },
    }),
    db.follow.findMany({
      where: { followerId: viewerId, followingId: { in: ids } },
      select: { followingId: true },
    }),
    db.messageBlock.findMany({
      where: {
        OR: [
          { blockerId: viewerId, blockedId: { in: ids } },
          { blockedId: viewerId, blockerId: { in: ids } },
        ],
      },
      select: { blockerId: true, blockedId: true },
    }),
  ]);
  const states = new Map<string, FriendshipState>(
    pairs.map((pair) => [
      pair.userAId === viewerId ? pair.userBId : pair.userAId,
      pair.status === "ACCEPTED"
        ? "friends"
        : pair.requesterId === viewerId
          ? "outgoing"
          : "incoming",
    ]),
  );
  for (const block of blocks)
    states.set(block.blockerId === viewerId ? block.blockedId : block.blockerId, "unavailable");
  const followed = new Set(follows.map((row) => row.followingId));
  return people.flatMap((person) =>
    person.profile
      ? [
          {
            userId: person.id,
            ...person.profile,
            friendship: person.id === viewerId ? "self" : (states.get(person.id) ?? "none"),
            viewerFollows: followed.has(person.id),
          },
        ]
      : [],
  );
}

export async function peopleCounts(userId: string, sellerId: string | null) {
  const [amigos, solicitudes, enviadas, seguidores, siguiendo, buyers] = await Promise.all([
    db.friendship.count({ where: { ...myPairs(userId), status: "ACCEPTED" } }),
    db.friendship.count({
      where: { ...myPairs(userId), status: "PENDING", requesterId: { not: userId } },
    }),
    db.friendship.count({ where: { ...myPairs(userId), status: "PENDING", requesterId: userId } }),
    db.follow.count({ where: { followingId: userId } }),
    db.follow.count({ where: { followerId: userId } }),
    sellerId
      ? db.$queryRaw<{ count: number }[]>(Prisma.sql`
      SELECT COUNT(DISTINCT "buyerId")::int AS count FROM "orders"
      WHERE "sellerId" = ${sellerId}::uuid AND "status" IN ('PAID', 'SHIPPED', 'DELIVERED')`)
      : [],
  ]);
  return {
    amigos,
    solicitudes,
    enviadas,
    seguidores,
    siguiendo,
    compradores: buyers[0]?.count ?? 0,
  };
}

/** Compradores solo de la tienda de la sesión; nunca devuelve correo, dirección ni datos de pago. */
export async function listContacts(
  userId: string,
  sellerId: string | null,
  tab: PeopleTab,
  page: number,
) {
  const batch = { skip: page * PAGE_SIZE, take: PAGE_SIZE + 1 };
  let people: Person[];
  let purchases = new Map<string, number>();
  if (tab === "compradores") {
    if (!sellerId) return { people: [], hasMore: false };
    const rows = await db.order.groupBy({
      by: ["buyerId"],
      where: { sellerId, status: { in: ["PAID", "SHIPPED", "DELIVERED"] } },
      _count: { id: true },
      _max: { paidAt: true },
      orderBy: [{ _max: { paidAt: "desc" } }, { buyerId: "asc" }],
      ...batch,
    });
    purchases = new Map(rows.map((row) => [row.buyerId, row._count.id]));
    const users = await db.user.findMany({
      where: { id: { in: rows.map((row) => row.buyerId) } },
      select: personSelect,
    });
    const byId = new Map(users.map((person) => [person.id, person]));
    people = rows.flatMap((row) => (byId.has(row.buyerId) ? [byId.get(row.buyerId)!] : []));
  } else if (tab === "seguidores" || tab === "siguiendo") {
    const followers = tab === "seguidores";
    const rows = await db.follow.findMany({
      where: followers ? { followingId: userId } : { followerId: userId },
      orderBy: [{ createdAt: "desc" }, { followerId: "asc" }, { followingId: "asc" }],
      ...batch,
      select: { follower: { select: personSelect }, following: { select: personSelect } },
    });
    people = rows.map((row) => (followers ? row.follower : row.following));
  } else {
    const rows = await db.friendship.findMany({
      where: {
        ...myPairs(userId),
        status: tab === "amigos" ? "ACCEPTED" : "PENDING",
        ...(tab === "solicitudes"
          ? { requesterId: { not: userId } }
          : tab === "enviadas"
            ? { requesterId: userId }
            : {}),
      },
      orderBy: [{ createdAt: "desc" }, { userAId: "asc" }, { userBId: "asc" }],
      ...batch,
      select: { userAId: true, userA: { select: personSelect }, userB: { select: personSelect } },
    });
    people = rows.map((row) => (row.userAId === userId ? row.userB : row.userA));
  }
  const hydrated = await hydrateContacts(userId, people.slice(0, PAGE_SIZE));
  return {
    people: hydrated.map((person) => ({
      ...person,
      ...(purchases.has(person.userId) ? { orders: purchases.get(person.userId) } : {}),
    })),
    hasMore: people.length > PAGE_SIZE,
  };
}

export async function findPeople(userId: string, query: string) {
  if (!query.trim()) return [];
  const rows = await db.user.findMany({
    where: {
      id: { not: userId },
      profile: {
        onboardedAt: { not: null },
        isEditorial: false,
        OR: [
          { username: { contains: query, mode: "insensitive" } },
          { displayName: { contains: query, mode: "insensitive" } },
        ],
      },
    },
    take: 20,
    orderBy: { id: "desc" },
    select: personSelect,
  });
  return hydrateContacts(userId, rows);
}
