import { describe, expect, it } from "vitest";
import { isNavItemActive, type NavItem, sideNav, socialNav, studioNav } from "./navigation";

function byLabel(items: readonly NavItem[], label: string) {
  const item = items.find((candidate) => candidate.label === label);
  if (!item) throw new Error(`Falta la pestaña ${label}`);
  return item;
}

/** Pestañas activas para una ruta (debe haber exactamente una en las rutas conocidas). */
function activeLabels(items: readonly NavItem[], pathname: string, username?: string | null) {
  return items
    .filter((item) => isNavItemActive(pathname, item, username))
    .map((item) => item.label);
}

describe("isNavItemActive", () => {
  it("con match exacto solo activa la ruta idéntica", () => {
    const home = { href: "/" as const, match: "exact" as const };

    expect(isNavItemActive("/", home)).toBe(true);
    expect(isNavItemActive("/descubrir", home)).toBe(false);
  });

  it("con match por prefijo activa subrutas pero no rutas con prefijo parecido", () => {
    const products = { href: "/studio/productos" as const };

    expect(isNavItemActive("/studio/productos", products)).toBe(true);
    expect(isNavItemActive("/studio/productos/nuevo", products)).toBe(true);
    expect(isNavItemActive("/studio/productos-archivados", products)).toBe(false);
  });

  it("el resumen del Studio no queda activo en sus secciones", () => {
    const summary = studioNav[0]!;

    expect(isNavItemActive("/studio/pedidos", summary)).toBe(false);
  });

  it("las secciones hijas (`also`) respetan el límite de segmento", () => {
    const discover = byLabel(socialNav, "Descubrir");

    expect(isNavItemActive("/c/gaming", discover)).toBe(true);
    expect(isNavItemActive("/c", discover)).toBe(true);
    expect(isNavItemActive("/carrito", discover)).toBe(false);
  });
});

describe("barra inferior (móvil)", () => {
  it("tiene como máximo 5 pestañas", () => {
    expect(socialNav.length).toBeLessThanOrEqual(5);
  });

  it.each([
    ["/", "Inicio"],
    ["/descubrir", "Descubrir"],
    ["/c/gaming", "Descubrir"],
    ["/buscar", "Descubrir"],
    ["/crear/publicacion", "Crear"],
    ["/comprar", "Comprar"],
    ["/producto/audifonos-pro", "Comprar"],
    ["/carrito", "Comprar"],
    ["/checkout", "Comprar"],
    ["/checkout/pago/mock_123", "Comprar"],
    ["/pedidos", "Comprar"],
    ["/pedidos/0199a0b2-0000-7000-8000-000000000000", "Comprar"],
    ["/perfil", "Perfil"],
    ["/ajustes", "Perfil"],
    ["/guardados", "Perfil"],
  ])("en %s marca solo %s", (pathname, label) => {
    expect(activeLabels(socialNav, pathname, "sofia")).toEqual([label]);
  });

  it("marca Perfil en el perfil propio, aunque la URL cambie mayúsculas", () => {
    expect(activeLabels(socialNav, "/u/sofia", "sofia")).toEqual(["Perfil"]);
    expect(activeLabels(socialNav, "/u/Sofia", "sofia")).toEqual(["Perfil"]);
  });

  it("no marca Perfil en el perfil de otra persona ni sin sesión", () => {
    expect(activeLabels(socialNav, "/u/sofiaramos", "sofia")).toEqual([]);
    expect(activeLabels(socialNav, "/u/ana", "sofia")).toEqual([]);
    expect(activeLabels(socialNav, "/u/sofia")).toEqual([]);
    expect(activeLabels(socialNav, "/u/sofia", null)).toEqual([]);
  });

  it("una URL mal codificada no rompe la navegación", () => {
    expect(activeLabels(socialNav, "/u/%E0%A4%A", "sofia")).toEqual([]);
  });
});

describe("columna izquierda (escritorio)", () => {
  it("lleva Inicio, Descubrir, Comprar, Guardados y Mis pedidos, en ese orden", () => {
    expect(sideNav.map((item) => item.label)).toEqual([
      "Inicio",
      "Descubrir",
      "Comprar",
      "Guardados",
      "Mis pedidos",
    ]);
  });

  it.each([
    ["/", "Inicio"],
    ["/c/deportes", "Descubrir"],
    ["/producto/tenis", "Comprar"],
    ["/carrito", "Comprar"],
    ["/checkout", "Comprar"],
    ["/guardados", "Guardados"],
    ["/pedidos", "Mis pedidos"],
    ["/pedidos/0199a0b2-0000-7000-8000-000000000000", "Mis pedidos"],
  ])("en %s marca solo %s", (pathname, label) => {
    expect(activeLabels(sideNav, pathname, "sofia")).toEqual([label]);
  });

  it("no marca nada en pantallas que viven fuera de la columna", () => {
    expect(activeLabels(sideNav, "/ajustes", "sofia")).toEqual([]);
    expect(activeLabels(sideNav, "/u/sofia", "sofia")).toEqual([]);
  });
});
