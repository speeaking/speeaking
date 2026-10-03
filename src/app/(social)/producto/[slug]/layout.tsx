import { notFound } from "next/navigation";
import { getProductForViewer } from "./product";

/**
 * Si el producto no existe para quien mira (tampoco uno oculto, salvo para su dueño y el equipo), un
 * 404 de verdad: se comprueba aquí, antes del esqueleto (`loading.tsx`). Por qué en el layout:
 * `p/[id]/layout.tsx`.
 */
export default async function ProductLayout({ children, params }: LayoutProps<"/producto/[slug]">) {
  if (!(await getProductForViewer((await params).slug))) notFound();
  return children;
}
