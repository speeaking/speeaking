import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NavCommunities, ViewerSummary } from "@/modules/identity/viewer-summary";
import { BottomNav } from "./bottom-nav";
import { SideNav } from "./side-nav";
import { TopBar } from "./top-bar";

const navigation = vi.hoisted(() => ({ pathname: "/", search: "" }));

vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("next/form", () => ({
  default: ({ action, children, ...props }: ComponentProps<"form"> & { action: string }) => (
    <form action={action} {...props}>
      {children}
    </form>
  ),
}));
// Las acciones reales viven en el servidor (sesión, base de datos): aquí no se ejecutan.
vi.mock("@/modules/identity/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/modules/notifications/actions", () => ({
  loadNotificationsAction: vi.fn(async () => []),
  markNotificationsReadAction: vi.fn(async () => 0),
}));
vi.mock("@/modules/trust/actions", () => ({ reportAction: vi.fn(async () => ({})) }));
vi.mock("@/modules/messages/actions", () => ({
  loadInboxAction: vi.fn(async () => []),
  loadThreadAction: vi.fn(async () => null),
  sendMessageAction: vi.fn(async () => ({})),
  setMessagesBlockedAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/modules/social/components/join-button", () => ({
  JoinButton: () => <button type="button">Unirme</button>,
}));

const community = (slug: string, name: string, hue: number) => ({
  id: `0199a000-0000-7000-8000-${String(hue).padStart(12, "0")}`,
  slug,
  name,
  emoji: "⭐",
  hue,
});

const viewer: NonNullable<ViewerSummary> = {
  username: "sofia",
  displayName: "Sofía Ramos",
  avatarUrl: null,
  isSeller: false,
  onboarded: true,
  cartCount: 2,
  unreadMessages: 0,
  unreadNotifications: 0,
  communities: [
    { slug: "gaming", name: "Gaming", emoji: "🎮", hue: 285 },
    { slug: "deportes", name: "Deportes", emoji: "⚽", hue: 145 },
  ],
};

const suggestions: NavCommunities = {
  total: 12,
  items: [community("mascotas", "Mascotas", 60), community("comida", "Comida", 35)],
};

beforeEach(() => {
  navigation.pathname = "/";
  navigation.search = "";
});

describe("BottomNav", () => {
  it.each([
    ["/c/gaming", "Descubrir"],
    ["/producto/tenis", "Comprar"],
    ["/checkout", "Comprar"],
    ["/pedidos/123", "Comprar"],
    ["/ajustes", "Perfil"],
    ["/u/sofia", "Perfil"],
  ])("en %s marca %s", (pathname, label) => {
    navigation.pathname = pathname;
    render(<BottomNav viewer={viewer} />);

    const current = screen.getAllByRole("link").filter((link) => link.ariaCurrent === "page");
    expect(current).toHaveLength(1);
    expect(current[0]).toHaveAccessibleName(label);
  });

  it("muestra el avatar de quien navega en Perfil (y el ícono si no hay sesión)", () => {
    const { container, rerender } = render(<BottomNav viewer={viewer} />);
    const profile = screen.getByRole("link", { name: "Perfil" });
    expect(within(profile).getByText("SR")).toBeInTheDocument();
    expect(container.querySelectorAll("svg")).toHaveLength(4);

    rerender(<BottomNav viewer={null} />);
    expect(within(screen.getByRole("link", { name: "Perfil" })).queryByText("SR")).toBeNull();
  });

  it("con sesión, «Crear» abre sus opciones ahí mismo; sin sesión lleva a /crear", async () => {
    const { unmount } = render(<BottomNav viewer={viewer} />);
    await userEvent.click(screen.getByRole("button", { name: "Crear" }));
    expect(await screen.findByRole("menuitem", { name: /^Publicación/ })).toHaveAttribute(
      "href",
      "/crear/publicacion",
    );
    unmount();

    render(<BottomNav viewer={null} />);
    expect(screen.getByRole("link", { name: "Crear" })).toHaveAttribute("href", "/crear");
  });
});

describe("SideNav", () => {
  it("con sesión: navegación completa, tus comunidades, para descubrir y para vender", () => {
    navigation.pathname = "/c/gaming";
    render(<SideNav viewer={viewer} communities={suggestions} />);

    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Inicio", "Descubrir", "Comprar", "Estilista", "Guardados", "Mis pedidos"]);
    expect(within(nav).getByRole("link", { name: "Descubrir" })).toHaveAttribute(
      "aria-current",
      "page",
    );

    const yours = screen.getByRole("region", { name: "Tus comunidades" });
    expect(within(yours).getByRole("link", { name: "Gaming" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(within(yours).getByRole("link", { name: "Editar" })).toHaveAttribute(
      "href",
      "/descubrir",
    );

    const discover = screen.getByRole("region", { name: "Para descubrir" });
    expect(within(discover).getByRole("link", { name: "Ver las 12" })).toBeInTheDocument();
    expect(within(discover).getAllByRole("button", { name: "Unirme" })).toHaveLength(2);

    const sell = screen.getByRole("region", { name: "Para vender" });
    expect(within(sell).getByRole("link", { name: "Sube y vende" })).toHaveAttribute(
      "href",
      "/studio/sube-y-vende",
    );
    expect(within(sell).getByRole("link", { name: "Ir a Studio" })).toHaveAttribute(
      "href",
      "/studio",
    );
    // La tarjeta oscura «¿Qué quieres vender hoy?» ya no existe.
    expect(screen.queryByText("¿Qué quieres vender hoy?")).toBeNull();
  });

  it("sin comunidades propias invita a explorar en lugar de dejar la sección vacía", () => {
    render(<SideNav viewer={{ ...viewer, communities: [] }} communities={suggestions} />);

    const yours = screen.getByRole("region", { name: "Tus comunidades" });
    expect(within(yours).getByRole("link", { name: /Explora comunidades/ })).toHaveAttribute(
      "href",
      "/descubrir",
    );
  });

  it("si ya se unió a todas, no muestra «Para descubrir»", () => {
    render(<SideNav viewer={viewer} communities={{ total: 12, items: [] }} />);

    expect(screen.queryByRole("region", { name: "Para descubrir" })).toBeNull();
  });

  it("sin sesión: solo secciones públicas, todas las comunidades y Sube y vende sin Studio", () => {
    render(<SideNav viewer={null} communities={suggestions} />);

    const nav = screen.getByRole("navigation", { name: "Navegación principal" });
    expect(
      within(nav)
        .getAllByRole("link")
        .map((link) => link.textContent),
    ).toEqual(["Inicio", "Descubrir", "Comprar"]);
    const all = screen.getByRole("region", { name: "Comunidades" });
    expect(within(all).getAllByRole("link")).toHaveLength(2);
    expect(screen.queryByRole("region", { name: "Tus comunidades" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Unirme" })).toBeNull();
    // Maqueta de visitante: la entrada a Sube y vende sigue ahí; «Ir a Studio» no (no hay panel).
    const sell = screen.getByRole("region", { name: "Para vender" });
    expect(within(sell).getByRole("link", { name: "Sube y vende" })).toHaveAttribute(
      "href",
      "/studio/sube-y-vende",
    );
    expect(screen.queryByRole("link", { name: /Studio/ })).toBeNull();
  });
});

describe("TopBar", () => {
  it("con sesión: búsqueda, Crear, campana, mensajes, carrito con su número y menú de la cuenta", () => {
    render(<TopBar viewer={{ ...viewer!, unreadNotifications: 3, unreadMessages: 1 }} />);

    expect(screen.getByRole("searchbox", { name: /Buscar comunidades/ })).toHaveAttribute(
      "name",
      "q",
    );
    for (const cart of screen.getAllByRole("link", { name: /^Carrito/ })) {
      expect(cart).toHaveAccessibleName("Carrito (2)");
    }
    expect(screen.getByRole("button", { name: "Tu cuenta: Sofía Ramos" })).toBeInTheDocument();
    // La campana (ADR-059) y los mensajes abren su recuadro ahí mismo (ADR-068): son botones, con
    // su número en el nombre, en móvil y en escritorio.
    expect(screen.getAllByRole("button", { name: /^Avisos/ })).toHaveLength(2);
    for (const bell of screen.getAllByRole("button", { name: /^Avisos/ })) {
      expect(bell).toHaveAccessibleName("Avisos (3 sin leer)");
    }
    for (const chat of screen.getAllByRole("button", { name: /^Mensajes/ })) {
      expect(chat).toHaveAccessibleName("Mensajes (1 sin leer)");
    }
    expect(screen.queryByRole("link", { name: /^Avisos|^Mensajes/ })).toBeNull();
    expect(screen.queryByRole("link", { name: "Únete" })).toBeNull();
  });

  it("«Crear» abre sus opciones ahí mismo; «Publicación» abre la ventana para escribir", async () => {
    render(<TopBar viewer={viewer} />);

    await userEvent.click(screen.getByRole("button", { name: "Crear" }));

    const menu = await screen.findByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: /^Publicación/ })).toHaveAttribute(
      "href",
      "/crear/publicacion",
    );
    expect(within(menu).getByRole("menuitem", { name: /^Producto a mano/ })).toHaveAttribute(
      "href",
      "/studio/productos/nuevo",
    );
    expect(within(menu).getAllByRole("menuitem")).toHaveLength(4);
  });

  it("al ver los avisos, el globo de la campana se apaga sin recargar la página", async () => {
    const { loadNotificationsAction, markNotificationsReadAction } =
      await import("@/modules/notifications/actions");
    vi.mocked(loadNotificationsAction).mockResolvedValueOnce([
      {
        key: "follow:1",
        type: "FOLLOW",
        actors: [{ username: "ana", displayName: "Ana", avatarUrl: null }],
        at: new Date(),
        unread: true,
        postExcerpt: null,
        commentExcerpt: null,
        reactions: [],
        orderTitle: null,
        href: "/u/ana",
      },
    ]);
    vi.mocked(markNotificationsReadAction).mockResolvedValueOnce(1);
    render(<TopBar viewer={{ ...viewer!, unreadNotifications: 1 }} />);

    await userEvent.click(screen.getAllByRole("button", { name: "Avisos (1 sin leer)" })[0]!);

    expect(await screen.findByText("empezó a seguirte")).toBeInTheDocument();
    expect(markNotificationsReadAction).toHaveBeenCalledTimes(1);
    // Con el panel abierto, el resto de la página queda fuera del árbol accesible (`hidden`).
    expect(await screen.findAllByRole("button", { name: "Avisos", hidden: true })).toHaveLength(2);
  });

  it("sin sesión: Entrar y Crear cuenta en escritorio, Únete en móvil, sin carrito", () => {
    render(<TopBar viewer={null} />);

    expect(screen.getByRole("link", { name: "Entrar" })).toHaveAttribute("href", "/entrar");
    expect(screen.getByRole("link", { name: "Crear cuenta" })).toHaveAttribute("href", "/registro");
    expect(screen.getByRole("link", { name: "Únete" })).toHaveAttribute("href", "/registro");
    expect(screen.getByRole("link", { name: "Buscar" })).toHaveAttribute("href", "/buscar");
    expect(screen.queryByRole("link", { name: /^Carrito/ })).toBeNull();
  });

  it("en /buscar la caja conserva lo que se buscó", () => {
    navigation.pathname = "/buscar";
    navigation.search = "q=tenis+para+correr";
    render(<TopBar viewer={null} />);

    expect(screen.getByRole("searchbox", { name: /Buscar comunidades/ })).toHaveValue(
      "tenis para correr",
    );
  });
});
