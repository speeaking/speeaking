import type { Route } from "next";
import Link from "next/link";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/** Enlaces legales y de confianza, en el orden en que la gente los busca (ADR-053). */
export const LEGAL_LINKS: readonly { href: Route; label: string }[] = [
  { href: "/como-funciona" as Route, label: "Cómo funciona" },
  { href: "/preguntas-frecuentes" as Route, label: "Preguntas frecuentes" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
  { href: "/cookies", label: "Cookies" },
  // Canal formal de avisos de la LFDA (art. 114 Octies, ADR-076): siempre a la vista.
  { href: "/derechos-de-autor" as Route, label: "Derechos de autor" },
  { href: "/precios", label: "Publicidad" },
  { href: "/seguridad", label: "Seguridad" },
  { href: "/apoya", label: "Apoya" },
];

/**
 * Pie legal (ADR-053): en escritorio vive al final de la columna derecha; en teléfono, al final de
 * Ajustes, para que nadie tenga que adivinar dónde están el aviso, los términos y las cookies.
 */
export function LegalFooter({ className }: { className?: string }) {
  return (
    <footer className={cn("px-2 text-xs leading-relaxed text-muted-foreground", className)}>
      <p>
        © {new Date().getFullYear()} {siteConfig.name} · Hecho en México
      </p>
      <p className="flex flex-wrap gap-x-3 gap-y-1">
        {LEGAL_LINKS.map((link) => (
          <Link key={link.href} href={link.href} className="hover:text-foreground hover:underline">
            {link.label}
          </Link>
        ))}
      </p>
    </footer>
  );
}
