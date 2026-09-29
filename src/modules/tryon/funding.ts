import type { AIFunding } from "@/generated/prisma/enums";

/**
 * Quién paga una prueba (ADR-044, docs/modelo-de-ingresos.md §3.2), en este orden:
 * 1. el vendedor que patrocina el producto principal, si tiene saldo y tope del día;
 * 2. las pruebas gratis del mes de la persona (el subsidio diario lo revisa el guardián);
 * 3. el saldo de la persona.
 * Es una lista de opciones a intentar: si una falla al reservar (sin saldo, tope agotado), se pasa
 * a la siguiente. Sin ninguna, la interfaz ofrece recargar.
 */
export type FundingOption =
  | { funding: "SELLER_PAID"; sponsorSellerId: string; sponsorUserId: string; chargedCents: number }
  | { funding: "PLATFORM"; chargedCents: 0 }
  | { funding: "USER_PAID"; chargedCents: number };

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
  /** Pruebas gratis usadas este mes y cuántas hay. */
  freeUsed: number;
  freeLimit: number;
  userBalanceCents: number;
  /** La persona es quien vende el producto principal: no se patrocina a sí misma. */
  userIsSponsor: boolean;
};

export function fundingOptions(context: FundingContext): FundingOption[] {
  const options: FundingOption[] = [];
  const sponsor = context.sponsor;
  if (
    sponsor &&
    sponsor.enabled &&
    !context.userIsSponsor &&
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
  if (context.freeUsed < context.freeLimit) options.push({ funding: "PLATFORM", chargedCents: 0 });
  if (context.userBalanceCents >= context.priceCents) {
    options.push({ funding: "USER_PAID", chargedCents: context.priceCents });
  }
  return options;
}

export function describeFunding(funding: AIFunding): string {
  switch (funding) {
    case "SELLER_PAID":
      return "Cortesía de la tienda";
    case "PLATFORM":
      return "Prueba gratis del mes";
    case "USER_PAID":
      return "Pagada con tu saldo";
    case "SYSTEM":
      return "Sistema";
  }
}
