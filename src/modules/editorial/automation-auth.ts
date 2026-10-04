import "server-only";
import { createHash } from "node:crypto";
import { db } from "@/server/db";
import { EDITORIAL_TOKEN_PREFIX } from "./automation-schema";

/** Una credencial aleatoria de 256 bits, revocable, con el rol ADMIN leído en cada petición. */
export async function editorialActor(request: Request) {
  const bearer = request.headers.get("Authorization");
  if (!bearer?.startsWith(`Bearer ${EDITORIAL_TOKEN_PREFIX}`)) return null;
  const token = bearer.slice(7);
  if (!new RegExp(`^${EDITORIAL_TOKEN_PREFIX}[A-Za-z0-9_-]{43}$`).test(token)) return null;
  const credential = await db.editorialAutomationToken.findUnique({
    where: { tokenHash: createHash("sha256").update(token).digest("hex") },
    select: {
      id: true,
      userId: true,
      revokedAt: true,
      user: { select: { profile: { select: { role: true, isEditorial: true } } } },
    },
  });
  if (
    !credential ||
    credential.revokedAt ||
    credential.user.profile?.role !== "ADMIN" ||
    credential.user.profile.isEditorial
  )
    return null;
  return { userId: credential.userId, credentialId: credential.id };
}
