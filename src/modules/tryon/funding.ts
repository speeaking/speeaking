import { siteConfig } from "@/config/site";
import type { AIFunding } from "@/generated/prisma/enums";

/**
 * Quién paga una prueba de «Ver cómo me veo» (ADR-046, docs/modelo-de-ingresos.md §3.2). Quien
 * compra nunca paga: quien gana con la venta es quien paga. En este orden:
 * 1. la tienda del producto principal, si tiene «Ver cómo me veo» activo, saldo y tope del día;
 * 2. las pruebas de cortesía de esa tienda (las paga speeaking; `STORE_TRIAL_TRY_ONS` por tienda,
 *    con el tope diario global del subsidio que revisa el guardián).
 * Es una lista de opciones a intentar: si una falla al reservar (sin saldo, tope agotado), se pasa
 * a la siguiente. Sin ninguna, el botón sigue ahí pero explica que la tienda no tiene pruebas y la
 * demanda se registra para que quien vende la vea.
 */
export type FundingOption =
  | { funding: "SELLER_PAID"; sponsorSellerId: string; sponsorUserId: string; chargedCents: number }
  | { funding: "PLATFORM"; chargedCents: 0 };

export type FundingContext = {
  priceCents: number;
  sponsor: {
    sellerId: string;
    userId: string;
    enabled: boolean;
    dailyCapCents: number;
    spentTodayCents: number;
    balanceCents: number;
  } | null;
  /** Pruebas de cortesía ya usadas por la tienda y cuántas tiene. */
  trialUsed: number;
  trialLimit: number;
};

export function fundingOptions(context: FundingContext): FundingOption[] {
  const options: FundingOption[] = [];
  const sponsor = context.sponsor;
  if (
    sponsor &&
    sponsor.enabled &&
    sponsor.balanceCents >= context.priceCents &&
    sponsor.spentTodayCents + context.priceCents <= sponsor.dailyCapCents
  ) {
    options.push({
      funding: "SELLER_PAID",
      sponsorSellerId: sponsor.sellerId,
      sponsorUserId: sponsor.userId,
      chargedCents: context.priceCents,
    });
  }
  if (context.trialUsed < context.trialLimit)
    options.push({ funding: "PLATFORM", chargedCents: 0 });
  return options;
}

/** Lo que se le dice a la persona antes de generar: quién paga esta prueba, o que no hay. */
export type FundingStatus = "sponsored" | "trial" | "none";

export function fundingStatus(context: FundingContext): FundingStatus {
  const first = fundingOptions(context)[0];
  if (!first) return "none";
  return first.funding === "SELLER_PAID" ? "sponsored" : "trial";
}

export function describeFunding(funding: AIFunding): string {
  switch (funding) {
    case "SELLER_PAID":
      return "Cortesía de la tienda";
    case "PLATFORM":
      return `Cortesía de ${siteConfig.name}`;
    // Ya no se cobra a quien compra; queda por las pruebas anteriores al cambio (ADR-046).
    case "USER_PAID":
      return "Pagada con saldo";
    case "SYSTEM":
      return "Sistema";
  }
}
