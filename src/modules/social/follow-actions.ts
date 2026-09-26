"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { track } from "@/modules/analytics/track";
import { getViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { checkSocialLimit } from "./limits";

const targetSchema = z.uuid();
const followSchema = z.boolean().optional();

export type FollowResult =
  { ok: true; following: boolean } | { ok: false; error: string; needsAuth?: boolean };

const CANNOT_FOLLOW = { ok: false, error: "No es posible seguir a esta cuenta." } as const;

/**
 * Seguir o dejar de seguir a alguien. Sin `follow` alterna; con `follow` deja ese estado
 * (idempotente: un botón desactualizado no deja de seguir por error). Una cuenta que no existe
 * responde con un error amable, no con una excepción.
 */
export async function toggleFollowAction(
  targetUserId: string,
  follow?: boolean,
): Promise<FollowResult> {
  const viewer = await getViewer();
  if (!viewer) {
    return { ok: false, error: "Inicia sesión para seguir a otras personas.", needsAuth: true };
  }
  const parsed = targetSchema.safeParse(targetUserId);
  // Los argumentos de una acción llegan del cliente: `follow` debe ser booleano (o no venir).
  if (!parsed.success || parsed.data === viewer.userId || !followSchema.safeParse(follow).success) {
    return CANNOT_FOLLOW;
  }
  const limited = await checkSocialLimit("follow", viewer.userId);
  if (!limited.ok) return { ok: false, error: limited.error };

  const key = { followerId: viewer.userId, followingId: parsed.data };
  let following: boolean;
  let changed = false;
  try {
    const [target, existing] = await Promise.all([
      db.user.findUnique({ where: { id: parsed.data }, select: { id: true } }),
      db.follow.findUnique({
        where: { followerId_followingId: key },
        select: { followerId: true },
      }),
    ]);
    if (!target) return CANNOT_FOLLOW;

    following = follow ?? !existing;
    if (!following && existing) {
      changed = (await db.follow.deleteMany({ where: key })).count > 0;
    } else if (following && !existing) {
      changed = (await db.follow.createMany({ data: [key], skipDuplicates: true })).count > 0;
      if (changed) {
        track({
          type: "FOLLOW",
          userId: viewer.userId,
          entityType: "PROFILE",
          entityId: parsed.data,
          surface: "PROFILE",
        });
      }
    }
  } catch (error) {
    // La cuenta se borró entre la consulta y el alta (llave foránea).
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2003") {
      return CANNOT_FOLLOW;
    }
    return { ok: false, error: "No pudimos actualizar a quién sigues. Intenta de nuevo." };
  }

  // Seguir cambia el perfil (seguidores), «Siguiendo» del feed y «Gente de tus comunidades» en la
  // columna derecha: se revalida todo el layout social. Solo si algo cambió: repetir el mismo estado
  // en bucle no obliga a volver a renderizar todo (SEC-15).
  if (changed) revalidatePath("/(social)", "layout");
  return { ok: true, following };
}
