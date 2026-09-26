import "server-only";
import { track } from "@/modules/analytics/track";
import { breakEvenUnits, unitEconomics } from "@/modules/catalog/pricing";
import { getAiBudget } from "@/modules/platform/settings";
import { db } from "@/server/db";
import { getAIProvider } from "@/server/providers/ai";
import { monthlyAiLimitMicros } from "./budget";
import { costMicrosUsd, mxnCentsToMicrosUsd } from "./cost";
import { type SaleProposal, type SaleProposalRequest, saleProposalSchema } from "./sale-proposal";

export class AIError extends Error {
  override name = "AIError";
  constructor(
    readonly code: "RATE_LIMITED" | "BUDGET_EXCEEDED" | "INVALID_OUTPUT" | "PROVIDER_ERROR",
  ) {
    super(code);
  }
}

function monthStart(date: Date, offsetMonths = 0) {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + offsetMonths, 1));
}

/**
 * Guardián de presupuesto (ADR-020): el gasto de IA del mes no puede superar
 * semilla + % de los ingresos del mes anterior (con tope duro).
 */
async function assertWithinBudget(userId: string) {
  const budget = await getAiBudget();
  const now = new Date();
  const recent = await db.aIRequest.count({
    where: { userId, createdAt: { gte: new Date(now.getTime() - 3_600_000) } },
  });
  if (recent >= budget.maxRequestsPerUserPerHour) throw new AIError("RATE_LIMITED");

  const [spent, revenue] = await Promise.all([
    db.aIResponse.aggregate({
      _sum: { costMicrosUsd: true },
      where: { createdAt: { gte: monthStart(now) } },
    }),
    db.platformLedgerEntry.aggregate({
      _sum: { amountCents: true },
      where: {
        amountCents: { gt: 0 },
        occurredAt: { gte: monthStart(now, -1), lt: monthStart(now) },
      },
    }),
  ]);
  const limit = monthlyAiLimitMicros(
    budget,
    mxnCentsToMicrosUsd(revenue._sum.amountCents ?? 0, budget.mxnPerUsd),
  );
  if ((spent._sum.costMicrosUsd ?? 0) >= limit) throw new AIError("BUDGET_EXCEEDED");
}

/** Genera la propuesta de "Vende con IA", la valida y registra uso, costo y latencia. */
export async function generateSaleProposal(
  userId: string,
  request: SaleProposalRequest & { mediaId: string | null },
) {
  const provider = getAIProvider();
  try {
    await assertWithinBudget(userId);
  } catch (error) {
    if (error instanceof AIError && error.code === "BUDGET_EXCEEDED") {
      await db.aIRequest.create({
        data: {
          userId,
          feature: "SALE_PROPOSAL",
          provider: provider.id,
          model: provider.model,
          promptVersion: provider.promptVersion,
          input: { productName: request.productName },
          status: "BLOCKED_BUDGET",
        },
      });
    }
    throw error;
  }

  const aiRequest = await db.aIRequest.create({
    data: {
      userId,
      feature: "SALE_PROPOSAL",
      provider: provider.id,
      model: provider.model,
      promptVersion: provider.promptVersion,
      // Entrada saneada: solo lo necesario para auditar y reconstruir la propuesta.
      input: {
        text: request.text.slice(0, 500),
        productName: request.productName,
        quantity: request.quantity,
        priceCents: request.priceCents,
        costCents: request.costCents,
        city: request.city,
        mediaId: request.mediaId,
      },
    },
    select: { id: true },
  });

  const started = Date.now();
  try {
    const { output, usage } = await provider.generateSaleProposal(request);
    const parsed = saleProposalSchema.safeParse(output);
    if (!parsed.success) {
      await db.aIRequest.update({
        where: { id: aiRequest.id },
        data: { status: "FAILED", errorCode: "INVALID_OUTPUT", latencyMs: Date.now() - started },
      });
      throw new AIError("INVALID_OUTPUT");
    }
    const response = await db.aIResponse.create({
      data: {
        requestId: aiRequest.id,
        output: parsed.data,
        inputTokens: usage.inputTokens,
        outputTokens: usage.outputTokens,
        costMicrosUsd: costMicrosUsd(provider.model, usage),
      },
      select: { id: true },
    });
    await db.aIRequest.update({
      where: { id: aiRequest.id },
      data: { status: "SUCCEEDED", latencyMs: Date.now() - started },
    });
    track({
      type: "AI_PROPOSAL_GENERATED",
      userId,
      surface: "STUDIO",
      metadata: { responseId: response.id },
    });
    return { responseId: response.id, proposal: parsed.data };
  } catch (error) {
    if (error instanceof AIError) throw error;
    await db.aIRequest.update({
      where: { id: aiRequest.id },
      data: { status: "FAILED", errorCode: "PROVIDER_ERROR", latencyMs: Date.now() - started },
    });
    throw new AIError("PROVIDER_ERROR");
  }
}

/** Cifras del negocio calculadas por CÓDIGO con los datos del vendedor (P2), no por la IA. */
export function proposalEconomics(request: SaleProposalRequest, proposal: SaleProposal) {
  const economics = unitEconomics({
    priceCents: request.priceCents,
    unitCostCents: request.costCents,
  });
  const daily = proposal.suggestedDailyBudgetCents;
  return {
    economics,
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
