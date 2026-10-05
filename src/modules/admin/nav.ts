import {
  FlaskConical,
  LayoutDashboard,
  Newspaper,
  Scale,
  ShieldAlert,
  Sparkles,
  UsersRound,
} from "lucide-react";
import type { Route } from "next";
import type { NavItem } from "@/config/navigation";

/**
 * Las secciones las construyen otros módulos; mientras no existan, su enlace da 404. `Route` se
 * fuerza porque las rutas tipadas solo conocen las páginas que ya existen.
 */
const adminRoute = (path: string) => path as Route;

/** Navegación del área de administración (solo se pinta para ADMIN, dentro de `requireAdmin`). */
export const adminNav: readonly NavItem[] = [
  { href: adminRoute("/admin"), label: "Resumen", icon: LayoutDashboard, match: "exact" },
  { href: adminRoute("/admin/usuarios"), label: "Usuarios", icon: UsersRound },
  { href: adminRoute("/admin/decisiones"), label: "Decisiones", icon: Scale },
  { href: adminRoute("/admin/experimentos"), label: "Experimentos", icon: FlaskConical },
  { href: adminRoute("/admin/moderacion"), label: "Moderación", icon: ShieldAlert },
  { href: adminRoute("/admin/redaccion"), label: "Redacción", icon: Newspaper },
  { href: adminRoute("/admin/ia"), label: "IA", icon: Sparkles },
];

/** La sección de IA lleva el acento de IA (lima), como en el Studio. */
export const ADMIN_AI_HREF = adminRoute("/admin/ia");
