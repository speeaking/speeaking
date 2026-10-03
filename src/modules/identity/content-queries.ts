import "server-only";
import type { Route } from "next";
import { db } from "@/server/db";
import type { OwnContentKind } from "./content-removal-types";

export const CONTENT_TABS = [
  { key: "publicaciones", label: "Publicaciones" },
  { key: "comentarios", label: "Comentarios" },
  { key: "productos", label: "Productos" },
  { key: "compras", label: "Compras" },
] as const;
export type ContentTab = (typeof CONTENT_TABS)[number]["key"];
export type OwnContentRow = {
  id: string;
  title: string;
  detail: string;
  kind: OwnContentKind;
  href?: Route;
  description?: string;
};

/** Solo datos de la cuenta autenticada; paginación por UUID, sin límite de antigüedad. */
export async function listOwnContent(userId: string, tab: ContentTab, before?: string) {
  const cursor = before ? { id: { lt: before } } : {};
  const page = { orderBy: { id: "desc" as const }, take: 26 };
  let items: OwnContentRow[];
  switch (tab) {
    case "publicaciones": {
      const rows = await db.post.findMany({
        where: { authorId: userId, status: { not: "REMOVED" }, ...cursor },
        ...page,
        select: { id: true, body: true, status: true, product: { select: { title: true } } },
      });
      items = rows.map((row) => ({
        id: row.id,
        title: row.body || row.product?.title || "Publicación",
        detail: row.status === "HIDDEN" ? "Oculta por moderación" : "En tu perfil",
        kind: "post",
        ...(row.status === "PUBLISHED" ? { href: `/p/${row.id}` as Route } : {}),
      }));
      break;
    }
    case "comentarios": {
      const rows = await db.comment.findMany({
        where: { authorId: userId, status: { not: "REMOVED" }, ...cursor },
        ...page,
        select: { id: true, body: true, postId: true },
      });
      items = rows.map((row) => ({
        id: row.id,
        title: row.body,
        detail: "Comentario propio",
        kind: "comment",
        href: `/p/${row.postId}` as Route,
      }));
      break;
    }
    case "productos": {
      const rows = await db.product.findMany({
        where: { seller: { userId }, status: { not: "ARCHIVED" }, ...cursor },
        ...page,
        select: { id: true, title: true, status: true },
      });
      items = rows.map((row) => ({
        id: row.id,
        title: row.title,
        detail: "Producto de tu tienda",
        kind: "product",
        href: `/studio/productos/${row.id}/editar` as Route,
        description:
          "El producto se retirará de tu tienda y sus publicaciones propias. Las compras ya realizadas conservarán su comprobante.",
      }));
      break;
    }
    case "compras": {
      const rows = await db.checkout.findMany({
        where: { buyerId: userId, buyerHiddenAt: null, ...cursor },
        ...page,
        select: { id: true, orders: { select: { items: { select: { titleSnapshot: true } } } } },
      });
      items = rows.map((row) => ({
        id: row.id,
        title:
          row.orders.flatMap((order) => order.items.map((item) => item.titleSnapshot)).join(", ") ||
          "Compra",
        detail: "En tu historial",
        kind: "purchase",
        href: `/pedidos/${row.id}` as Route,
        description:
          "La compra dejará de aparecer en tu historial. Si tiene una entrega pendiente, seguirá su curso. El vendedor conserva el comprobante.",
      }));
      break;
    }
  }
  return { items: items.slice(0, 25), next: items.length > 25 ? items[24]?.id : undefined };
}
