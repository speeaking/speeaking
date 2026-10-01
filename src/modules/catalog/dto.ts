import type {
  Authenticity,
  AuthenticityStatus,
  PaymentMethod,
  ProductCondition,
  ProductStatus,
  RiskLevel,
  WarrantyType,
} from "@/generated/prisma/enums";
import { parseSignals } from "@/modules/trust/rules";
import { type BuyerAuthenticityView, buyerAuthenticityView } from "@/modules/trust/status";
import type { ProductFacts } from "./quick-answers";

export type MediaDTO = {
  url: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  alt: string | null;
};

/** Producto para cualquier visitante. NUNCA incluye el costo interno (ADR-006, regla DTO). */
export type PublicProductDTO = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  condition: ProductCondition;
  tags: string[];
  category: { slug: string; name: string };
  media: MediaDTO[];
  seller: {
    /** Id del perfil de la tienda (Pruébatelo, destacados). */
    id: string;
    userId: string;
    username: string | null;
    displayName: string;
    acceptedPaymentMethods: PaymentMethod[];
    /** La tienda acepta que otras personas etiqueten sus productos (ADR-063). */
    acceptsCollaborations: boolean;
  };
  facts: ProductFacts;
  saveCount: number;
  /**
   * Lo que ve quien compra sobre la autenticidad (P14): la declaración del vendedor, «Autenticidad
   * sin verificar» o «Comprobante revisado», y una nota neutral de riesgo. Nunca las señales, el
   * puntaje ni los reportes (son internos).
   */
  authenticityReview: BuyerAuthenticityView;
};

/** Forma mínima de la fila que necesita el mapeo (sin costo). */
export type PublicProductRow = {
  id: string;
  slug: string;
  title: string;
  description: string;
  priceCents: number;
  currency: string;
  condition: ProductCondition;
  tags: string[];
  status: ProductStatus;
  stock: number;
  city: string;
  state: string;
  pickupAvailable: boolean;
  localDeliveryAvailable: boolean;
  localDeliveryZones: string[];
  nationalShippingAvailable: boolean;
  shippingPriceCents: number | null;
  deliveryMinDays: number | null;
  deliveryMaxDays: number | null;
  warrantyType: WarrantyType;
  warrantyDays: number | null;
  returnWindowDays: number;
  authenticity: Authenticity;
  saveCount: number;
  category: { slug: string; name: string };
  seller: {
    id: string;
    userId: string;
    displayName: string;
    acceptedPaymentMethods: PaymentMethod[];
    /** Sin el campo (consultas que no lo piden): no acepta. */
    acceptsCollaborations?: boolean;
    user: { profile: { username: string } | null };
  };
  /**
   * Revisión de autenticidad vigente (una por producto); `null` si aún no se evalúa. Obligatoria en
   * el tipo: quien arme el DTO sin seleccionarla respondería «el vendedor declara que es original»
   * aunque la ficha diga «Autenticidad sin verificar» (falla abierta).
   */
  authenticityCheck: {
    status: AuthenticityStatus;
    riskLevel: RiskLevel;
    signals: unknown;
  } | null;
};

/**
 * Lo que ve quien compra sobre la autenticidad, a partir de la revisión vigente (P14). Una sola
 * fuente para la etiqueta de la ficha, la respuesta de «¿Es original?» (`facts.authenticityClaim`) y
 * cualquier otro texto hacia fuera (p. ej. el kit de anuncios): sin revisión, lo declarado.
 */
export function buyerAuthenticityOf(
  authenticity: Authenticity,
  check: PublicProductRow["authenticityCheck"],
): BuyerAuthenticityView {
  return buyerAuthenticityView(
    authenticity,
    check
      ? { status: check.status, riskLevel: check.riskLevel, signals: parseSignals(check.signals) }
      : null,
  );
}

/**
 * Construye el DTO público campo por campo (lista blanca). Aunque la fila traiga más datos
 * —por ejemplo el costo— no pasan al navegador.
 */
export function toPublicProduct(row: PublicProductRow, media: MediaDTO[]): PublicProductDTO {
  const authenticityReview = buyerAuthenticityOf(row.authenticity, row.authenticityCheck);
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    description: row.description,
    priceCents: row.priceCents,
    currency: row.currency,
    condition: row.condition,
    tags: row.tags,
    category: { slug: row.category.slug, name: row.category.name },
    media,
    seller: {
      id: row.seller.id,
      userId: row.seller.userId,
      username: row.seller.user.profile?.username ?? null,
      displayName: row.seller.displayName,
      acceptedPaymentMethods: row.seller.acceptedPaymentMethods,
      acceptsCollaborations: row.seller.acceptsCollaborations ?? false,
    },
    facts: {
      status: row.status,
      stock: row.stock,
      city: row.city,
      state: row.state,
      pickupAvailable: row.pickupAvailable,
      localDeliveryAvailable: row.localDeliveryAvailable,
      localDeliveryZones: row.localDeliveryZones,
      nationalShippingAvailable: row.nationalShippingAvailable,
      shippingPriceCents: row.shippingPriceCents,
      currency: row.currency,
      deliveryMinDays: row.deliveryMinDays,
      deliveryMaxDays: row.deliveryMaxDays,
      warrantyType: row.warrantyType,
      warrantyDays: row.warrantyDays,
      returnWindowDays: row.returnWindowDays,
      authenticity: row.authenticity,
      // «¿Es original?» dice lo mismo que la etiqueta de la ficha en cada estado de la revisión.
      authenticityClaim: authenticityReview.claim,
      acceptedPaymentMethods: row.seller.acceptedPaymentMethods,
    },
    saveCount: row.saveCount,
    authenticityReview,
  };
}

export const CONDITION_LABELS: Record<ProductCondition, string> = {
  NEW: "Nuevo",
  LIKE_NEW: "Como nuevo",
  USED_GOOD: "Usado en buen estado",
  USED_FAIR: "Usado con detalles",
  REFURBISHED: "Reacondicionado",
};

export const STATUS_LABELS: Record<ProductStatus, string> = {
  DRAFT: "Borrador",
  ACTIVE: "Activo",
  PAUSED: "Pausado",
  SOLD_OUT: "Agotado",
  ARCHIVED: "Archivado",
};
