import { Handshake, ImagePlus, type LucideIcon, Package, Sparkles } from "lucide-react";
import type { Route } from "next";
import { siteConfig } from "./site";

export type CreateOption = { href: Route; title: string; description: string; icon: LucideIcon };

/**
 * Lo que se puede crear (ADR-042): red social primero, compartir va antes que vender. Lo usan la
 * página /crear y el menú «Crear» de las barras (ADR-068).
 */
export const CREATE_OPTIONS: readonly CreateOption[] = [
  {
    href: "/crear/publicacion",
    title: "Publicación",
    description: "Tu día, una experiencia, una noticia o una foto para tus comunidades.",
    icon: ImagePlus,
  },
  {
    href: "/creadores",
    title: "Recomendar un producto",
    description: "Publica una foto o un video con el producto de una tienda y mira qué logra.",
    icon: Handshake,
  },
  {
    href: siteConfig.sellerFeaturePath as Route,
    title: siteConfig.sellerFeatureName,
    description: "Sube una foto y pon tu precio: te armamos la publicación y tus números.",
    icon: Sparkles,
  },
  {
    href: "/studio/productos/nuevo",
    title: "Producto a mano",
    description: "Publica algo que vendes con precio, inventario y envío, campo por campo.",
    icon: Package,
  },
];
