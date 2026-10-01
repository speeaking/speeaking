import type { Route } from "next";
import { redirect } from "next/navigation";

/**
 * Los comentarios en página completa (recargar el panel o entrar por un enlace): la publicación,
 * con el cursor en «Escribe un comentario» (ADR-057). Desde el feed, la misma URL abre el panel.
 */
export default async function CommentsPage({ params }: PageProps<"/p/[id]/comentarios">) {
  const { id } = await params;
  redirect(`/p/${encodeURIComponent(id)}#comentar` as Route);
}
