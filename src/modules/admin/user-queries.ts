import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import { ACCOUNT_ACTION_KINDS, ADMIN_USER_PAGE_SIZE, type AdminUserFilters } from "./user-schemas";

const deletedWhere: Prisma.UserWhereInput = {
  AND: [{ email: { startsWith: "eliminada-" } }, { email: { endsWith: "@speeaking.invalid" } }],
};

const userSelect = {
  id: true,
  email: true,
  name: true,
  emailVerified: true,
  createdAt: true,
  profile: {
    select: {
      username: true,
      displayName: true,
      avatarUrl: true,
      role: true,
      isEditorial: true,
      onboardedAt: true,
    },
  },
  accountRestriction: { select: { reason: true, blockedAt: true } },
  sellerProfile: {
    select: { _count: { select: { products: true, orders: true } } },
  },
  _count: { select: { posts: true, orders: true } },
} as const satisfies Prisma.UserSelect;

/** Solo la capa de servicio autorizada llama estas consultas. Nunca devuelve credenciales. */
export async function findAdminUsers(filters: AdminUserFilters) {
  const conditions: Prisma.UserWhereInput[] = [];
  if (filters.q) {
    const search = { contains: filters.q.replace(/^@/, ""), mode: "insensitive" as const };
    conditions.push({
      OR: [
        { name: search },
        { email: search },
        { profile: { is: { OR: [{ username: search }, { displayName: search }] } } },
      ],
    });
  }
  if (filters.status === "deleted") conditions.push(deletedWhere);
  else if (filters.status !== "all") {
    conditions.push({ NOT: deletedWhere });
    conditions.push({
      accountRestriction: filters.status === "blocked" ? { isNot: null } : { is: null },
    });
  }
  if (filters.type === "people") {
    conditions.push({
      OR: [{ profile: { is: null } }, { profile: { is: { isEditorial: false } } }],
    });
  } else if (filters.type === "sellers") conditions.push({ sellerProfile: { isNot: null } });
  else if (filters.type === "admins") conditions.push({ profile: { is: { role: "ADMIN" } } });
  else if (filters.type === "editorial")
    conditions.push({ profile: { is: { isEditorial: true } } });

  const where: Prisma.UserWhereInput = { AND: conditions };
  const total = await db.user.count({ where });
  const pages = Math.max(1, Math.ceil(total / ADMIN_USER_PAGE_SIZE));
  const page = Math.min(filters.page, pages);
  const rows = await db.user.findMany({
    where,
    select: userSelect,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * ADMIN_USER_PAGE_SIZE,
    take: ADMIN_USER_PAGE_SIZE,
  });
  return { rows, total, pages, page };
}

export async function countAdminUsers() {
  const [total, blocked, deleted] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { accountRestriction: { isNot: null }, NOT: deletedWhere } }),
    db.user.count({ where: deletedWhere }),
  ]);
  return { total, blocked, deleted, active: Math.max(0, total - blocked - deleted) };
}

export function findAccountActionHistory() {
  return db.platformDecision.findMany({
    where: { kind: { in: [...ACCOUNT_ACTION_KINDS] }, status: "APPLIED" },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: 15,
    select: {
      id: true,
      kind: true,
      title: true,
      reason: true,
      createdAt: true,
      newValue: true,
      approvedBy: { select: { name: true } },
    },
  });
}
