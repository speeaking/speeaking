"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getViewer } from "@/modules/identity/session";
import { limitOrError, rateLimit, rateLimitKey } from "@/server/rate-limit";
import { changeFriendship, friendshipWith } from "./service";
import type { FriendshipCommand, FriendshipState } from "./types";

const commandSchema = z.object({
  targetId: z.uuid(),
  command: z.enum(["request", "accept", "decline", "cancel", "remove"]),
});
export type FriendshipResult =
  { ok: true; state: FriendshipState } | { ok: false; error: string; needsAuth?: boolean };

export async function friendshipAction(
  targetId: string,
  command: FriendshipCommand,
): Promise<FriendshipResult> {
  const parsed = commandSchema.safeParse({ targetId, command });
  if (!parsed.success) return { ok: false, error: "Solicitud inválida." };
  const viewer = await getViewer();
  if (!viewer?.profile?.onboarded)
    return { ok: false, error: "Inicia sesión para gestionar tus amistades.", needsAuth: true };
  if (viewer.userId === parsed.data.targetId.toLowerCase())
    return { ok: false, error: "No puedes agregar tu propia cuenta." };
  const limited = limitOrError(
    await rateLimit({
      key: rateLimitKey("friendships.change", "user", viewer.userId)!,
      limit: 40,
      windowSeconds: 3600,
    }),
  );
  if (limited) return { ok: false, error: limited };
  try {
    await changeFriendship(viewer.userId, parsed.data.targetId.toLowerCase(), parsed.data.command);
    const state = await friendshipWith(viewer.userId, parsed.data.targetId.toLowerCase());
    revalidatePath("/(social)", "layout");
    return { ok: true, state };
  } catch {
    return { ok: false, error: "No pudimos actualizar la amistad. Intenta de nuevo." };
  }
}
