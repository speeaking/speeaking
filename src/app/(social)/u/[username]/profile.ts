import "server-only";
import { cache } from "react";
import { db } from "@/server/db";
import { getPublicProfile } from "@/modules/social/queries";

/**
 * El perfil sin lo «en común» con quien mira. Una sola consulta por petición entre el layout, los
 * metadatos y las listas de seguidores y seguidos (`cache`).
 */
export const getProfile = cache((username: string) => getPublicProfile(username, null));

export const getProfileIndexing = cache((username: string) =>
  db.profile.findUnique({
    where: { username: username.toLowerCase() },
    select: { discoverable: true, onboardedAt: true },
  }),
);
