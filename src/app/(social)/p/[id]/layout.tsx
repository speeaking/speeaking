import { notFound } from "next/navigation";
import { getVisiblePost } from "./post";

/**
 * Si la publicación no existe (o nadie puede verla), un 404 de verdad. Next solo puede poner el
 * código de estado antes de empezar a mandar la respuesta, y un esqueleto (`loading.tsx`, un
 * `<Suspense>`) la empieza: por eso la comprobación va en el layout, por encima de cualquier
 * esqueleto del segmento, y cubre también /p/[id]/comentarios. Lo mismo hacen `/u/[username]`,
 * `/producto/[slug]` y `/c/[slug]`.
 *
 * Ojo: `(social)/loading.tsx` envuelve también este layout. Mientras siga ahí, la respuesta ya va
 * en streaming cuando llega `notFound()` y el 404 sale como 200 con `noindex`.
 */
export default async function PostLayout({ children, params }: LayoutProps<"/p/[id]">) {
  if (!(await getVisiblePost((await params).id))) notFound();
  return children;
}
