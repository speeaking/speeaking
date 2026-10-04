"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { track } from "@/modules/analytics/track";
import { getViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { CommunityError, lockCommunity } from "@/modules/communities/service";
import type { ToggleResult } from "./actions";
import { checkSocialLimit } from "./limits";

/**
 * Unirse o salir de una comunidad. Sin `join` alterna; con `join` deja la membresía en ese estado
 * (idempotente: «Deshacer» o un doble toque no la invierten dos veces). El contador de miembros se
 * ajusta en la misma transacción y solo si la membresía cambió de verdad.
 */
export async function toggleMembershipAction(
  communityId: string,
  join?: boolean,
): Promise<ToggleResult> {
  const viewer = await getViewer();
  if (!viewer) return { ok: false, error: "Inicia sesión para unirte.", needsAuth: true };
  // Los argumentos de una acción llegan del cliente: `join` debe ser booleano (o no venir).
  if (!z.uuid().safeParse(communityId).success || !z.boolean().optional().safeParse(join).success) {
    return { ok: false, error: "Comunidad inválida." };
  }
  const limited = await checkSocialLimit("join", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };

  const key = { userId: viewer.userId, communityId };
  let result: { active: boolean; count: number; changed: boolean };
  try {
    result = await db.$transaction(async (tx) => {
      const current = await lockCommunity(tx, communityId);
      const existing = await tx.communityMembership.findUnique({
        where: { userId_communityId: key },
        select: { userId: true },
      });
      const active = join ?? !existing;
      if (!active && current.ownerId === viewer.userId) {
        throw new CommunityError("Transfiere la propiedad a otro miembro antes de salir.");
      }
      if (active && !existing) {
        const removed = await tx.communityRemoval.findUnique({
          where: { userId_communityId: key },
        });
        if (removed)
          throw new CommunityError(
            "Tu acceso fue retirado. Un administrador debe permitirte volver o invitarte.",
          );
      }
      let delta = 0;
      if (active && !existing) {
        const created = await tx.communityMembership.createMany({
          data: [key],
          skipDuplicates: true,
        });
        delta = created.count;
        await tx.communityInvitation.deleteMany({ where: key });
        await tx.notification.deleteMany({
          where: { communityId, recipientId: viewer.userId, type: "COMMUNITY_INVITE" },
        });
      } else if (!active && existing) {
        delta = -(await tx.communityMembership.deleteMany({ where: key })).count;
      }
      const community =
        delta === 0
          ? await tx.community.findUniqueOrThrow({
              where: { id: communityId },
              select: { memberCount: true },
            })
          : await tx.community.update({
              where: { id: communityId },
              data: { memberCount: { increment: delta } },
              select: { memberCount: true },
            });
      return { active, count: community.memberCount, changed: delta !== 0 };
    });
  } catch (error) {
    if (error instanceof CommunityError) return { ok: false, error: error.message };
    // La comunidad no existe (P2025) o la membresía apunta a una que ya no está (P2003).
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      (error.code === "P2025" || error.code === "P2003")
    ) {
      return { ok: false, error: "Esa comunidad ya no existe." };
    }
    return { ok: false, error: "No pudimos actualizar tu membresía. Intenta de nuevo." };
  }

  if (result.active && result.changed) {
    track({
      type: "COMMUNITY_JOIN",
      userId: viewer.userId,
      entityType: "COMMUNITY",
      entityId: communityId,
      surface: "COMMUNITY",
    });
  }
  // Todo el layout social depende de las membresías: «Tus comunidades» y «Para descubrir» (columna
  // izquierda), la columna derecha, la comunidad misma y Descubrir. Solo si cambió (SEC-15).
  if (result.changed) revalidatePath("/(social)", "layout");
  return { ok: true, active: result.active, count: result.count };
}
