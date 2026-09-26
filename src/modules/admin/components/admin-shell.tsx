import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { siteConfig } from "@/config/site";
import { AdminSideNav, AdminTabs } from "./admin-nav";

/** Estructura de /admin: barra lateral en escritorio, pestañas en móvil (igual que el Studio). */
export function AdminShell({ children }: { children: ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-7xl">
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-6 border-r px-4 py-6 md:flex">
        <div className="flex flex-col gap-1 px-2">
          <Logo />
          <p className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">
            Administración
          </p>
        </div>
        <AdminSideNav />
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
            <p className="font-heading text-base font-bold">Administración</p>
            <ThemeToggle />
          </div>
          <AdminTabs />
        </header>
        <main id="contenido" className="w-full max-w-5xl min-w-0 px-4 py-6 md:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
