import "server-only";
import { randomUUID } from "node:crypto";
import type { Prisma } from "@/generated/prisma/client";
import { db } from "@/server/db";
import type { CommunityCommand, CommunityDetails } from "./schemas";

export class CommunityError extends Error {}

/** Todos los cambios de miembros y roles comparten este bloqueo, incluida la salida voluntaria. */
export async function lockCommunity(tx: Prisma.TransactionClient, communityId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT id FROM communities WHERE id = ${communityId}::uuid FOR UPDATE
  `;
  if (!rows.length) throw new CommunityError("Esa comunidad ya no existe.");
  return tx.community.findUniqueOrThrow({
    where: { id: communityId },
    select: { id: true, slug: true, ownerId: true, isOfficial: true },
  });
}

export async function requireCommunityManager(
  tx: Prisma.TransactionClient,
  community: { id: string; ownerId: string | null },
  actorId: string,
) {
  const owner = community.ownerId === actorId;
  const membership = await tx.communityMembership.findUnique({
    where: { userId_communityId: { userId: actorId, communityId: community.id } },
    select: { role: true },
  });
  if (!owner && (community.ownerId === null || membership?.role !== "ADMIN")) {
    throw new CommunityError("No tienes permiso para administrar esta comunidad.");
  }
  return { owner };
}

export async function createCommunity(actorId: string, details: CommunityDetails) {
  return db.$transaction(async (tx) => {
    // Serializa las creaciones de una misma cuenta para que el máximo no se pueda eludir.
    await tx.$queryRaw`SELECT id FROM users WHERE id = ${actorId}::uuid FOR UPDATE`;
    if ((await tx.community.count({ where: { ownerId: actorId } })) >= 10) {
      throw new CommunityError("Puedes ser propietario de hasta 10 comunidades.");
    }
    const base =
      details.name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 48)
        .replace(/-+$/g, "") || "grupo";
    return tx.community.create({
      data: {
        ...details,
        slug: `${base}-${randomUUID().slice(0, 8)}`,
        isOfficial: false,
        sortOrder: 1000,
        ownerId: actorId,
        memberCount: 1,
        memberships: { create: { userId: actorId, role: "ADMIN" } },
      },
      select: { slug: true },
    });
  });
}

export async function manageCommunity(
  actorId: string,
  input: { communityId: string; command: CommunityCommand; targetId?: string; username?: string },
) {
  return db.$transaction(async (tx) => {
    if (input.command === "transfer" && input.targetId) {
      // Mismo orden usuario → comunidad que crear/borrar; serializa el cupo del destinatario.
      await tx.$queryRaw`SELECT id FROM users WHERE id = ${input.targetId}::uuid FOR UPDATE`;
    }
    const community = await lockCommunity(tx, input.communityId);
    const { owner } = await requireCommunityManager(tx, community, actorId);
    const ownersOnly = ["promote", "demote", "transfer"];
    if (ownersOnly.includes(input.command) && !owner) {
      throw new CommunityError(
        "Solo el propietario puede cambiar administradores o transferir la comunidad.",
      );
    }

    let targetId = input.targetId;
    if (input.command === "invite") {
      const profile = await tx.profile.findFirst({
        where: {
          username: input.username,
          onboardedAt: { not: null },
          isEditorial: false,
          user: {
            messageBlocksMade: { none: { blockedId: actorId } },
            messageBlocksReceived: { none: { blockerId: actorId } },
          },
        },
        select: { userId: true },
      });
      if (!profile)
        throw new CommunityError("No encontramos una cuenta disponible con ese @usuario.");
      targetId = profile.userId;
    }
    if (!targetId) throw new CommunityError("Elige una persona.");
    if (targetId === community.ownerId)
      throw new CommunityError("No puedes retirar ni cambiar el rol del propietario.");
    if (targetId === actorId)
      throw new CommunityError(
        "Usa «Salir» para dejar el grupo o transfiere primero la propiedad.",
      );
    const key = { userId: targetId, communityId: community.id };
    const membership = await tx.communityMembership.findUnique({
      where: { userId_communityId: key },
      select: { role: true },
    });

    switch (input.command) {
      case "invite": {
        if (membership) throw new CommunityError("Esa persona ya es miembro.");
        const exists = await tx.communityInvitation.findUnique({
          where: { userId_communityId: key },
        });
        if (exists) return "Esa persona ya tiene una invitación pendiente.";
        // Cuenta y grupo se validan dentro de la misma transacción; el aviso no concede membresía.
        await tx.communityInvitation.create({ data: { ...key, invitedById: actorId } });
        await tx.notification.upsert({
          where: { dedupeKey: `community-invite:${community.id}:${targetId}` },
          create: {
            communityId: community.id,
            recipientId: targetId,
            actorId,
            type: "COMMUNITY_INVITE",
            dedupeKey: `community-invite:${community.id}:${targetId}`,
          },
          update: { actorId, createdAt: new Date(), readAt: null },
        });
        return "Invitación enviada. La persona decide si se une.";
      }
      case "cancelInvite":
        await tx.communityInvitation.deleteMany({ where: key });
        await tx.notification.deleteMany({
          where: { communityId: community.id, recipientId: targetId, type: "COMMUNITY_INVITE" },
        });
        return "Invitación cancelada.";
      case "restore":
        await tx.communityRemoval.deleteMany({ where: key });
        return "Esta persona puede volver a unirse.";
      case "remove": {
        if (!membership) throw new CommunityError("Esa persona ya no es miembro.");
        if (!owner && membership.role === "ADMIN") {
          throw new CommunityError("Solo el propietario puede retirar a otro administrador.");
        }
        await tx.communityMembership.delete({ where: { userId_communityId: key } });
        await tx.communityRemoval.upsert({
          where: { userId_communityId: key },
          create: key,
          update: { createdAt: new Date() },
        });
        await tx.communityInvitation.deleteMany({ where: key });
        await tx.community.update({
          where: { id: community.id },
          data: { memberCount: { decrement: 1 } },
        });
        return "Miembro retirado. Podrás permitirle volver desde «Retirados».";
      }
      case "promote":
      case "demote":
      case "transfer": {
        if (!membership) throw new CommunityError("Solo puedes elegir a un miembro actual.");
        if (input.command === "transfer") {
          const eligible = await tx.profile.findFirst({
            where: { userId: targetId, onboardedAt: { not: null }, isEditorial: false },
            select: { userId: true },
          });
          if (!eligible) throw new CommunityError("Esa cuenta no puede recibir la propiedad.");
          if ((await tx.community.count({ where: { ownerId: targetId } })) >= 10)
            throw new CommunityError(
              "Esta persona ya administra el máximo de comunidades como propietaria.",
            );
          await tx.community.update({ where: { id: community.id }, data: { ownerId: targetId } });
        }
        await tx.communityMembership.update({
          where: { userId_communityId: key },
          data: { role: input.command === "demote" ? "MEMBER" : "ADMIN" },
        });
        return input.command === "transfer"
          ? "Propiedad transferida. Conservas tu rol de administrador."
          : input.command === "promote"
            ? "Administrador agregado."
            : "La persona vuelve a ser miembro.";
      }
    }
  });
}

export async function respondToInvitation(actorId: string, communityId: string, accept: boolean) {
  return db.$transaction(async (tx) => {
    await lockCommunity(tx, communityId);
    const key = { userId: actorId, communityId };
    const invite = await tx.communityInvitation.findUnique({ where: { userId_communityId: key } });
    if (!invite) throw new CommunityError("Esta invitación ya no está pendiente.");
    if (accept) {
      if (
        invite.invitedById &&
        (await tx.messageBlock.findFirst({
          where: {
            OR: [
              { blockerId: actorId, blockedId: invite.invitedById },
              { blockerId: invite.invitedById, blockedId: actorId },
            ],
          },
          select: { blockerId: true },
        }))
      ) {
        throw new CommunityError("La invitación ya no está disponible.");
      }
      await tx.communityRemoval.deleteMany({ where: key });
      const created = await tx.communityMembership.createMany({
        data: [key],
        skipDuplicates: true,
      });
      if (created.count)
        await tx.community.update({
          where: { id: communityId },
          data: { memberCount: { increment: created.count } },
        });
    }
    await tx.communityInvitation.delete({ where: { userId_communityId: key } });
    await tx.notification.deleteMany({
      where: { communityId, recipientId: actorId, type: "COMMUNITY_INVITE" },
    });
    return accept ? "Ya eres miembro de la comunidad." : "Invitación rechazada.";
  });
}
