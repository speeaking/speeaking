import "server-only";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { deleteAccount } from "@/modules/identity/account-deletion";
import { PLATFORM_ADMIN_EMAIL } from "@/modules/identity/platform-account";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { AdminAuthorizationError, assertAdmin } from "./service";
import { countAdminUsers, findAccountActionHistory, findAdminUsers } from "./user-queries";
import {
  adminUserActionSchema,
  adminUserFiltersSchema,
  isDeletedAccountEmail,
  type AdminUserActionInput,
  type AdminUserFilters,
} from "./user-schemas";

export class AdminUserError extends Error {
  override name = "AdminUserError";
  constructor(public readonly code: "NOT_FOUND" | "PROTECTED" | "DELETED" | "CONFIRMATION") {
    super(code);
  }
}

export type AdminUserRow = {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName: string;
  username: string | null;
  avatarUrl: string | null;
  createdAt: string;
  status: "active" | "blocked" | "deleted";
  blockedAt: string | null;
  blockedReason: string | null;
  role: "USER" | "ADMIN";
  isEditorial: boolean;
  isSeller: boolean;
  onboarded: boolean;
  isProtected: boolean;
  isSelf: boolean;
  posts: number;
  purchases: number;
  products: number;
  sales: number;
};

export async function getAdminUserDirectory(actorUserId: string, input: AdminUserFilters) {
  await assertAdmin(actorUserId);
  const filters = adminUserFiltersSchema.parse(input);
  const [directory, counts, history] = await Promise.all([
    findAdminUsers(filters),
    countAdminUsers(),
    findAccountActionHistory(),
  ]);
  const users: AdminUserRow[] = directory.rows.map((user) => {
    const deleted = isDeletedAccountEmail(user.email);
    const role = user.profile?.role ?? "USER";
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.profile?.displayName ?? user.name,
      username: user.profile?.username ?? null,
      avatarUrl: user.profile?.avatarUrl ?? null,
      createdAt: user.createdAt.toISOString(),
      status: deleted ? "deleted" : user.accountRestriction ? "blocked" : "active",
      blockedAt: user.accountRestriction?.blockedAt.toISOString() ?? null,
      blockedReason: user.accountRestriction?.reason ?? null,
      role,
      isEditorial: user.profile?.isEditorial ?? false,
      isSeller: user.sellerProfile !== null,
      onboarded: user.profile?.onboardedAt != null,
      isProtected:
        user.id === actorUserId ||
        role === "ADMIN" ||
        user.email.toLowerCase() === PLATFORM_ADMIN_EMAIL,
      isSelf: user.id === actorUserId,
      posts: user._count.posts,
      purchases: user._count.orders,
      products: user.sellerProfile?._count.products ?? 0,
      sales: user.sellerProfile?._count.orders ?? 0,
    };
  });
  return {
    users,
    total: directory.total,
    pages: directory.pages,
    page: directory.page,
    counts,
    history: history.map((entry) => {
      const target = z.object({ userId: z.uuid() }).safeParse(entry.newValue);
      return {
        id: entry.id,
        title: entry.title,
        reason: entry.reason,
        actorName: entry.approvedBy?.name ?? "Administrador anterior",
        targetUserId: target.success ? target.data.userId : null,
        createdAt: entry.createdAt.toISOString(),
      };
    }),
  };
}

/** Orden estable de candados: permisos y protección vuelven a comprobarse dentro de la escritura. */
async function lockAndCheckAccounts(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  userId: string,
) {
  const ids = [actorUserId, userId].sort();
  await tx.$queryRaw`SELECT id FROM users WHERE id = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE`;
  await tx.$queryRaw`
    SELECT id FROM profiles WHERE "userId" = ANY(${ids}::uuid[]) ORDER BY id FOR UPDATE
  `;
  const select = {
    id: true,
    email: true,
    profile: { select: { role: true } },
    accountRestriction: { select: { blockedAt: true } },
  } as const;
  const [actor, target] = await Promise.all([
    tx.user.findUnique({ where: { id: actorUserId }, select }),
    tx.user.findUnique({ where: { id: userId }, select }),
  ]);
  if (actor?.profile?.role !== "ADMIN" || actor.accountRestriction) {
    throw new AdminAuthorizationError();
  }
  if (!target) throw new AdminUserError("NOT_FOUND");
  if (
    target.id === actorUserId ||
    target.profile?.role === "ADMIN" ||
    target.email.toLowerCase() === PLATFORM_ADMIN_EMAIL
  ) {
    throw new AdminUserError("PROTECTED");
  }
  if (isDeletedAccountEmail(target.email)) throw new AdminUserError("DELETED");
  return target;
}

async function recordAccountAction(
  tx: Prisma.TransactionClient,
  actorUserId: string,
  input: AdminUserActionInput,
  previousAccess: "active" | "blocked",
  now: Date,
) {
  const titles = {
    block: "Cuenta bloqueada",
    unblock: "Cuenta desbloqueada",
    delete: "Cuenta eliminada",
  };
  await tx.platformDecision.create({
    data: {
      actor: "HUMAN",
      kind: `moderation.account.${input.action}`,
      title: titles[input.action],
      hypothesis: "Administración de una cuenta por el equipo de speeaking.",
      riskLevel: input.action === "delete" ? "HIGH" : "MEDIUM",
      status: "APPLIED",
      approvedById: actorUserId,
      reason: input.reason,
      // Sin duplicar correo, nombre, foto ni datos de pedidos en la bitácora.
      previousValue: { userId: input.userId, access: previousAccess },
      newValue: {
        userId: input.userId,
        access:
          input.action === "block" ? "blocked" : input.action === "delete" ? "deleted" : "active",
      },
      decidedAt: now,
      appliedAt: now,
    },
  });
}

export async function applyAdminUserAction(actorUserId: string, rawInput: AdminUserActionInput) {
  await assertAdmin(actorUserId);
  const input = adminUserActionSchema.parse(rawInput);
  const now = new Date();
  if (input.action === "delete") {
    const deletion = await deleteAccount(db, getStorage(), input.userId, async (tx) => {
      const target = await lockAndCheckAccounts(tx, actorUserId, input.userId);
      if (input.confirmationEmail !== target.email.toLowerCase())
        throw new AdminUserError("CONFIRMATION");
      await recordAccountAction(
        tx,
        actorUserId,
        input,
        target.accountRestriction ? "blocked" : "active",
        now,
      );
    });
    return { action: input.action, changed: true, deletionMode: deletion.mode };
  }
  return db.$transaction(async (tx) => {
    const target = await lockAndCheckAccounts(tx, actorUserId, input.userId);
    const blocked = target.accountRestriction !== null;
    if (input.action === "block") {
      if (blocked) return { action: input.action, changed: false };
      await tx.accountRestriction.create({
        data: {
          userId: input.userId,
          reason: input.reason,
          blockedById: actorUserId,
          blockedAt: now,
        },
      });
      await tx.session.deleteMany({ where: { userId: input.userId } });
    } else {
      if (!blocked) return { action: input.action, changed: false };
      await tx.accountRestriction.delete({ where: { userId: input.userId } });
      // El desbloqueo exige entrar otra vez; nunca recupera sesiones anteriores.
      await tx.session.deleteMany({ where: { userId: input.userId } });
    }
    await recordAccountAction(tx, actorUserId, input, blocked ? "blocked" : "active", now);
    return { action: input.action, changed: true };
  });
}
