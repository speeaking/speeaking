import "server-only";
import { z } from "zod";
import type { ProductFormDefaults } from "@/modules/catalog/components/product-form";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { guardProposal } from "./output-guard";
import { saleProposalSchema } from "./sale-proposal";

const inputSchema = z.object({
  productName: z.string().min(2).max(120).optional(),
  quantity: z.int(),
  priceCents: z.int(),
  costCents: z.int(),
  mediaId: z.uuid().nullable().optional(),
});

const pesos = (cents: number) => (cents / 100).toFixed(cents % 100 === 0 ? 0 : 2);

/**
 * P3: convierte una propuesta de IA (propia) en valores iniciales del formulario de producto.
 * El vendedor revisa todo antes de publicar (humano en el circuito). El guardián de contenido
 * (SEC-28) se aplica otra vez al leer: una propuesta guardada antes de él tampoco prellena datos
 * de pago, urgencia ni afirmaciones sin respaldo. Pasada la retención (90 días) ya no prellena.
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
  const { proposal: guarded } = guardProposal(proposal.data, {
    productName: input.data.productName ?? proposal.data.productName,
    priceCents: input.data.priceCents,
    costCents: input.data.costCents,
    quantity: input.data.quantity,
  });

  const [category, media] = await Promise.all([
    guarded.categorySlug
      ? db.category.findUnique({
          where: { slug: guarded.categorySlug },
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
    title: guarded.productName,
    description: `${guarded.description}\n\n${guarded.valueProposition}`,
    price: pesos(input.data.priceCents),
    cost: pesos(input.data.costCents),
    stock: String(input.data.quantity),
    tags: guarded.tags.join(", "),
    categoryId: category?.id,
    postBody: guarded.adIdeas[0],
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
