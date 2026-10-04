import "server-only";
import { cache } from "react";
import { loadPost } from "@/modules/social/components/post-detail";
import { getViewer } from "@/modules/identity/session";

/**
 * La publicación autorizada para la sesión actual. Una sola consulta por petición entre el layout
 * y sus rutas hijas; seguir o comprar no habilita publicaciones personales.
 */
export const getVisiblePost = cache(async (id: string) =>
  loadPost(id, (await getViewer())?.userId ?? null),
);
/** Los metadatos compartidos nunca contienen publicaciones personales, incluso con sesión. */
export const getPublicPost = cache((id: string) => loadPost(id, null));
