import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { unstable_rethrow } from "next/navigation";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { siteConfig } from "@/config/site";
import { ConsentBanner } from "@/modules/identity/components/consent-banner";
import {
  getPendingLegalDocuments,
  type PendingLegalDocument,
} from "@/modules/identity/consent-refresh";
import { acceptUpdatedLegalAction } from "@/modules/identity/privacy-actions";
import { getViewer } from "@/modules/identity/session";
import { StudioSideNav, StudioTabs } from "./studio-nav";

/**
 * Estructura del panel del vendedor: barra lateral en escritorio, pestañas en móvil. Arriba, el mismo
 * aviso de documentos legales actualizados que en la red social (`app-shell.tsx`).
 */
export function StudioShell({ children }: { children: ReactNode }) {
  return (
    <>
      <LegalUpdateNotice />
      <div className="mx-auto flex min-h-dvh max-w-7xl">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r px-4 py-6 md:flex">
          <div className="flex flex-col gap-1 px-2">
            <Logo />
            <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
              Studio
            </p>
          </div>
          <StudioSideNav />
          <div className="mt-auto flex items-center justify-between px-2">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Volver a {siteConfig.name}
            </Link>
            <ThemeToggle />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 border-b bg-background/85 backdrop-blur-xl md:hidden">
            <div className="flex h-14 items-center justify-between px-4">
              <Link href="/" aria-label={`Volver a ${siteConfig.name}`} className="p-1">
                <ArrowLeft className="size-5" />
              </Link>
              <p className="font-heading text-base font-bold">Studio</p>
              <ThemeToggle />
            </div>
            <StudioTabs />
          </header>
          <main id="contenido" className="w-full max-w-5xl min-w-0 px-4 py-6 md:px-8">
            {children}
          </main>
        </div>
      </div>
    </>
  );
}

/**
 * Aviso para volver a aceptar el aviso de privacidad o los términos (`identity/consent-refresh.ts`):
 * solo con sesión y si la persona aceptó una versión anterior. No es indispensable: si la consulta
 * falla, el Studio se muestra sin él.
 */
async function LegalUpdateNotice() {
  let documents: PendingLegalDocument[] = [];
  try {
    const viewer = await getViewer();
    if (viewer) documents = await getPendingLegalDocuments(viewer.userId);
  } catch (error) {
    // `getViewer` lee cookies y cabeceras: lo que Next lanza a propósito (p. ej. al intentar
    // prerenderizar) no es una falla y debe seguir su camino.
    unstable_rethrow(error);
    console.error("[identity] no se pudo revisar la versión de los documentos aceptados", error);
  }
  if (documents.length === 0) return null;
  return <ConsentBanner documents={documents} action={acceptUpdatedLegalAction} />;
}
