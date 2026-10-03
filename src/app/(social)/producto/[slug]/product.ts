import "server-only";
import { cache } from "react";
import { getAdminViewer } from "@/modules/admin/guard";
import { getPublicProduct } from "@/modules/catalog/queries";
import { getViewer } from "@/modules/identity/session";

/**
 * El producto para quien pide la página: uno oculto por moderación solo existe para su dueño y el
 * equipo (para los demás es `null`, igual que uno inexistente). Una sola consulta por petición entre
 * el layout y la página (`cache`).
 */
export const getProductForViewer = cache(async (slug: string) => {
  const [viewer, admin] = await Promise.all([getViewer(), getAdminViewer()]);
  return getPublicProduct(slug, { viewerUserId: viewer?.userId ?? null, isAdmin: admin !== null });
});
