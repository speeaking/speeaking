import {
  Bookmark,
  ChartColumn,
  CircleUser,
  Clapperboard,
  Compass,
  Handshake,
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
  Users,
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
  // La sección de creadores (ADR-063) cuelga de Crear.
  { href: "/crear", label: "Crear", icon: Plus, also: ["/creadores"] },
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
    also: ["/ajustes", "/guardados", "/mensajes", "/personas"],
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
  { href: "/personas" as Route, label: "Mis amigos", icon: Users },
  { href: "/pedidos", label: "Mis pedidos", icon: ReceiptText },
];

/** Panel del vendedor (Studio). */
export const studioNav: readonly NavItem[] = [
  { href: "/studio", label: "Resumen", icon: LayoutDashboard, match: "exact" },
  { href: "/studio/productos", label: "Productos", icon: Package },
  { href: "/studio/contenido", label: "Contenido", icon: Clapperboard },
  { href: "/studio/sube-y-vende", label: "Sube y vende", icon: Sparkles },
  { href: "/studio/campanas", label: "Campañas", icon: Megaphone },
  { href: "/studio/colaboraciones", label: "Colaboraciones", icon: Handshake },
  { href: "/studio/saldo", label: "Saldo", icon: Wallet },
  { href: "/studio/pedidos", label: "Pedidos", icon: ReceiptText },
  { href: "/studio/analitica", label: "Analítica", icon: ChartColumn },
];

/**
 * Rejilla de escritorio que comparten la barra superior y el contenido, para que el logo quede
 * sobre la columna izquierda, la búsqueda sobre el feed y las acciones sobre la columna derecha.
 * Las columnas laterales van pegadas a los bordes de la ventana (ADR-048, como Facebook) y el feed
 * se centra solo en el espacio que queda (`shellMain`): md: íconos (72) + feed · lg con la columna
 * abierta (`nav-open:`): 232 + feed · xl: + columna derecha (320). Plegada, en escritorio también
 * son 72 px.
 */
export const shellGrid =
  "w-full md:grid md:grid-cols-[72px_minmax(0,1fr)] md:gap-7 md:px-6 xl:grid-cols-[72px_minmax(0,1fr)_320px] nav-open:grid-cols-[232px_minmax(0,1fr)] nav-open:xl:grid-cols-[232px_minmax(0,1fr)_320px]";

/** El feed y la búsqueda: centrados en la columna de en medio, con el ancho de lectura de siempre. */
export const shellMain = "md:mx-auto md:w-full md:max-w-[680px]";

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
