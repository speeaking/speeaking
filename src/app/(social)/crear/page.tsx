import { ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { CREATE_OPTIONS } from "@/config/create-options";

export const metadata: Metadata = { title: "Crear" };

/**
 * Crear (ADR-042): opciones iguales, sin bloque oscuro ni distintivo de IA; compartir primero. Las
 * barras abren las mismas opciones en un menú ahí mismo (ADR-068); esta página queda para los
 * enlaces directos.
 */
export default function CreatePage() {
  return (
    <>
      <PageHeader title="Crear" description="¿Qué quieres compartir hoy?" />
      <div className="flex flex-col gap-3 px-4 md:px-0">
        {CREATE_OPTIONS.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-3xl border bg-card p-4 transition-colors hover:bg-secondary"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-secondary text-ink-2">
              <Icon className="size-6" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="font-heading text-lg font-bold">{title}</span>
              <span className="text-sm text-muted-foreground">{description}</span>
            </span>
            <ChevronRight className="ml-auto size-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1" />
          </Link>
        ))}
      </div>
    </>
  );
}
