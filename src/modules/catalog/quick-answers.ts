import type {
  Authenticity,
  PaymentMethod,
  ProductStatus,
  WarrantyType,
} from "@/generated/prisma/enums";
import { formatCount, formatMoney } from "@/lib/format";
import { availableDeliveryMethods, orderShippingCents } from "@/modules/commerce/checkout-math";

/**
 * Respuestas instantáneas a las preguntas frecuentes del comprador (P4 / ADR-007).
 * Se construyen SOLO con datos estructurados del producto: si un dato no existe, se dice que el
 * vendedor no lo ha especificado. El futuro AI Sales Agent usará exactamente estas herramientas.
 *
 * Voz única: el comprador pregunta por el vendedor en tercera persona ("¿Hace envíos?") y las
 * respuestas le hablan de tú ("te llega", "puedes recogerlo") nombrando siempre al vendedor.
 */
export type ProductFacts = {
  status: ProductStatus;
  stock: number;
  city: string;
  state: string;
  pickupAvailable: boolean;
  /** La misma columna que lee el checkout para ofrecer entrega local. */
  localDeliveryAvailable: boolean;
  localDeliveryZones: string[];
  nationalShippingAvailable: boolean;
  shippingPriceCents: number | null;
  /** Moneda de `shippingPriceCents` (la del producto). */
  currency: string;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  warrantyType: WarrantyType;
  warrantyDays: number | null;
  returnWindowDays: number;
  authenticity: Authenticity;
  acceptedPaymentMethods: PaymentMethod[];
};

/** "¿Sigue disponible?" va al final: la ficha ya muestra las existencias bajo el precio. */
export const QUICK_QUESTIONS = [
  { id: "shipping", label: "¿Hace envíos?" },
  { id: "pickup", label: "¿Puedo recogerlo?" },
  { id: "payment", label: "¿Cómo puedo pagar?" },
  { id: "warranty", label: "¿Tiene garantía?" },
  { id: "returns", label: "¿Acepta devoluciones?" },
  { id: "authenticity", label: "¿Es original?" },
  { id: "availability", label: "¿Sigue disponible?" },
] as const;

export type QuickQuestionId = (typeof QUICK_QUESTIONS)[number]["id"];

const UNSPECIFIED = "El vendedor no lo ha especificado.";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CARD: "tarjeta",
  TRANSFER: "transferencia",
  CASH_ON_DELIVERY: "pago contra entrega",
  OXXO: "pago en OXXO",
};

/** "a, b y c". Ante el sonido /i/ la "y" pasa a "e" ("Coyoacán e Iztapalapa"), salvo diptongo. */
function joinSpanish(items: string[]) {
  if (items.length <= 1) return items.join("");
  const last = items.at(-1) ?? "";
  const and = /^h?[ií](?![aeiouáéíóú])/i.test(last) ? "e" : "y";
  return `${items.slice(0, -1).join(", ")} ${and} ${last}`;
}

function plural(count: number, singular: string, pluralForm: string) {
  return count === 1 ? singular : pluralForm;
}

function isInStock(facts: ProductFacts) {
  return facts.status === "ACTIVE" && facts.stock > 0;
}

/** Métodos de entrega según las mismas reglas y columnas del checkout, para no prometer de más. */
function deliveryMethods(facts: ProductFacts) {
  return availableDeliveryMethods([facts]);
}

function deliveryWindow(facts: ProductFacts) {
  const { deliveryMinDays: min, deliveryMaxDays: max } = facts;
  if (!min || !max) return null;
  return min === max ? formatCount(min, "día", "días") : `${min} a ${max} días`;
}

/** Línea declarativa de existencias para la ficha: "Disponible · 12 piezas", "Agotado". */
export function stockLabel(facts: ProductFacts): string {
  if (facts.status === "PAUSED") return "Pausado por el vendedor";
  if (!isInStock(facts)) return "Agotado";
  return `Disponible · ${formatCount(facts.stock, "pieza", "piezas")}`;
}

/** Envío nacional cobrado con la misma regla del checkout, o null si no lo ofrece. */
function nationalShipping(facts: ProductFacts) {
  if (!deliveryMethods(facts).includes("NATIONAL_SHIPPING")) return null;
  return {
    cents: orderShippingCents("NATIONAL_SHIPPING", [facts]),
    days: deliveryWindow(facts),
  };
}

/** "+ $149 de envío a todo México · 3 a 7 días", o null si no hay envío nacional. */
export function nationalShippingLine(facts: ProductFacts): string | null {
  const shipping = nationalShipping(facts);
  if (!shipping) return null;
  const price =
    shipping.cents === 0
      ? "Envío gratis a todo México"
      : `+ ${formatMoney(shipping.cents, facts.currency)} de envío a todo México`;
  return shipping.days ? `${price} · ${shipping.days}` : price;
}

/** "Entrega local sin costo en Coyoacán y Benito Juárez", o null si no hay zonas. */
export function localDeliveryLine(facts: ProductFacts): string | null {
  // Sin zonas no hay dónde decir que se entrega: no se promete.
  if (!facts.localDeliveryZones.length || !deliveryMethods(facts).includes("LOCAL_DELIVERY")) {
    return null;
  }
  // El costo sale de la misma regla con la que el checkout cobra la entrega local.
  const cents = orderShippingCents("LOCAL_DELIVERY", [facts]);
  const price = cents === 0 ? "sin costo" : `por ${formatMoney(cents, facts.currency)}`;
  return `Entrega local ${price} en ${joinSpanish(facts.localDeliveryZones)}`;
}

function shippingAnswer(facts: ProductFacts) {
  const parts: string[] = [];
  const shipping = nationalShipping(facts);
  if (shipping) {
    const price =
      shipping.cents === 0
        ? "envía gratis a todo México"
        : `envía a todo México por ${formatMoney(shipping.cents, facts.currency)}`;
    const days = shipping.days ? ` y te llega en ${shipping.days}` : "";
    parts.push(`Sí, el vendedor ${price}${days}.`);
  }
  const local = localDeliveryLine(facts);
  if (local) {
    if (!parts.length) parts.push("El vendedor no envía a todo México.");
    parts.push(`${local}.`);
  }
  return parts.length ? parts.join(" ") : "El vendedor no ofrece envíos por ahora.";
}

export function answerQuickQuestion(question: QuickQuestionId, facts: ProductFacts): string {
  switch (question) {
    case "availability": {
      if (facts.status === "PAUSED") return "El vendedor pausó este producto por ahora.";
      if (!isInStock(facts)) return "Por ahora está agotado.";
      return `Sí, está disponible: ${plural(facts.stock, "queda", "quedan")} ${formatCount(facts.stock, "pieza", "piezas")}.`;
    }
    case "shipping":
      return shippingAnswer(facts);
    case "pickup":
      return facts.pickupAvailable
        ? `Sí, puedes recogerlo en ${facts.city}, ${facts.state}. El punto exacto lo acuerdas con el vendedor.`
        : "No se puede recoger en persona.";
    case "payment":
      return facts.acceptedPaymentMethods.length
        ? `El vendedor acepta ${joinSpanish(facts.acceptedPaymentMethods.map((method) => PAYMENT_LABELS[method]))}.`
        : UNSPECIFIED;
    case "warranty": {
      if (facts.warrantyType === "NONE") return "El vendedor no ofrece garantía.";
      const who = facts.warrantyType === "SELLER" ? "del vendedor" : "del fabricante";
      return facts.warrantyDays
        ? `Sí, tiene garantía ${who} por ${facts.warrantyDays} días.`
        : `Sí, tiene garantía ${who}; la duración no está especificada.`;
    }
    case "returns":
      return facts.returnWindowDays > 0
        ? `Sí, el vendedor acepta devoluciones dentro de ${facts.returnWindowDays} días.`
        : "El vendedor no acepta devoluciones.";
    case "authenticity":
      switch (facts.authenticity) {
        case "DECLARED_ORIGINAL":
          return "El vendedor declara que es original. No es una verificación de la plataforma.";
        case "GENERIC":
          return "Es un producto genérico o compatible, no de la marca original.";
        default:
          return "No aplica para este producto.";
      }
  }
}
