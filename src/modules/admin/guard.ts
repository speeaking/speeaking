import "server-only";
import { notFound } from "next/navigation";
import { getViewer, type Viewer } from "@/modules/identity/session";

/** Persona con sesión y rol ADMIN. */
export type AdminViewer = Viewer & {
  profile: NonNullable<Viewer["profile"]> & { role: "ADMIN" };
};

function isAdminViewer(viewer: Viewer | null): viewer is AdminViewer {
  return viewer?.profile?.role === "ADMIN";
}

/**
 * Para Server Actions y route handlers de administración: la persona si es ADMIN; si no, `null`
 * (la acción responde lo mismo que a una ruta inexistente). El rol se lee de la base en cada
 * petición (`getViewer`), así que quitarlo tiene efecto inmediato.
 */
export async function getAdminViewer(): Promise<AdminViewer | null> {
  const viewer = await getViewer();
  return isAdminViewer(viewer) ? viewer : null;
}

/**
 * Para páginas y layouts de `/admin`: 404 a quien no sea ADMIN, con o sin sesión, para no revelar
 * que el área existe (nada de redirigir a iniciar sesión). Cada página lo llama además del layout:
 * los layouts no se vuelven a renderizar al navegar entre páginas hermanas.
 */
export async function requireAdmin(): Promise<AdminViewer> {
  const admin = await getAdminViewer();
  if (!admin) notFound();
  return admin;
}
