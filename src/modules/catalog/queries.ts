import "server-only";
import type { SearchQuery } from "@/modules/search/normalize";
import { productSearchSql } from "@/modules/search/sql";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { type MediaDTO, type PublicProductDTO, toPublicProduct } from "./dto";
import { editFormDefaults } from "./form-defaults";
import { unitEconomics } from "./pricing";

/** Selección pública: sin la relación `cost` (no se consulta, no puede filtrarse). */
const publicProductSelect = {
  id: true,
  slug: true,
  title: true,
  description: true,
  priceCents: true,
  currency: true,
  condition: true,
  tags: true,
  status: true,
  stock: true,
  city: true,
  state: true,
  pickupAvailable: true,
  localDeliveryAvailable: true,
  localDeliveryZones: true,
  nationalShippingAvailable: true,
  shippingPriceCents: true,
  deliveryMinDays: true,
  deliveryMaxDays: true,
  warrantyType: true,
  warrantyDays: true,
  returnWindowDays: true,
  authenticity: true,
  moderationStatus: true,
  authenticityCheck: { select: { status: true, riskLevel: true, signals: true } },
  saveCount: true,
  categoryId: true,
  category: { select: { slug: true, name: true } },
  seller: {
    select: {
      userId: true,
      displayName: true,
      acceptedPaymentMethods: true,
      user: { select: { profile: { select: { username: true } } } },
    },
  },
  media: {
    orderBy: { position: "asc" as const },
    select: {
      media: {
        select: { storageKey: true, width: true, height: true, blurDataUrl: true, altText: true },
      },
    },
  },
} as const;

function toMedia(
  links: {
    media: {
      storageKey: string;
      width: number;
      height: number;
      blurDataUrl: string | null;
      altText: string | null;
    };
  }[],
): MediaDTO[] {
  const storage = getStorage();
  return links.map(({ media }) => ({
    url: storage.publicUrl(media.storageKey),
    width: media.width,
    height: media.height,
    blurDataUrl: media.blurDataUrl,
    alt: media.altText,
  }));
}

/** Quién pide la página: su dueño y el equipo ven un producto oculto por moderación. */
export type ProductPageAccess = { viewerUserId: string | null; isAdmin: boolean };

/**
 * Producto para su página pública. `null` si no existe, es borrador o archivado, o si el equipo
 * lo ocultó (salvo para su dueño y para ADMIN, que ven un aviso). Sin `access`, un oculto es `null`
 * (metadatos, vistas previas al compartir).
 */
export async function getPublicProduct(slug: string, access?: ProductPageAccess) {
  const row = await db.product.findUnique({ where: { slug }, select: publicProductSelect });
  if (!row || row.status === "DRAFT" || row.status === "ARCHIVED") return null;
  const hidden = row.moderationStatus === "HIDDEN";
  if (hidden && !(access?.isAdmin || access?.viewerUserId === row.seller.userId)) return null;
  return {
    product: toPublicProduct(row, toMedia(row.media)),
    categoryId: row.categoryId,
    /** Solo servidor: para avisos a su dueño y al equipo (nunca se pasa a un componente cliente). */
    moderation: {
      hidden,
      authenticityStatus: row.authenticityCheck?.status ?? null,
    },
  };
}

export type ProductCardDTO = Pick<
  PublicProductDTO,
  "id" | "slug" | "title" | "priceCents" | "currency"
> & {
  image: MediaDTO | null;
  city: string;
  inStock: boolean;
};

const cardSelect = {
  id: true,
  slug: true,
  title: true,
  priceCents: true,
  currency: true,
  city: true,
  stock: true,
  status: true,
  media: {
    orderBy: { position: "asc" as const },
    take: 1,
    select: {
      media: {
        select: { storageKey: true, width: true, height: true, blurDataUrl: true, altText: true },
      },
    },
  },
} as const;

function toCard(row: {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  city: string;
  stock: number;
  status: string;
  media: Parameters<typeof toMedia>[0];
}): ProductCardDTO {
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    priceCents: row.priceCents,
    currency: row.currency,
    city: row.city,
    inStock: row.status === "ACTIVE" && row.stock > 0,
    image: toMedia(row.media)[0] ?? null,
  };
}

/**
 * Productos activos para "Comprar" (filtro opcional por categoría y texto). Con texto usa la misma
 * búsqueda que /buscar (`productSearchSql`): por palabras, sin acentos ni mayúsculas, en título y
 * etiquetas, así «tecnologia» encuentra «Tecnología». El texto llega ya normalizado
 * (`parseSearchQuery`) y solo viaja como parámetro de SQL.
 */
export async function listShopProducts({
  categorySlug,
  query,
  limit = 24,
}: {
  categorySlug?: string;
  query?: SearchQuery | null;
  limit?: number;
}): Promise<ProductCardDTO[]> {
  const where = { status: "ACTIVE" as const, stock: { gt: 0 }, ...VISIBLE_PRODUCT };
  if (!query) {
    const rows = await db.product.findMany({
      where: {
        ...where,
        ...(categorySlug
          ? {
              OR: [
                { category: { slug: categorySlug } },
                { category: { parent: { slug: categorySlug } } },
              ],
            }
          : {}),
      },
      orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
      take: limit,
      select: cardSelect,
    });
    return rows.map(toCard);
  }

  const matches = await db.$queryRaw<{ id: string }[]>(
    productSearchSql(query.terms, limit, { categorySlug }),
  );
  const ids = matches.map((row) => row.id);
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { ...where, id: { in: ids } },
    select: cardSelect,
  });
  // La búsqueda ya decidió el orden (primero los que coinciden en el título).
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [toCard(row)] : [];
  });
}

export async function listRelatedProducts(categoryId: string, excludeId: string, limit = 6) {
  const rows = await db.product.findMany({
    where: {
      status: "ACTIVE",
      stock: { gt: 0 },
      ...VISIBLE_PRODUCT,
      categoryId,
      id: { not: excludeId },
    },
    orderBy: { publishedAt: "desc" },
    take: limit,
    select: cardSelect,
  });
  return rows.map(toCard);
}

export async function listCategories() {
  return db.category.findMany({
    orderBy: [{ parentId: { sort: "asc", nulls: "first" } }, { sortOrder: "asc" }],
    select: { id: true, slug: true, name: true, parentId: true },
  });
}

/** Productos del vendedor CON su costo y economía unitaria (solo para su dueño, P2). */
export async function listSellerProducts(sellerId: string) {
  const rows = await db.product.findMany({
    where: { sellerId },
    orderBy: { createdAt: "desc" },
    select: {
      ...cardSelect,
      saveCount: true,
      tags: true,
      categoryId: true,
      publishedAt: true,
      cost: { select: { unitCostCents: true } },
      authenticity: true,
      moderationStatus: true,
      authenticityCheck: { select: { status: true } },
    },
  });
  return rows.map((row) => ({
    ...toCard(row),
    status: row.status,
    stock: row.stock,
    saveCount: row.saveCount,
    tags: row.tags,
    categoryId: row.categoryId,
    publishedAt: row.publishedAt,
    /** Oculto por el equipo: no aparece en nada público (el vendedor lo sigue viendo aquí). */
    hidden: row.moderationStatus === "HIDDEN",
    authenticityStatus: row.authenticityCheck?.status ?? null,
    /** Solo a lo declarado original se le pide comprobante (P14). */
    declaredOriginal: row.authenticity === "DECLARED_ORIGINAL",
    economics: unitEconomics({
      priceCents: row.priceCents,
      unitCostCents: row.cost?.unitCostCents ?? 0,
    }),
  }));
}

/**
 * Producto propio para editarlo en el Studio, CON su costo (solo para su dueño). `null` si no
 * existe o es de otra persona: la propiedad se comprueba en la consulta.
 */
export async function getSellerProductForEdit(sellerUserId: string, productId: string) {
  const row = await db.product.findFirst({
    where: { id: productId, seller: { userId: sellerUserId } },
    select: {
      id: true,
      slug: true,
      title: true,
      description: true,
      priceCents: true,
      stock: true,
      status: true,
      categoryId: true,
      condition: true,
      tags: true,
      city: true,
      state: true,
      pickupAvailable: true,
      localDeliveryZones: true,
      nationalShippingAvailable: true,
      shippingPriceCents: true,
      deliveryMinDays: true,
      deliveryMaxDays: true,
      warrantyType: true,
      warrantyDays: true,
      returnWindowDays: true,
      authenticity: true,
      moderationStatus: true,
      authenticityCheck: { select: { status: true } },
      cost: { select: { unitCostCents: true } },
      media: {
        orderBy: { position: "asc" },
        select: { media: { select: { id: true, storageKey: true, width: true, height: true } } },
      },
    },
  });
  if (!row) return null;
  const storage = getStorage();
  const media = row.media.map(({ media: item }) => ({
    id: item.id,
    url: storage.publicUrl(item.storageKey),
    width: item.width,
    height: item.height,
  }));
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    status: row.status,
    hidden: row.moderationStatus === "HIDDEN",
    authenticityStatus: row.authenticityCheck?.status ?? null,
    declaredOriginal: row.authenticity === "DECLARED_ORIGINAL",
    defaults: editFormDefaults(row, media),
  };
}
