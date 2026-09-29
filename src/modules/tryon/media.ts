import type { Prisma } from "@/generated/prisma/client";

/**
 * Fotos de Pruébatelo (ADR-045): la foto de la persona (`try_on_photos`) y cada resultado
 * (`try_on_results.resultMediaId`). Nunca son públicas, ni el equipo las ve (`/media` solo se las
 * sirve a su dueña o dueño), nunca se adjuntan a una publicación ni a un producto (validación y
 * trigger `reject_proof_media_link`) y el recolector de huérfanas no las borra: tienen su propia
 * fecha de borrado. Sin `server-only` ni `@/server/db`: recibe el cliente.
 */
type TryOnClient = Pick<Prisma.TransactionClient, "tryOnPhoto" | "tryOnResult">;

export async function isTryOnMedia(client: TryOnClient, mediaId: string): Promise<boolean> {
  const [photo, result] = await Promise.all([
    client.tryOnPhoto.findUnique({ where: { mediaId }, select: { id: true } }),
    client.tryOnResult.findUnique({ where: { resultMediaId: mediaId }, select: { id: true } }),
  ]);
  return photo !== null || result !== null;
}

/** El trigger `private_media_link` rechazó adjuntar una foto de Pruébatelo. */
export function isPrivateMediaLinkError(error: unknown): boolean {
  return (
    error instanceof Error &&
    "code" in error &&
    (error as { code?: string }).code === "P2010" &&
    error.message.includes("private_media_link")
  );
}
