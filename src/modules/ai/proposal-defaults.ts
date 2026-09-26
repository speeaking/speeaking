import "server-only";
import { z } from "zod";
import type { ProductFormDefaults } from "@/modules/catalog/components/product-form";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { saleProposalSchema } from "./sale-proposal";

const inputSchema = z.object({
  quantity: z.int(),
  priceCents: z.int(),
  costCents: z.int(),
  mediaId: z.uuid().nullable().optional(),
});

const pesos = (cents: number) => (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);

/**
 * P3: convierte una propuesta de IA (propia) en valores iniciales del formulario de producto.
 * El vendedor revisa todo antes de publicar (humano en el circuito).
 */
export async function getProposalDefaults(
  responseId: string,
  userId: string,
): Promise<(ProductFormDefaults & { proposalId: string }) | null> {
  if (!z.uuid().safeParse(responseId).success) return null;
  const response = await db.aIResponse.findFirst({
    where: { id: responseId, request: { userId, feature: "SALE_PROPOSAL" } },
    select: { id: true, output: true, request: { select: { input: true } } },
  });
  if (!response) return null;
  const proposal = saleProposalSchema.safeParse(response.output);
  const input = inputSchema.safeParse(response.request.input);
  if (!proposal.success || !input.success) return null;

  const [category, media] = await Promise.all([
    proposal.data.categorySlug
      ? db.category.findUnique({
          where: { slug: proposal.data.categorySlug },
          select: { id: true },
        })
      : null,
    input.data.mediaId
      ? db.media.findFirst({
          where: { id: input.data.mediaId, ownerId: userId },
          select: { id: true, storageKey: true, width: true, height: true },
        })
      : null,
  ]);

  return {
    proposalId: response.id,
    title: proposal.data.productName,
    description: `${proposal.data.description}\n\n${proposal.data.valueProposition}`,
    price: pesos(input.data.priceCents),
    cost: pesos(input.data.costCents),
    stock: String(input.data.quantity),
    tags: proposal.data.tags.join(", "),
    categoryId: category?.id,
    postBody: proposal.data.adIdeas[0],
    initialMedia: media
      ? [
          {
            id: media.id,
            url: getStorage().publicUrl(media.storageKey),
            width: media.width,
            height: media.height,
          },
        ]
      : undefined,
  };
}
