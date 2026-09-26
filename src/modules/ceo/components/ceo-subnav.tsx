import type { Route } from "next";
import Link from "next/link";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/admin/resumen", label: "Reporte semanal" },
  { href: "/admin/decisiones", label: "Decisiones" },
  { href: "/admin/experimentos", label: "Experimentos" },
] as const;

/** Navegación entre las tres vistas del motor de automejora. */
export function CeoSubnav({ current }: { current: (typeof LINKS)[number]["href"] }) {
  return (
    <nav aria-label="Motor de automejora" className="-mx-1 scrollbar-none overflow-x-auto">
      <ul className="flex w-max gap-2 px-1">
        {LINKS.map((link) => (
          <li key={link.href}>
            <Link
              href={link.href as Route}
              aria-current={link.href === current ? "page" : undefined}
              className={cn(
                "block rounded-full border px-3.5 py-1.5 text-sm font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
                link.href === current &&
                  "border-foreground bg-foreground text-background hover:text-background",
              )}
            >
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
