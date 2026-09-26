import type { Metadata } from "next";
import type { ReactNode } from "react";
import { AdminShell } from "@/modules/admin/components/admin-shell";
import { getAdminViewer, requireAdmin } from "@/modules/admin/guard";
import { ConsentBanner } from "@/modules/identity/components/consent-banner";
import {
  getPendingLegalDocuments,
  type PendingLegalDocument,
} from "@/modules/identity/consent-refresh";
import { acceptUpdatedLegalAction } from "@/modules/identity/privacy-actions";

const NOINDEX = { index: false, follow: false, nocache: true } as const;

/**
 * Metadatos solo para ADMIN: a cualquier otra persona esta ruta le responde el mismo 404 que una
 * inexistente (que ya lleva `noindex`), sin título ni etiquetas que delaten el área.
 */
export async function generateMetadata(): Promise<Metadata> {
  const admin = await getAdminViewer();
  return admin
    ? { title: { default: "Administración", template: "%s · Administración" }, robots: NOINDEX }
    : {};
}

/**
 * Área del equipo (rol ADMIN). El layout oculta la estructura a quien no lo es, pero NO es la
 * barrera: cada página vuelve a llamar `requireAdmin()` y cada servicio `assertAdmin()`. Arriba, el
 * mismo aviso de documentos legales actualizados que en la red social (`app-shell.tsx`).
 */
export default async function AdminLayout({ children }: { children: ReactNode }) {
  const admin = await requireAdmin();
  return (
    <>
      <LegalUpdateNotice userId={admin.userId} />
      <AdminShell>{children}</AdminShell>
    </>
  );
}

/**
 * Aviso para volver a aceptar el aviso de privacidad o los términos (`identity/consent-refresh.ts`)
 * si la persona aceptó una versión anterior. No es indispensable: si la consulta falla, el área se
 * muestra sin él.
 */
async function LegalUpdateNotice({ userId }: { userId: string }) {
  let documents: PendingLegalDocument[] = [];
  try {
    documents = await getPendingLegalDocuments(userId);
  } catch (error) {
    console.error("[identity] no se pudo revisar la versión de los documentos aceptados", error);
  }
  if (documents.length === 0) return null;
  return <ConsentBanner documents={documents} action={acceptUpdatedLegalAction} />;
}
