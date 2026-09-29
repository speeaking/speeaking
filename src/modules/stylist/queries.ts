import "server-only";
import type { MediaDTO } from "@/modules/catalog/dto";
import { VISIBLE_PRODUCT } from "@/modules/trust/visibility";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { FASHION_ROOT_SLUG } from "./slots";

/** Producto candidato para un look: solo datos públicos (nunca el costo). */
export type CandidateRow = {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  priceCents: number;
  currency: string;
  stock: number;
  city: string;
  categorySlug: string;
  parentSlug: string | null;
  sellerId: string;
  sellerUserId: string;
  sellerName: string;
  publishedAt: Date | null;
  image: MediaDTO | null;
};

const candidateSelect = {
  id: true,
  slug: true,
  title: true,
  tags: true,
  priceCents: true,
  currency: true,
  stock: true,
  city: true,
  publishedAt: true,
  category: { select: { slug: true, parent: { select: { slug: true } } } },
  seller: { select: { id: true, userId: true, displayName: true } },
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

type Row = {
  id: string;
  slug: string;
  title: string;
  tags: string[];
  priceCents: number;
  currency: string;
  stock: number;
  city: string;
  publishedAt: Date | null;
  category: { slug: string; parent: { slug: string } | null };
  seller: { id: string; userId: string; displayName: string };
  media: {
    media: {
      storageKey: string;
      width: number;
      height: number;
      blurDataUrl: string | null;
      altText: string | null;
    };
  }[];
};

function toCandidate(row: Row): CandidateRow {
  const cover = row.media[0]?.media;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    tags: row.tags,
    priceCents: row.priceCents,
    currency: row.currency,
    stock: row.stock,
    city: row.city,
    categorySlug: row.category.slug,
    parentSlug: row.category.parent?.slug ?? null,
    sellerId: row.seller.id,
    sellerUserId: row.seller.userId,
    sellerName: row.seller.displayName,
    publishedAt: row.publishedAt,
    image: cover
      ? {
          url: getStorage().publicUrl(cover.storageKey),
          width: cover.width,
          height: cover.height,
          blurDataUrl: cover.blurDataUrl,
          alt: cover.altText,
        }
      : null,
  };
}

/** Lo que se puede vender hoy: activo, con existencias, visible y de una tienda activa. */
const SELLABLE = {
  status: "ACTIVE" as const,
  stock: { gt: 0 },
  ...VISIBLE_PRODUCT,
  seller: { status: "ACTIVE" as const },
};

/**
 * Productos de moda que pueden entrar en un look (P4: solo lo que se puede comprar hoy), de
 * cualquier vendedor menos quien pide el look. Acotado: los más recientes.
 */
export async function listLookCandidates({
  excludeUserId,
  limit = 300,
}: {
  excludeUserId: string | null;
  limit?: number;
}): Promise<CandidateRow[]> {
  const rows = await db.product.findMany({
    where: {
      ...SELLABLE,
      ...(excludeUserId ? { seller: { status: "ACTIVE", userId: { not: excludeUserId } } } : {}),
      OR: [
        { category: { slug: FASHION_ROOT_SLUG } },
        { category: { parent: { slug: FASHION_ROOT_SLUG } } },
      ],
      media: { some: {} },
    },
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
    select: candidateSelect,
  });
  return rows.map(toCandidate);
}

/** Un producto vendible por slug (para «Completa mi look» y Pruébatelo), o `null`. */
export async function getSellableProductBySlug(slug: string): Promise<CandidateRow | null> {
  const row = await db.product.findFirst({ where: { slug, ...SELLABLE }, select: candidateSelect });
  return row ? toCandidate(row) : null;
}

/** Productos vendibles por id, en ese orden (los que ya no se pueden comprar se omiten). */
export async function listSellableProductsByIds(ids: readonly string[]): Promise<CandidateRow[]> {
  if (ids.length === 0) return [];
  const rows = await db.product.findMany({
    where: { id: { in: [...ids] }, ...SELLABLE },
    select: candidateSelect,
  });
  const byId = new Map(rows.map((row) => [row.id, toCandidate(row)]));
  return ids.flatMap((id) => {
    const row = byId.get(id);
    return row ? [row] : [];
  });
}
