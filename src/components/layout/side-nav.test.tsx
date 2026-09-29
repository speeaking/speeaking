import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NavCommunities, ViewerSummary } from "@/modules/identity/viewer-summary";
import { SideNav, unreadLabel, unreadSpokenLabel } from "./side-nav";

const navigation = vi.hoisted(() => ({ pathname: "/" }));

vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("@/modules/social/components/join-button", () => ({
  JoinButton: () => <button type="button">Unirme</button>,
}));

type Viewer = NonNullable<ViewerSummary>;

function viewerWith(communities: Viewer["communities"]): Viewer {
  return {
    username: "sofia",
    displayName: "Sofía Ramos",
    avatarUrl: null,
    isSeller: false,
    onboarded: true,
    cartCount: 0,
    communities,
  };
}

const noSuggestions: NavCommunities = { total: 12, items: [] };

const withNews = () =>
  viewerWith([
    { slug: "gaming", name: "Gaming", emoji: "🎮", hue: 285, unread: 1 },
    { slug: "deportes", name: "Deportes", emoji: "⚽", hue: 145, unread: 4 },
    { slug: "comida", name: "Comida", emoji: "🌮", hue: 35, unread: 100 },
    { slug: "moda", name: "Moda", emoji: "👟", hue: 12 },
  ]);

const yourCommunities = () => screen.getByRole("region", { name: "Tus comunidades" });

beforeEach(() => {
  navigation.pathname = "/";
});

describe("unreadLabel", () => {
  it.each([
    [1, "1 nueva"],
    [2, "2 nuevas"],
    [99, "99 nuevas"],
    [100, "99+ nuevas"],
  ])("%i → «%s»", (count, label) => {
    expect(unreadLabel(count)).toBe(label);
  });
});

describe("unreadSpokenLabel", () => {
  it.each([
    [1, "1 publicación nueva"],
    [2, "2 publicaciones nuevas"],
    [99, "99 publicaciones nuevas"],
    [100, "más de 99 publicaciones nuevas"],
  ])("%i → «%s»", (count, label) => {
    expect(unreadSpokenLabel(count)).toBe(label);
  });
});

describe("SideNav · novedades por comunidad (F7)", () => {
  it("dice cuántas nuevas hay y no muestra nada en cero", () => {
    render(<SideNav viewer={withNews()} communities={noSuggestions} />);

    const yours = yourCommunities();
    // El conteo es parte del nombre accesible, sin abreviar; a la vista sigue corto («1 nueva»).
    const gaming = within(yours).getByRole("link", { name: "Gaming, 1 publicación nueva" });
    expect(gaming.querySelector('[data-slot="unread"]')).toHaveTextContent(/^1 nueva$/);
    // Columna de íconos (md): un punto en tinta, con contraste en cualquier tono.
    expect(gaming.querySelector('[data-slot="unread-dot"]')).toHaveClass("bg-foreground");
    expect(
      within(yours).getByRole("link", { name: "Deportes, 4 publicaciones nuevas" }),
    ).toBeInTheDocument();
    expect(
      within(yours).getByRole("link", { name: "Comida, más de 99 publicaciones nuevas" }),
    ).toBeInTheDocument();
    // Sin novedades: solo el nombre, ni «0 nuevas» ni punto.
    const moda = within(yours).getByRole("link", { name: "Moda" });
    expect(moda.querySelector('[data-slot="unread"]')).toBeNull();
    expect(moda.querySelector(".community-bar")).toBeNull();
    expect(moda.querySelector('[data-slot="unread-dot"]')).toBeNull();
    expect(within(yours).queryByText(/0 nuevas/)).toBeNull();
  });

  it("el conteo va en el color de la comunidad (tono en la fila)", () => {
    render(<SideNav viewer={withNews()} communities={noSuggestions} />);

    const gaming = within(yourCommunities()).getByRole("link", {
      name: "Gaming, 1 publicación nueva",
    });
    expect(gaming.style.getPropertyValue("--hue")).toBe("285");
    expect(gaming.querySelector('[data-slot="unread"]')).toHaveClass("text-muted-foreground");
  });

  it("dentro de la comunidad ya no cuenta, y tampoco al volver (el layout no se vuelve a pintar)", () => {
    navigation.pathname = "/c/gaming";
    const viewer = withNews();
    const { rerender } = render(<SideNav viewer={viewer} communities={noSuggestions} />);

    expect(within(yourCommunities()).getByRole("link", { name: "Gaming" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    // Navegación del cliente de vuelta al inicio: mismas props (mismo resumen del servidor).
    navigation.pathname = "/";
    rerender(<SideNav viewer={viewer} communities={noSuggestions} />);
    const yours = yourCommunities();
    expect(within(yours).getByRole("link", { name: "Gaming" })).toBeInTheDocument();
    // Las demás siguen igual.
    expect(
      within(yours).getByRole("link", { name: "Deportes, 4 publicaciones nuevas" }),
    ).toBeInTheDocument();
  });

  it("con un resumen nuevo del servidor vuelve a confiar en sus números", () => {
    navigation.pathname = "/c/gaming";
    const { rerender } = render(<SideNav viewer={withNews()} communities={noSuggestions} />);
    navigation.pathname = "/";
    rerender(<SideNav viewer={withNews()} communities={noSuggestions} />);

    // Otro resumen (p. ej. después de unirse a algo): llegó una nueva en Gaming desde la visita.
    expect(
      within(yourCommunities()).getByRole("link", { name: "Gaming, 1 publicación nueva" }),
    ).toBeInTheDocument();
  });
});
