import "server-only";
import { track } from "@/modules/analytics/track";
import { breakEvenUnits, unitEconomics } from "@/modules/catalog/pricing";
import { db } from "@/server/db";
import { getAIProvider } from "@/server/providers/ai";
import { AI_CALL_TIMEOUT_MS, costMicrosUsd } from "./cost";
import { AIError } from "./errors";
import { guardProposal } from "./output-guard";
import { redactPersonalData } from "./personal-data";
import { suggestedDailyBudgetCents, withCodeNumbers } from "./proposal-numbers";
import { reserveAiRequest } from "./reservation";
import { maybeRedactExpiredAiInputs } from "./retention";
import { type SaleProposalRequest, saleProposalSchema } from "./sale-proposal";

export { AIError } from "./errors";

/** La llamada al proveedor, o un error `timeout` si tarda más de `ms`. */
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error("timeout")), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/**
 * Genera la propuesta de "Vende con IA": reserva cuota y presupuesto ANTES de llamar (SEC-19), pone
 * las cifras del código, valida la forma, revisa el contenido (SEC-28) y registra uso, costo y
 * latencia. Lo que se guarda y se devuelve es la propuesta ya revisada.
 */
export async function generateSaleProposal(
  userId: string,
  request: SaleProposalRequest & { mediaId: string | null },
) {
  const provider = getAIProvider();
  await maybeRedactExpiredAiInputs();
  const { requestId } = await reserveAiRequest({
    userId,
    feature: "SALE_PROPOSAL",
    provider,
    // Lo necesario para auditar y reconstruir la propuesta. El texto libre se guarda sin correos,
    // teléfonos, ligas ni cuentas (SEC-29) y se redacta del todo a los 90 días (`retention.ts`).
    input: {
      text: redactPersonalData(request.text).slice(0, 500),
      productName: request.productName,
      quantity: request.quantity,
      priceCents: request.priceCents,
      costCents: request.costCents,
      city: request.city,
      mediaId: request.mediaId,
    },
  });

  const started = Date.now();
  const fail = (errorCode: "INVALID_OUTPUT" | "PROVIDER_ERROR") =>
    db.aIRequest.update({
      where: { id: requestId },
      data: { status: "FAILED", errorCode, latencyMs: Date.now() - started },
    });

  let result: Awaited<ReturnType<typeof provider.generateSaleProposal>>;
  try {
    result = await withTimeout(provider.generateSaleProposal(request), AI_CALL_TIMEOUT_MS);
  } catch {
    // Queda FAILED: su costo máximo sigue contando en el presupuesto del mes.
    await fail("PROVIDER_ERROR");
    throw new AIError("PROVIDER_ERROR");
  }

  const parsed = saleProposalSchema.safeParse(withCodeNumbers(result.output, request));
  if (!parsed.success) {
    await fail("INVALID_OUTPUT");
    throw new AIError("INVALID_OUTPUT");
  }
  const guarded = guardProposal(parsed.data, request);

  const [response] = await db.$transaction([
    db.aIResponse.create({
      data: {
        requestId,
        output: guarded.proposal,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costMicrosUsd: costMicrosUsd(provider.model, result.usage),
      },
      select: { id: true },
    }),
    db.aIRequest.update({
      where: { id: requestId },
      data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
    }),
  ]);
  track({
    type: "AI_PROPOSAL_GENERATED",
    userId,
    surface: "STUDIO",
    metadata: { responseId: response.id },
  });
  return {
    responseId: response.id,
    proposal: guarded.proposal,
    guard: { removed: guarded.removed, findings: guarded.findings },
  };
}

/** Cifras del negocio calculadas por CÓDIGO con los datos del vendedor (P2), no por la IA. */
export function proposalEconomics(request: SaleProposalRequest) {
  const economics = unitEconomics({
    priceCents: request.priceCents,
    unitCostCents: request.costCents,
  });
  const daily = suggestedDailyBudgetCents(request);
  return {
    economics,
    dailyBudgetCents: daily,
    potentialProfitCents: economics.netMarginCents * request.quantity,
    investmentCents: request.costCents * request.quantity,
    breakEvenWeek: breakEvenUnits({
      spendCents: daily * 7,
      netMarginCents: economics.netMarginCents,
    }),
    breakEvenMonth: breakEvenUnits({
      spendCents: daily * 30,
      netMarginCents: economics.netMarginCents,
    }),
  };
}
