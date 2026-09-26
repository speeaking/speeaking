import { createHash } from "node:crypto";
import type { ProductCondition } from "@/generated/prisma/enums";
import { formatMoney } from "@/lib/format";
import { CONDITION_LABELS } from "@/modules/catalog/dto";
import {
  localDeliveryLine,
  nationalShippingLine,
  type ProductFacts,
} from "@/modules/catalog/quick-answers";
import { availableDeliveryMethods, orderShippingCents } from "@/modules/commerce/checkout-math";
import type { BuyerAuthenticityClaim } from "@/modules/trust/buyer-copy";
import type { BuyerAuthenticityView } from "@/modules/trust/status";
import type { ClaimKind } from "../output-guard";
import { redactPersonalData } from "../personal-data";
import { withoutCostMentions } from "../sale-proposal";

/**
 * Producto para el kit de anuncios: SOLO datos públicos y estructurados (P4). Nunca el costo: el
 * servicio no lo consulta y nada de esto llega al proveedor de IA más allá de lo que ya es público.
 */
export type AdKitProduct = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  categoryName: string;
  condition: ProductCondition;
  tags: string[];
  facts: ProductFacts;
};

/**
 * ¿Se puede decir «original» fuera de VendeIA (P14)? Solo si el vendedor lo declara y la revisión de
 * autenticidad no lo tiene «sin verificar»: con el comprobante pedido (NEEDS_PROOF), enviado sin
 * revisar (PROOF_SUBMITTED) o rechazado (REJECTED), la ficha dice «Autenticidad sin verificar» y un
 * anuncio no puede prometer lo contrario. `facts.authenticityClaim` es el `claim` de la ficha
 * (`buyerAuthenticityOf` en `catalog/dto.ts`); si no llega, no se sabe qué dice la ficha y no se
 * afirma (falla cerrada). Un kit guardado se revisa otra vez al mostrarse (`guardAdCopy` en
 * `viewOf`), así que deja de decir «original» en cuanto la revisión lo pide.
 */
export function mayClaimOriginal(facts: ProductFacts): boolean {
  return (
    facts.authenticity === "DECLARED_ORIGINAL" &&
    (facts.authenticityClaim === "declared" || facts.authenticityClaim === "reviewed")
  );
}

/**
 * `authenticityClaim` del kit a partir de lo que ve quien compra (`buyerAuthenticityOf`): el mismo
 * `claim` de la ficha, salvo que lo declarado lleve una nota de riesgo («Revisa: …», riesgo medio).
 * Un anuncio sale de VendeIA sin esa nota, así que ahí «original» solo va con lo declarado de riesgo
 * bajo (o sin revisión todavía) o con el comprobante revisado (falla cerrada, P14).
 */
export function adKitAuthenticityClaim(
  view: Pick<BuyerAuthenticityView, "claim" | "note">,
): BuyerAuthenticityClaim {
  return view.claim === "declared" && view.note !== null ? "unverified" : view.claim;
}

/** Dónde va el precio en los textos de la IA: el código pone el precio vigente al mostrarlos. */
export const PRICE_TOKEN = "[PRECIO]";

function nationalShipping(facts: ProductFacts) {
  return availableDeliveryMethods([facts]).includes("NATIONAL_SHIPPING")
    ? orderShippingCents("NATIONAL_SHIPPING", [facts])
    : null;
}

/** Datos verificables en frases cortas, tal como se muestran en la ficha (código, P4). */
export function factLines(product: AdKitProduct): string[] {
  const { facts } = product;
  const lines: string[] = [CONDITION_LABELS[product.condition]];
  const shipping = nationalShippingLine(facts);
  if (shipping) lines.push(shipping);
  const local = localDeliveryLine(facts);
  if (local) lines.push(local);
  if (facts.pickupAvailable) lines.push(`Para recoger en ${facts.city}, ${facts.state}`);
  if (facts.warrantyType !== "NONE") {
    const who = facts.warrantyType === "SELLER" ? "del vendedor" : "del fabricante";
    lines.push(
      facts.warrantyDays ? `Garantía ${who} por ${facts.warrantyDays} días` : `Garantía ${who}`,
    );
  }
  if (facts.returnWindowDays > 0) {
    lines.push(`Devoluciones dentro de ${facts.returnWindowDays} días`);
  }
  // Sin verificar: ni «original» ni nada sobre la revisión (el anuncio no la anuncia).
  if (mayClaimOriginal(facts)) {
    lines.push("Original (lo declara el vendedor)");
  } else if (facts.authenticity === "GENERIC") {
    lines.push("Genérico o compatible, no de la marca original");
  }
  return lines;
}

/** Afirmaciones P4 que los datos del producto respaldan (el resto se quita). */
export function allowedClaimsFor(product: AdKitProduct): Set<ClaimKind> {
  const { facts } = product;
  const allowed = new Set<ClaimKind>();
  const shipping = nationalShipping(facts);
  if (shipping !== null) {
    allowed.add("national_shipping");
    if (shipping === 0) allowed.add("free_shipping");
    if (facts.deliveryMinDays && facts.deliveryMaxDays) allowed.add("delivery_days");
  }
  if (facts.localDeliveryAvailable && facts.localDeliveryZones.length > 0) {
    allowed.add("local_delivery");
  }
  if (facts.pickupAvailable) allowed.add("pickup");
  if (facts.warrantyType !== "NONE") allowed.add("warranty");
  if (facts.returnWindowDays > 0) allowed.add("returns");
  if (mayClaimOriginal(facts)) allowed.add("authenticity");
  return allowed;
}

/** Montos que pueden aparecer: el precio y el envío que cobra el checkout. */
export function allowedCentsFor(product: AdKitProduct): Set<number> {
  const allowed = new Set([product.priceCents]);
  const shipping = nationalShipping(product.facts);
  if (shipping) allowed.add(shipping);
  return allowed;
}

/** Días que pueden aparecer: entrega, garantía y devoluciones. */
export function allowedDaysFor(product: AdKitProduct): Set<number> {
  const { facts } = product;
  return new Set(
    [
      facts.deliveryMinDays,
      facts.deliveryMaxDays,
      facts.warrantyDays,
      facts.returnWindowDays || null,
    ].filter((value): value is number => typeof value === "number" && value > 0),
  );
}

/**
 * Huella de los datos con que se generó un kit: si cambian (precio, envío, garantía…), el kit
 * guardado se marca para generar uno nuevo. El precio se vuelve a poner al mostrarlo.
 */
export function factsFingerprint(product: AdKitProduct) {
  return createHash("sha256")
    .update(
      JSON.stringify([
        product.title,
        product.priceCents,
        product.currency,
        product.condition,
        factLines(product),
      ]),
    )
    .digest("hex")
    .slice(0, 16);
}

/**
 * Lo que recibe la IA: datos públicos del producto (los mismos de su página), la descripción del
 * vendedor sin datos de contacto y las frases de datos ya redactadas por el código. Aunque la
 * descripción ya es pública, si el vendedor escribió ahí su costo («me costaron $200») se quita
 * igual: el costo nunca va al proveedor (H3).
 */
export function adCopyInput(product: AdKitProduct) {
  return {
    title: product.title,
    price: formatMoney(product.priceCents, product.currency),
    category: product.categoryName,
    city: product.facts.city,
    state: product.facts.state,
    tags: product.tags.slice(0, 10),
    description: redactPersonalData(withoutCostMentions(product.description)).slice(0, 800),
    facts: factLines(product),
  };
}

export type AdCopyInput = ReturnType<typeof adCopyInput>;
