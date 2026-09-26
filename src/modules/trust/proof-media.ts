import { Prisma } from "@/generated/prisma/client";

/**
 * Fotos de comprobante de autenticidad (P14, ADR-036): las del comprobante vigente
 * (`authenticity_checks."proofMediaIds"`, índice GIN) y las de envíos anteriores
 * (`authenticity_proof_history`, índice por `mediaId`). Reemplazar un comprobante no las libera
 * (auditoría). Ninguna es pública (`/media` solo se la sirve a su dueño), ninguna se adjunta a una
 * publicación o un producto (esta validación y, como última defensa, el trigger
 * `reject_proof_media_link` de `post_media` y `product_media`) y el recolector de huérfanas no las
 * borra (`media/orphans.ts`).
 *
 * Sin `server-only` ni `@/server/db`: recibe el cliente (la base, o la transacción en curso).
 */
type ProofClient = Pick<Prisma.TransactionClient, "authenticityCheck" | "authenticityProofHistory">;

/**
 * Cuáles de `mediaIds` son (o fueron) fotos de un comprobante. Dos consultas con índice: `&&` sobre
 * el arreglo (GIN) y `IN` sobre la bitácora. En secuencia: también sirve dentro de una transacción.
 */
export async function proofMediaIdsAmong(
  client: ProofClient,
  mediaIds: readonly string[],
): Promise<Set<string>> {
  const ids = [...new Set(mediaIds)];
  if (ids.length === 0) return new Set();
  const current = await client.authenticityCheck.findMany({
    where: { proofMediaIds: { hasSome: ids } },
    select: { proofMediaIds: true },
  });
  const past = await client.authenticityProofHistory.findMany({
    where: { mediaId: { in: ids } },
    distinct: ["mediaId"],
    select: { mediaId: true },
  });
  const wanted = new Set(ids);
  const found = new Set(past.map((row) => row.mediaId));
  for (const row of current) {
    for (const id of row.proofMediaIds) if (wanted.has(id)) found.add(id);
  }
  return found;
}

/** ¿`mediaId` es (o fue) una foto de comprobante? */
export async function isProofMedia(client: ProofClient, mediaId: string): Promise<boolean> {
  return (await proofMediaIdsAmong(client, [mediaId])).size > 0;
}

/**
 * El trigger `reject_proof_media_link` rechazó un adjunto (una carrera con `submitProof` que la
 * validación previa no alcanzó a ver). Quien adjunta responde como a cualquier foto inválida.
 */
export function isProofMediaLinkError(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.message.includes("proof_media_link")
  );
}
