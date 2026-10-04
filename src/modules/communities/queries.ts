import "server-only";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";

export type MemberTab = "miembros" | "invitaciones" | "retirados";
export type CommunityMember = {
  userId: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  role: "MEMBER" | "ADMIN";
  isOwner: boolean;
};
const profileSelect = { username: true, displayName: true, avatarUrl: true } as const;
export const MEMBER_PAGE_SIZE = 20;

export async function communityMemberPanel(
  communityId: string,
  viewerId: string,
  options: { tab: MemberTab; query: string; page: number },
) {
  const [community, membership] = await Promise.all([
    db.community.findUnique({ where: { id: communityId }, select: { ownerId: true } }),
    db.communityMembership.findUnique({
      where: { userId_communityId: { userId: viewerId, communityId } },
      select: { role: true },
    }),
  ]);
  if (!community || !membership) return null;
  const isOwner = community.ownerId === viewerId;
  const canManage = community.ownerId !== null && (isOwner || membership.role === "ADMIN");
  if (options.tab !== "miembros" && !canManage) return null;
  const filter: Prisma.UserWhereInput = {
    profile: {
      onboardedAt: { not: null },
      ...(options.query
        ? {
            OR: [
              { username: { contains: options.query.replace(/^@/, ""), mode: "insensitive" } },
              { displayName: { contains: options.query, mode: "insensitive" } },
            ],
          }
        : {}),
    },
  };
  const pagination = { skip: options.page * MEMBER_PAGE_SIZE, take: MEMBER_PAGE_SIZE + 1 };
  const rows =
    options.tab === "miembros"
      ? await db.communityMembership.findMany({
          where: { communityId, user: filter },
          orderBy: [{ role: "desc" }, { createdAt: "asc" }, { userId: "asc" }],
          ...pagination,
          select: {
            userId: true,
            role: true,
            user: { select: { profile: { select: profileSelect } } },
          },
        })
      : options.tab === "invitaciones"
        ? await db.communityInvitation.findMany({
            where: { communityId, user: filter },
            orderBy: [{ createdAt: "desc" }, { userId: "asc" }],
            ...pagination,
            select: { userId: true, user: { select: { profile: { select: profileSelect } } } },
          })
        : await db.communityRemoval.findMany({
            where: { communityId, user: filter },
            orderBy: [{ createdAt: "desc" }, { userId: "asc" }],
            ...pagination,
            select: { userId: true, user: { select: { profile: { select: profileSelect } } } },
          });
  const people: CommunityMember[] = rows.slice(0, MEMBER_PAGE_SIZE).flatMap((row) =>
    row.user.profile
      ? [
          {
            ...row.user.profile,
            userId: row.userId,
            role: "role" in row ? row.role : "MEMBER",
            isOwner: row.userId === community.ownerId,
          },
        ]
      : [],
  );
  return { isOwner, canManage, people, hasMore: rows.length > MEMBER_PAGE_SIZE };
}

export function listCommunityInvitations(userId: string) {
  return db.communityInvitation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 20,
    select: { community: { select: { id: true, slug: true, name: true, emoji: true, hue: true } } },
  });
}

export function communityMembersHref(slug: string, tab: MemberTab, query: string, page = 0) {
  const params = new URLSearchParams({ ver: tab });
  if (query) params.set("q", query);
  if (page) params.set("pagina", String(page + 1));
  return `/c/${encodeURIComponent(slug)}/miembros?${params}`;
}
