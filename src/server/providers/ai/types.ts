import type { SaleProposalRequest } from "@/modules/ai/sale-proposal";

export type AIUsage = { inputTokens: number; outputTokens: number };

/**
 * Proveedor de IA (ADR-005). Expone operaciones de dominio, no un chat genérico. Toda salida se
 * valida con su esquema antes de usarse. Implementaciones: `mock` (hoy) y reales detrás de la
 * misma interfaz (se elige con AI_PROVIDER).
 */
export interface AIProvider {
  readonly id: string;
  readonly model: string;
  readonly promptVersion: string;
  generateSaleProposal(request: SaleProposalRequest): Promise<{ output: unknown; usage: AIUsage }>;
}
