import { notFound } from "next/navigation";
import { getCommunity } from "./community";

/**
 * Si la comunidad no existe, un 404 de verdad: se comprueba aquí, antes del esqueleto
 * (`loading.tsx`). Por qué en el layout: `p/[id]/layout.tsx`.
 */
export default async function CommunityLayout({ children, params }: LayoutProps<"/c/[slug]">) {
  if (!(await getCommunity((await params).slug))) notFound();
  return children;
}
