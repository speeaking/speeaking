import { notFound } from "next/navigation";
import { getProfile } from "./profile";

/**
 * Si el perfil no existe, un 404 de verdad (también en seguidores y siguiendo): se comprueba aquí,
 * antes del esqueleto del perfil (`loading.tsx`). Por qué en el layout: `p/[id]/layout.tsx`.
 */
export default async function ProfileLayout({ children, params }: LayoutProps<"/u/[username]">) {
  if (!(await getProfile((await params).username))) notFound();
  return children;
}
