import "server-only";
import { excerpt } from "@/modules/notifications/group";
import { notifyProductTagRemoved } from "@/modules/notifications/notify";
import { db } from "@/server/db";
import { getStorage } from "@/server/providers/storage";
import { METRIC_EVENT_TYPES, metricsByPost, type PostMetrics } from "./metrics";
import { tagDecision } from "./rules";

/**
 * Colaboraciones con creadores (ADR-063), etapa 1: sin dinero de por medio. Una tienda acepta que
 * otras personas etiqueten sus productos; quien publica y la tienda ven qué logró cada publicación
 * (visitas, pruebas, carritos y pedidos). La autorización vive aquí: cada función recibe quién la
 * pide y solo toca lo suyo.
 */

/** Pedidos que cuentan: pagados (con cobro real o simulado), enviados o entregados. */
const SOLD = ["PAID", "SHIPPED", "DELIVERED"] as const;
/** Publicaciones por panel (las más recientes). */
export const COLLABORATION_LIST_LIMIT = 50;

type PostRef = { id: string; productId: string };

/** Métricas de varias publicaciones con dos consultas agrupadas (índices por `sourcePostId`). */
async function loadMetrics(posts: readonly PostRef[]): Promise<Map<string, PostMetrics>> {
  if (posts.length === 0) return new Map();
  const ids = posts.map((post) => post.id);
  const [events, orders] = await Promise.all([
    db.analyticsEvent.groupBy({
      by: ["sourcePostId", "entityId", "type"],
      where: { sourcePostId: { in: ids }, type: { in: [...METRIC_EVENT_TYPES] } },
      _count: { _all: true },
    }),
    db.orderItem.groupBy({
      by: ["sourcePostId", "productId"],
      where: { sourcePostId: { in: ids }, order: { status: { in: [...SOLD] } } },
      _count: { _all: true },
      _sum: { quantity: true },
    }),
  ]);
  return metricsByPost(
    posts,
    events.map((row) => ({
      sourcePostId: row.sourcePostId,
      entityId: row.entityId,
      type: row.type,
      count: row._count._all,
    })),
    orders.map((row) => ({
      sourcePostId: row.sourcePostId,
      productId: row.productId,
      orders: row._count._all,
      units: row._sum.quantity ?? 0,
    })),
  );
}

type CollaborationPost = {
  postId: string;
  /** Principio del texto; `null` si la publicación no tiene texto. */
  excerpt: string | null;
  publishedAt: string;
  isVideo: boolean;
  /** Acuerdo declarado: la tarjeta dice «Colaboración». */
  collaboration: boolean;
  metrics: PostMetrics;
};

/** Una publicación propia que etiqueta el producto de otra tienda. Solo datos públicos y conteos. */
export type CreatorPostDTO = CollaborationPost & {
  product: { slug: string; title: string; storeName: string };
};

/** Lo que logró cada publicación de `userId` que etiqueta productos de OTRAS tiendas. */
export async function listCreatorPosts(userId: string): Promise<CreatorPostDTO[]> {
  const rows = await db.post.findMany({
    where: {
      authorId: userId,
      status: "PUBLISHED",
      product: { seller: { userId: { not: userId } } },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: COLLABORATION_LIST_LIMIT,
    select: {
      id: true,
      body: true,
      type: true,
      publishedAt: true,
      collaboration: true,
      product: {
        select: { id: true, slug: true, title: true, seller: { select: { displayName: true } } },
      },
    },
  });
  const posts = rows.flatMap((row) => (row.product ? [{ ...row, product: row.product }] : []));
  const metrics = await loadMetrics(
    posts.map((row) => ({ id: row.id, productId: row.product.id })),
  );
  return posts.map((row) => ({
    postId: row.id,
    excerpt: excerpt(row.body),
    publishedAt: row.publishedAt.toISOString(),
    isVideo: row.type === "VIDEO",
    collaboration: row.collaboration,
    product: {
      slug: row.product.slug,
      title: row.product.title,
      storeName: row.product.seller.displayName,
    },
    metrics: metrics.get(row.id)!,
  }));
}

/** Una publicación de otra persona que etiqueta un producto de la tienda. */
export type StoreCollaborationDTO = CollaborationPost & {
  author: { username: string; displayName: string; avatarUrl: string | null };
  product: { slug: string; title: string };
};

/** Publicaciones de otras personas que etiquetan productos de la tienda de `sellerUserId`. */
export async function listStoreCollaborations(
  sellerUserId: string,
): Promise<StoreCollaborationDTO[]> {
  const rows = await db.post.findMany({
    where: {
      status: "PUBLISHED",
      authorId: { not: sellerUserId },
      product: { seller: { userId: sellerUserId } },
    },
    orderBy: [{ publishedAt: "desc" }, { id: "desc" }],
    take: COLLABORATION_LIST_LIMIT,
    select: {
      id: true,
      body: true,
      type: true,
      publishedAt: true,
      collaboration: true,
      author: {
        select: { profile: { select: { username: true, displayName: true, avatarUrl: true } } },
      },
      product: { select: { id: true, slug: true, title: true } },
    },
  });
  const posts = rows.flatMap((row) =>
    row.product && row.author.profile
      ? [{ ...row, product: row.product, profile: row.author.profile }]
      : [],
  );
  const metrics = await loadMetrics(
    posts.map((row) => ({ id: row.id, productId: row.product.id })),
  );
  return posts.map((row) => ({
    postId: row.id,
    excerpt: excerpt(row.body),
    publishedAt: row.publishedAt.toISOString(),
    isVideo: row.type === "VIDEO",
    collaboration: row.collaboration,
    author: row.profile,
    product: { slug: row.product.slug, title: row.product.title },
    metrics: metrics.get(row.id)!,
  }));
}

/** ¿La tienda de esta persona acepta colaboraciones? `null` si no tiene tienda. */
export async function getAcceptsCollaborations(userId: string): Promise<boolean | null> {
  const seller = await db.sellerProfile.findUnique({
    where: { userId },
    select: { acceptsCollaborations: true },
  });
  return seller?.acceptsCollaborations ?? null;
}

/**
 * La tienda activa o desactiva las colaboraciones. Desactivarlas impide etiquetas NUEVAS; las que
 * ya existen se quedan hasta que la tienda las quite una por una (`removeProductTag`). Devuelve
 * `false` si la persona no tiene tienda.
 */
export async function setAcceptsCollaborations(userId: string, enabled: boolean): Promise<boolean> {
  const result = await db.sellerProfile.updateMany({
    where: { userId },
    data: { acceptsCollaborations: enabled },
  });
  return result.count > 0;
}

/**
 * La tienda quita la etiqueta de su producto de la publicación de otra persona: la publicación
 * sigue, ya sin el producto ni la marca de colaboración, y quien publicó recibe un aviso. Solo la
 * tienda dueña del producto puede hacerlo.
 */
export async function removeProductTag(sellerUserId: string, postId: string): Promise<boolean> {
  const where = {
    id: postId,
    authorId: { not: sellerUserId },
    product: { seller: { userId: sellerUserId } },
  };
  const post = await db.post.findFirst({ where, select: { id: true, authorId: true } });
  if (!post) return false;
  const result = await db.post.updateMany({
    where,
    data: { productId: null, collaboration: false },
  });
  if (result.count === 0) return false;
  await notifyProductTagRemoved({
    recipientId: post.authorId,
    actorId: sellerUserId,
    postId: post.id,
  });
  return true;
}

/**
 * Marcar una publicación como «Colaboración» (hay un acuerdo): lo puede hacer quien la publicó o la
 * tienda del producto etiquetado, siempre que el producto sea de una tienda distinta a quien
 * publicó. Solo se marca: la publicidad no se «desmarca».
 */
export async function markCollaboration(userId: string, postId: string): Promise<boolean> {
  const result = await db.post.updateMany({
    where: {
      id: postId,
      collaboration: false,
      OR: [
        { authorId: userId, product: { seller: { userId: { not: userId } } } },
        { authorId: { not: userId }, product: { seller: { userId } } },
      ],
    },
    data: { collaboration: true },
  });
  return result.count > 0;
}

/** El producto que alguien quiere etiquetar al crear una publicación (`?producto=<slug>`). */
export type TaggedProductDTO = {
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  currency: string;
  storeName: string;
  /** Es de quien publica (se etiqueta como siempre, sin declaración de acuerdo). */
  own: boolean;
  image: { url: string; width: number; height: number } | null;
};

/** `null` si no existe o si esa persona no puede etiquetarlo (`creators/rules.ts`). */
export async function findTaggableProduct(
  slug: string,
  viewerUserId: string,
): Promise<TaggedProductDTO | null> {
  const row = await db.product.findUnique({
    where: { slug },
    select: {
      id: true,
      slug: true,
      title: true,
      priceCents: true,
      currency: true,
      status: true,
      moderationStatus: true,
      seller: {
        select: { userId: true, status: true, acceptsCollaborations: true, displayName: true },
      },
      media: {
        orderBy: { position: "asc" },
        take: 1,
        select: { media: { select: { storageKey: true, width: true, height: true } } },
      },
    },
  });
  if (!row) return null;
  const decision = tagDecision(viewerUserId, row);
  if (!decision.ok) return null;
  const image = row.media[0]?.media ?? null;
  return {
    id: row.id,
    slug: row.slug,
    title: row.title,
    priceCents: row.priceCents,
    currency: row.currency,
    storeName: row.seller.displayName,
    own: decision.kind === "own",
    image: image
      ? { url: getStorage().publicUrl(image.storageKey), width: image.width, height: image.height }
      : null,
  };
}
