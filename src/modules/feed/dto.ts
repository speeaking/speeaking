import type {
  Authenticity,
  PaymentMethod,
  PostType,
  ProductStatus,
  ReactionKind,
  SellerStatus,
  WarrantyType,
} from "@/generated/prisma/enums";
import type { ProductFacts } from "@/modules/catalog/quick-answers";
import { slotForPublicProduct } from "@/modules/stylist/slots";
import type { RankReason } from "./ranking";
import type { FeedProductsDTO } from "./product-carousel-compose";

/** Foto lista para pintar, con el crédito de su autor si es de stock con licencia libre. */
export type FeedMediaDTO = {
  url: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  alt: string | null;
  /** «Foto: <name> · <license>», enlazado a `url` (solo http/https). */
  credit: { name: string; url: string | null; license: string | null } | null;
};

/**
 * Estado del producto para la tarjeta: pausado y agotado se dicen distinto («Pausado» no es
 * «Agotado»). Borradores y archivados quedan como `unavailable` («No disponible»).
 */
export type ProductAvailability = "available" | "sold_out" | "paused" | "unavailable";

/** Por qué se muestra una pieza comercial, en palabras honestas (ver `IntentMatch`). */
export type FeedIntentDTO =
  | { basis: "query"; query: string; source: "declared" | "search" }
  | { basis: "viewed"; categoryName: string };

/** Publicación lista para pintar en el cliente. Solo datos públicos (nunca costos ni correos). */
export type FeedItemDTO = {
  id: string;
  type: PostType;
  body: string;
  publishedAt: string;
  isAiGenerated: boolean;
  author: {
    userId: string;
    username: string;
    displayName: string;
    avatarUrl: string | null;
    isEditorial: boolean;
    /** Tiene una tienda activa: la tarjeta lo identifica con la insignia «Tienda». */
    isSeller: boolean;
  };
  community: { slug: string; name: string; emoji: string; hue: number } | null;
  media: FeedMediaDTO[];
  product: {
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    inStock: boolean;
    availability: ProductAvailability;
    city: string;
    state: string;
    categoryName: string;
    /** Es una prenda, calzado o accesorio con foto: la tarjeta ofrece «Ver cómo me veo» (ADR-046). */
    tryOn: boolean;
    /** Datos verificables (P4) para la fila de envío, devoluciones y garantía. */
    facts: ProductFacts;
  } | null;
  stats: {
    /** Total de reacciones de todos los tipos (ADR-054). */
    likes: number;
    comments: number;
    saves: number;
    /** Resumen: los tipos de reacción más usados, de mayor a menor (hasta 3). */
    reactions: ReactionKind[];
  };
  viewer: {
    /** La reacción de quien mira; `null` si no ha reaccionado. */
    reaction: ReactionKind | null;
    saved: boolean;
    /**
     * El precio cabe en el presupuesto que la persona declaró para este tipo de producto.
     * Lo calcula el servidor (P2); fuera del feed siempre es `false`.
     */
    withinBudget: boolean;
  };
  /** Contexto de ranking (solo en el feed): se registra con cada impresión. */
  ranking: {
    position: number;
    score: number;
    reason: RankReason;
    slot: "content" | "commerce";
    algorithmVersion: string;
    /** Explicación para la persona («Porque buscas…»); `null` si no hay una honesta. */
    intent: FeedIntentDTO | null;
  } | null;
};

export type FeedPageDTO = {
  items: FeedItemDTO[];
  nextCursor: string | null;
  /** Carrusel de productos de esta página (ADR-051); solo en el inicio. */
  products?: FeedProductsDTO | null;
};

/** Comunidad tal como la pintan las burbujas y los chips del inicio (solo datos públicos). */
export type HomeCommunityDTO = {
  id: string;
  slug: string;
  name: string;
  emoji: string;
  hue: number;
};

/** «¡Listo, Sofía!» después del onboarding. */
export type WelcomeMomentDTO = {
  firstName: string;
  communities: HomeCommunityDTO[];
  /** La búsqueda que declaró al registrarse (sin presupuesto: la tarjeta no promete nada). */
  query: string | null;
};

// ─────────────────────────── Mapeo desde la base de datos ───────────────────────────

type MediaRow = {
  storageKey: string;
  width: number;
  height: number;
  blurDataUrl: string | null;
  altText: string | null;
  creditName: string | null;
  creditUrl: string | null;
  license: string | null;
};

/** Forma mínima de la fila que necesita el mapeo. No incluye el costo: ni siquiera se consulta. */
export type FeedPostRow = {
  id: string;
  type: PostType;
  body: string;
  publishedAt: Date;
  isAiGenerated: boolean;
  likeCount: number;
  commentCount: number;
  saveCount: number;
  author: {
    id: string;
    profile: {
      username: string;
      displayName: string;
      avatarUrl: string | null;
      isEditorial: boolean;
    } | null;
    sellerProfile: { status: SellerStatus } | null;
  };
  community: { slug: string; name: string; emoji: string; hue: number } | null;
  media: { media: MediaRow }[];
  product: {
    slug: string;
    title: string;
    priceCents: number;
    currency: string;
    stock: number;
    status: ProductStatus;
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
    tags: string[];
    category: { name: string; slug: string };
    seller: { acceptedPaymentMethods: PaymentMethod[] };
    media: { media: MediaRow }[];
  } | null;
  /** Reacción de quien mira (filtrada por su id en la consulta): a lo más una fila. */
  likes: readonly { kind: ReactionKind }[];
  saves: readonly unknown[];
  /** Resumen de reacciones de la publicación (`reactionTops`), ya ordenado. */
  reactions: readonly ReactionKind[];
};

export function productAvailability(status: ProductStatus, stock: number): ProductAvailability {
  if (status === "ACTIVE") return stock > 0 ? "available" : "sold_out";
  if (status === "SOLD_OUT") return "sold_out";
  if (status === "PAUSED") return "paused";
  return "unavailable";
}

/** Solo enlaces web: un `javascript:` en el crédito nunca llega a un `href`. */
function safeWebUrl(value: string | null) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

function toMedia(media: MediaRow, publicUrl: (storageKey: string) => string): FeedMediaDTO {
  const creditName = media.creditName?.trim();
  return {
    url: publicUrl(media.storageKey),
    width: media.width,
    height: media.height,
    blurDataUrl: media.blurDataUrl,
    alt: media.altText,
    credit: creditName
      ? {
          name: creditName,
          url: safeWebUrl(media.creditUrl),
          license: media.license?.trim() || null,
        }
      : null,
  };
}

/**
 * Construye el DTO público campo por campo (lista blanca): aunque la fila traiga más datos —por
 * ejemplo el costo del producto— no pasan al navegador. `ranking` lo agrega el motor del feed.
 * Devuelve `null` si el autor no tiene perfil (no se puede mostrar).
 */
export function toFeedItem(
  row: FeedPostRow,
  publicUrl: (storageKey: string) => string,
): FeedItemDTO | null {
  const profile = row.author.profile;
  if (!profile) return null;
  // Una publicación de venta muestra las fotos ACTUALES del producto: si el vendedor las cambia,
  // el feed lo refleja. Su copia propia queda solo como respaldo.
  const productLinks = row.type === "PRODUCT" ? (row.product?.media ?? []) : [];
  const links = productLinks.length > 0 ? productLinks : row.media;
  const product = row.product;

  return {
    id: row.id,
    type: row.type,
    body: row.body,
    publishedAt: row.publishedAt.toISOString(),
    isAiGenerated: row.isAiGenerated,
    author: {
      userId: row.author.id,
      username: profile.username,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      isEditorial: profile.isEditorial,
      isSeller: row.author.sellerProfile?.status === "ACTIVE",
    },
    community: row.community
      ? {
          slug: row.community.slug,
          name: row.community.name,
          emoji: row.community.emoji,
          hue: row.community.hue,
        }
      : null,
    media: links.map(({ media }) => toMedia(media, publicUrl)),
    product: product
      ? {
          slug: product.slug,
          title: product.title,
          priceCents: product.priceCents,
          currency: product.currency,
          inStock: product.status === "ACTIVE" && product.stock > 0,
          availability: productAvailability(product.status, product.stock),
          city: product.city,
          state: product.state,
          categoryName: product.category.name,
          tryOn:
            slotForPublicProduct({
              categorySlug: product.category.slug,
              title: product.title,
              tags: product.tags,
            }) !== null,
          facts: {
            status: product.status,
            stock: product.stock,
            city: product.city,
            state: product.state,
            pickupAvailable: product.pickupAvailable,
            localDeliveryAvailable: product.localDeliveryAvailable,
            localDeliveryZones: product.localDeliveryZones,
            nationalShippingAvailable: product.nationalShippingAvailable,
            shippingPriceCents: product.shippingPriceCents,
            currency: product.currency,
            deliveryMinDays: product.deliveryMinDays,
            deliveryMaxDays: product.deliveryMaxDays,
            warrantyType: product.warrantyType,
            warrantyDays: product.warrantyDays,
            returnWindowDays: product.returnWindowDays,
            authenticity: product.authenticity,
            acceptedPaymentMethods: product.seller.acceptedPaymentMethods,
          },
        }
      : null,
    stats: {
      likes: row.likeCount,
      comments: row.commentCount,
      saves: row.saveCount,
      reactions: [...row.reactions],
    },
    viewer: {
      reaction: row.likes[0]?.kind ?? null,
      saved: row.saves.length > 0,
      withinBudget: false,
    },
    ranking: null,
  };
}
