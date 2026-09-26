import type {
  Authenticity,
  PaymentMethod,
  ProductCondition,
  ProductStatus,
  WarrantyType,
} from "@/generated/prisma/enums";
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
    userId: string;
    username: string | null;
    displayName: string;
    acceptedPaymentMethods: PaymentMethod[];
  };
  facts: ProductFacts;
  saveCount: number;
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
    userId: string;
    displayName: string;
    acceptedPaymentMethods: PaymentMethod[];
    user: { profile: { username: string } | null };
  };
};

/**
 * Construye el DTO público campo por campo (lista blanca). Aunque la fila traiga más datos
 * —por ejemplo el costo— no pasan al navegador.
 */
export function toPublicProduct(row: PublicProductRow, media: MediaDTO[]): PublicProductDTO {
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
      userId: row.seller.userId,
      username: row.seller.user.profile?.username ?? null,
      displayName: row.seller.displayName,
      acceptedPaymentMethods: row.seller.acceptedPaymentMethods,
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
      acceptedPaymentMethods: row.seller.acceptedPaymentMethods,
    },
    saveCount: row.saveCount,
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
