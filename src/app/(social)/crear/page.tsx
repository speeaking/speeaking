import { ChevronRight, ImagePlus, Package, Sparkles } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Crear" };

const options: { href: Route; title: string; description: string; icon: typeof Sparkles }[] = [
  {
    href: siteConfig.sellerFeaturePath,
    title: siteConfig.sellerFeatureName,
    description: "Sube una foto y pon tu precio: te armamos la publicación y tus números.",
    icon: Sparkles,
  },
  {
    href: "/crear/publicacion",
    title: "Publicación",
    description: "Comparte una foto, una idea o una recomendación con tus comunidades.",
    icon: ImagePlus,
  },
  {
    href: "/studio/productos/nuevo",
    title: "Producto a mano",
    description: "Publica algo que vendes con precio, inventario y envío, campo por campo.",
    icon: Package,
  },
];

/** Crear (ADR-042): tres opciones iguales, sin bloque oscuro ni distintivo de IA. */
export default function CreatePage() {
  return (
    <>
      <PageHeader title="Crear" description="¿Qué quieres compartir hoy?" />
      <div className="flex flex-col gap-3 px-4 md:px-0">
        {options.map(({ href, title, description, icon: Icon }) => (
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
