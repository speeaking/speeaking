"use server";

import { z } from "zod";
import { parsePesosToCents } from "@/modules/catalog/pricing";
import { requireOnboardedViewer } from "@/modules/identity/session";
import { db } from "@/server/db";
import { limitOrError } from "@/server/rate-limit";
import type { GuardFinding } from "./output-guard";
import type { SaleProposal } from "./sale-proposal";
import { AIError, generateSaleProposal, proposalEconomics } from "./service";

const requestSchema = z.object({
  text: z.string().trim().min(8, "Cuéntanos un poco más de lo que vendes.").max(1000),
  productName: z.string().trim().min(2, "Escribe el nombre del producto.").max(120),
  quantity: z.coerce.number().int().min(1, "¿Cuántas piezas tienes?").max(100_000),
  price: z.string(),
  cost: z.string(),
  mediaId: z.uuid().optional(),
});

export type ProposalState = {
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
  result?: {
    responseId: string;
    proposal: SaleProposal;
    numbers: ReturnType<typeof proposalEconomics>;
    quantity: number;
    /** Frases que el guardián de contenido quitó (SEC-28) y por qué. */
    guard: { removed: number; findings: GuardFinding[] };
  };
};

const AI_MESSAGES: Record<AIError["code"], string> = {
  RATE_LIMITED: "Hiciste muchas solicitudes seguidas. Espera un momento y vuelve a intentar.",
  // Sin detalles internos y con una salida: publicar a mano no depende de la IA.
  BUDGET_EXCEEDED:
    "Vende con IA no está disponible por ahora. Puedes publicar tu producto a mano desde Productos.",
  INVALID_OUTPUT: "La IA respondió algo que no pudimos validar. Intenta de nuevo.",
  PROVIDER_ERROR: "La IA no está disponible en este momento. Intenta de nuevo.",
};

export async function generateProposalAction(
  _previous: ProposalState,
  formData: FormData,
): Promise<ProposalState> {
  const viewer = await requireOnboardedViewer("/studio/vende-con-ia");
  const parsed = requestSchema.safeParse({
    text: formData.get("text"),
    productName: formData.get("productName"),
    quantity: formData.get("quantity"),
    price: formData.get("price") ?? "",
    cost: formData.get("cost") ?? "",
    mediaId: formData.get("mediaId") || undefined,
  });
  if (!parsed.success) return { fieldErrors: z.flattenError(parsed.error).fieldErrors };

  // P2: los números los confirma el vendedor; la IA nunca los inventa.
  const priceCents = parsePesosToCents(parsed.data.price);
  const costCents = parsePesosToCents(parsed.data.cost);
  if (!priceCents) return { fieldErrors: { price: ["Escribe tu precio de venta."] } };
  if (costCents === null)
    return { fieldErrors: { cost: ["Escribe cuánto te costó (0 si no aplica)."] } };

  const [seller, media] = await Promise.all([
    viewer.sellerProfileId
      ? db.sellerProfile.findUnique({
          where: { id: viewer.sellerProfileId },
          select: { city: true },
        })
      : null,
    parsed.data.mediaId
      ? db.media.findFirst({
          where: { id: parsed.data.mediaId, ownerId: viewer.userId },
          select: { id: true },
        })
      : null,
  ]);

  const request = {
    text: parsed.data.text,
    productName: parsed.data.productName,
    quantity: parsed.data.quantity,
    priceCents,
    costCents,
    city: seller?.city ?? null,
    hasPhoto: Boolean(media),
  };
  try {
    const { responseId, proposal, guard } = await generateSaleProposal(viewer.userId, {
      ...request,
      mediaId: media?.id ?? null,
    });
    return {
      result: {
        responseId,
        proposal,
        numbers: proposalEconomics(request),
        quantity: request.quantity,
        guard,
      },
    };
  } catch (error) {
    if (!(error instanceof AIError)) throw error;
    const wait =
      error.code === "RATE_LIMITED" && error.retryAfterSeconds
        ? limitOrError({ ok: false, retryAfterSeconds: error.retryAfterSeconds })
        : null;
    return { error: wait ?? AI_MESSAGES[error.code] };
  }
}
