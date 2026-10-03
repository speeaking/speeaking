import "server-only";
import { cache } from "react";
import { loadPost } from "@/modules/social/components/post-detail";

/**
 * La publicación como la ve cualquiera: quién puede verla (publicada y sin un producto oculto) no
 * depende de quién mira. Una sola consulta por petición entre el layout y los metadatos (`cache`).
 */
export const getVisiblePost = cache((id: string) => loadPost(id, null));
