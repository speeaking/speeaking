import "server-only";
import { track } from "@/modules/analytics/track";
import { breakEvenUnits, unitEconomics } from "@/modules/catalog/pricing";
import { db } from "@/server/db";
import { getAIProvider } from "@/server/providers/ai";
import { AIProviderError } from "@/server/providers/ai/errors";
import type { AIResult } from "@/server/providers/ai/types";
import { policyViolation } from "./content-policy";
import { AI_CALL_TIMEOUT_MS, recordedCost } from "./cost";
import { AIError } from "./errors";
import { guardProposal } from "./output-guard";
import { redactPersonalData } from "./personal-data";
import { suggestedDailyBudgetCents, withCodeNumbers } from "./proposal-numbers";
import { reserveAiRequest } from "./reservation";
import { maybeRedactExpiredAiInputs } from "./retention";
import {
  type SaleProposalAiOutput,
  type SaleProposalRequest,
  knownCategorySlug,
  saleProposalSchema,
} from "./sale-proposal";
import { assertAiAvailable, simulatedRecord } from "./tasks/availability";
import { type CategoryOption, saleProposalTask } from "./tasks/sale-proposal";

export { AIError } from "./errors";

/** Margen sobre el plazo del proveedor (que ya corta con `AbortController`). */
export const SERVICE_TIMEOUT_MS = AI_CALL_TIMEOUT_MS + 5_000;

/** La llamada al proveedor, o un error `timeout` si tarda más de `ms`. */
export function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new AIProviderError("timeout", "[ai] sin respuesta del proveedor")),
      ms,
    );
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Código de error del servicio para una falla del proveedor (el detalle queda en el registro). */
export function providerFailure(error: unknown): "INVALID_OUTPUT" | "PROVIDER_ERROR" {
  if (error instanceof AIProviderError) {
    console.error(error.message);
    if (error.kind === "no_credit") {
      // Aviso operativo claro en los registros de Vercel: la IA no vuelve hasta recargar saldo.
      console.error(
        "[ai] el proveedor de IA no tiene saldo: recarga créditos (docs/deploy.md, paso 6).",
      );
    }
    return error.kind === "invalid_output" ? "INVALID_OUTPUT" : "PROVIDER_ERROR";
  }
  console.error("[ai] error inesperado del proveedor", error);
  return "PROVIDER_ERROR";
}

/** Categorías entre las que elige la IA (todas: hojas y raíces, en el orden curado). */
async function categoryOptions(): Promise<CategoryOption[]> {
  return db.category.findMany({
    orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
    select: { slug: true, name: true },
  });
}

/**
 * Genera la propuesta de "Vende con IA": revisa la política de productos y que haya IA disponible
 * (ADR-038; si no, `UNAVAILABLE` sin gastar la cuota), reserva cuota y presupuesto ANTES de llamar
 * (SEC-19), llama al modelo que enruta `ai.routing` (sin el costo del vendedor, H3), pone las cifras
 * del código, valida la forma, revisa el contenido (SEC-28) y registra uso, costo y latencia. Lo que
 * se guarda y se devuelve es la propuesta ya revisada, marcada como simulada según el proveedor que
 * la escribió (`simulated`), no según la ruta de hoy.
 */
export async function generateSaleProposal(
  userId: string,
  request: SaleProposalRequest & { mediaId: string | null },
) {
  if (policyViolation(request.productName, request.text)) throw new AIError("NOT_ALLOWED");
  await assertAiAvailable("sale_proposal");
  const [provider, categories] = await Promise.all([
    getAIProvider("sale_proposal"),
    categoryOptions(),
  ]);
  const task = saleProposalTask;
  await maybeRedactExpiredAiInputs();
  const { requestId } = await reserveAiRequest({
    userId,
    feature: "SALE_PROPOSAL",
    provider: { id: provider.id, model: provider.model, promptVersion: task.promptVersion },
    // Lo necesario para auditar y reconstruir la propuesta. El texto libre se guarda sin correos,
    // teléfonos, ligas ni cuentas (SEC-29) y se redacta del todo a los 90 días (`retention.ts`).
    // El costo se guarda (lo necesita el prellenado del producto) pero NUNCA va al proveedor.
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

  let result: AIResult<SaleProposalAiOutput>;
  try {
    result = await withTimeout(
      provider.generate(task, { ...request, categories }),
      SERVICE_TIMEOUT_MS,
    );
  } catch (error) {
    // Queda FAILED: su costo máximo sigue contando en el presupuesto del mes.
    const code = providerFailure(error);
    await fail(code);
    throw new AIError(code);
  }

  // Una categoría que no existe no se usa (el prellenado buscaría un slug inválido).
  const parsed = saleProposalSchema.safeParse(
    withCodeNumbers(
      {
        ...result.output,
        categorySlug: knownCategorySlug(result.output.categorySlug, categories),
      },
      request,
    ),
  );
  if (!parsed.success) {
    await fail("INVALID_OUTPUT");
    throw new AIError("INVALID_OUTPUT");
  }
  const guarded = guardProposal(parsed.data, request);
  const cost = recordedCost(provider.model, result.usage);
  if (!cost.known) console.error(`[ai] costo desconocido para ${provider.model}`);

  const [response] = await db.$transaction([
    db.aIResponse.create({
      data: {
        requestId,
        output: guarded.proposal,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        costMicrosUsd: cost.micros,
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
    simulated: simulatedRecord(provider.id),
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
