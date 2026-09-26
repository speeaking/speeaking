import type { Route } from "next";
import { redirect } from "next/navigation";
import { requireOnboardedViewer } from "@/modules/identity/session";

/** "Perfil" en la navegación: lleva al perfil público propio. */
export default async function MyProfilePage() {
  const viewer = await requireOnboardedViewer("/perfil");
  redirect(`/u/${viewer.profile.username}` as Route);
}
