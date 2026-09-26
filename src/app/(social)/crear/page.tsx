import { ChevronRight, ImagePlus, Package, Sparkles } from "lucide-react";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { siteConfig } from "@/config/site";

export const metadata: Metadata = { title: "Crear" };

const options: { href: Route; title: string; description: string; icon: typeof Sparkles }[] = [
  {
    href: "/crear/publicacion",
    title: "Publicación",
    description: "Comparte una foto, una idea o una recomendación con tus comunidades.",
    icon: ImagePlus,
  },
  {
    href: "/studio/productos/nuevo",
    title: "Producto",
    description: "Publica algo que vendes con precio, inventario y envío.",
    icon: Package,
  },
];

export default function CreatePage() {
  return (
    <>
      <PageHeader title="Crear" description="¿Qué quieres compartir hoy?" />
      <div className="flex flex-col gap-3 px-4 md:px-0">
        <Link
          href="/studio/vende-con-ia"
          className="dark group relative overflow-hidden rounded-3xl border bg-card p-5 pr-12 text-foreground transition-transform active:scale-[0.99]"
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-ai px-2.5 py-1 text-xs font-bold text-ai-foreground">
            <Sparkles className="size-3.5" />
            {siteConfig.sellerFeatureName}
          </span>
          <p className="mt-4 font-heading text-2xl leading-tight font-extrabold">
            ¿Qué quieres vender hoy?
          </p>
          <p className="mt-1.5 max-w-xs text-sm text-muted-foreground">
            Cuéntale a la IA qué tienes y te arma el producto, el texto y la estrategia.
          </p>
          <ChevronRight className="absolute top-1/2 right-5 size-6 -translate-y-1/2 text-muted-foreground transition-transform group-hover:translate-x-1" />
        </Link>

        {options.map(({ href, title, description, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="group flex items-center gap-4 rounded-3xl border bg-card p-4 transition-colors hover:bg-secondary"
          >
            <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-accent text-accent-foreground">
              <Icon className="size-6" />
            </span>
            <span className="flex flex-col">
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
