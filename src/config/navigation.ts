import {
  Bookmark,
  ChartColumn,
  CircleUser,
  Clapperboard,
  Compass,
  House,
  LayoutDashboard,
  type LucideIcon,
  Megaphone,
  Package,
  Plus,
  ReceiptText,
  Shirt,
  ShoppingBag,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { Route } from "next";

export type NavItem = {
  href: Route;
  label: string;
  icon: LucideIcon;
  /** `exact`: solo esa ruta; `prefix` (por defecto): también sus subrutas. */
  match?: "exact" | "prefix";
  /** Otras secciones que pertenecen a esta pestaña (por prefijo), p. ej. `/c` en Descubrir. */
  also?: readonly string[];
  /** Activa también en el perfil público de quien navega (`/u/<su usuario>`). */
  ownProfile?: boolean;
};

/**
 * Barra inferior móvil: máximo 5 pestañas (docs/mvp-0.1.md → Pantallas). Cada pestaña agrupa sus
 * pantallas hijas para que la barra nunca se quede sin pestaña activa en una ruta anidada.
 */
export const socialNav: readonly NavItem[] = [
  { href: "/", label: "Inicio", icon: House, match: "exact" },
  { href: "/descubrir", label: "Descubrir", icon: Compass, also: ["/c", "/buscar"] },
  { href: "/crear", label: "Crear", icon: Plus },
  {
    href: "/comprar",
    label: "Comprar",
    icon: ShoppingBag,
    // El estilista, Pruébatelo, el saldo y los precios son parte de comprar (ADR-043, ADR-044).
    also: [
      "/producto",
      "/carrito",
      "/checkout",
      "/pedidos",
      "/estilista",
      "/probar",
      "/saldo",
      "/precios",
    ],
  },
  {
    href: "/perfil",
    label: "Perfil",
    icon: CircleUser,
    also: ["/ajustes", "/guardados"],
    ownProfile: true,
  },
];

/**
 * Columna izquierda de escritorio. "Crear" vive en la barra superior y "Perfil" en el menú del
 * avatar; aquí entran Guardados y Mis pedidos, que en móvil cuelgan de Perfil y Comprar.
 */
export const sideNav: readonly NavItem[] = [
  { href: "/", label: "Inicio", icon: House, match: "exact" },
  { href: "/descubrir", label: "Descubrir", icon: Compass, also: ["/c", "/buscar"] },
  {
    href: "/comprar",
    label: "Comprar",
    icon: ShoppingBag,
    also: ["/producto", "/carrito", "/checkout", "/saldo", "/precios"],
  },
  { href: "/estilista", label: "Estilista", icon: Shirt, also: ["/probar"] },
  { href: "/guardados", label: "Guardados", icon: Bookmark },
  { href: "/pedidos", label: "Mis pedidos", icon: ReceiptText },
];

/** Panel del vendedor (Studio). */
export const studioNav: readonly NavItem[] = [
  { href: "/studio", label: "Resumen", icon: LayoutDashboard, match: "exact" },
  { href: "/studio/productos", label: "Productos", icon: Package },
  { href: "/studio/contenido", label: "Contenido", icon: Clapperboard },
  { href: "/studio/sube-y-vende", label: "Sube y vende", icon: Sparkles },
  { href: "/studio/campanas", label: "Campañas", icon: Megaphone },
  { href: "/studio/saldo", label: "Saldo", icon: Wallet },
  { href: "/studio/pedidos", label: "Pedidos", icon: ReceiptText },
  { href: "/studio/analitica", label: "Analítica", icon: ChartColumn },
];

/**
 * Rejilla de escritorio que comparten la barra superior y el contenido, para que el logo quede
 * sobre la columna izquierda, la búsqueda sobre el feed y las acciones sobre la columna derecha.
 * md: íconos (72) + feed · lg: columna izquierda (232) + feed (680) · xl: + columna derecha (320).
 */
export const shellGrid =
  "mx-auto w-full max-w-[1352px] md:grid md:grid-cols-[72px_minmax(0,680px)] md:justify-center md:gap-7 md:px-6 lg:grid-cols-[232px_minmax(0,680px)] xl:grid-cols-[232px_minmax(0,680px)_320px]";

function matchesPrefix(pathname: string, prefix: string) {
  return pathname === prefix || pathname.startsWith(`${prefix}/`);
}

/**
 * ¿La ruta actual pertenece a esta pestaña? `viewerUsername` permite marcar Perfil en el perfil
 * público propio (los usuarios se guardan en minúsculas; la URL puede venir con mayúsculas).
 */
export function isNavItemActive(
  pathname: string,
  item: Pick<NavItem, "href" | "match" | "also" | "ownProfile">,
  viewerUsername?: string | null,
) {
  if (item.match === "exact") return pathname === item.href;
  if (matchesPrefix(pathname, item.href)) return true;
  if (item.also?.some((prefix) => matchesPrefix(pathname, prefix))) return true;
  if (item.ownProfile && viewerUsername) {
    let path = pathname;
    try {
      path = decodeURIComponent(pathname);
    } catch {
      // Una URL mal codificada no es el perfil propio.
    }
    return matchesPrefix(path.toLowerCase(), `/u/${viewerUsername.toLowerCase()}`);
  }
  return false;
}
