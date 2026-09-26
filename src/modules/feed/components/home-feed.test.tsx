import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItemDTO, FeedPageDTO, HomeBubblesDTO } from "../dto";
import { HomeFeed } from "./home-feed";
import { VisitorJoinCard } from "./visitor-join-card";

vi.mock("@/modules/social/actions", () => ({
  toggleLikeAction: vi.fn(),
  toggleSaveAction: vi.fn(),
}));
vi.mock("@/modules/social/interaction-actions", () => ({ recordShareAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

beforeEach(() => {
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => {
  vi.unstubAllGlobals();
});

const gaming = { id: "id-gaming", slug: "gaming", name: "Gaming", emoji: "🎮", hue: 285 };
const comida = { id: "id-comida", slug: "comida", name: "Comida", emoji: "🌮", hue: 40 };

let sequence = 0;
function item(body: string): FeedItemDTO {
  sequence += 1;
  return {
    id: `0199a000-0000-7000-8000-${String(sequence).padStart(12, "0")}`,
    type: "POST",
    // Texto largo: estándar (ni portada ni cartel), para contar artículos sin variantes.
    body: `${body} ${"con más detalle ".repeat(12)}`,
    publishedAt: new Date().toISOString(),
    isAiGenerated: false,
    author: {
      userId: "0199a000-0000-7000-8000-00000000aaaa",
      username: "ana",
      displayName: "Ana",
      avatarUrl: null,
      isEditorial: false,
      isSeller: false,
    },
    community: { slug: gaming.slug, name: gaming.name, emoji: gaming.emoji, hue: gaming.hue },
    media: [],
    product: null,
    stats: { likes: 0, comments: 0, saves: 0 },
    viewer: { liked: false, saved: false, withinBudget: false },
    ranking: null,
  };
}

const page = (...bodies: string[]): FeedPageDTO => ({
  items: bodies.map(item),
  nextCursor: null,
});

function renderHome({
  isSignedIn = false,
  bubbles = { filters: [gaming, comida], suggested: [] },
  initialPage = page("Uno", "Dos", "Tres", "Cuatro"),
  withJoinCard,
}: {
  isSignedIn?: boolean;
  bubbles?: HomeBubblesDTO;
  initialPage?: FeedPageDTO;
  withJoinCard?: boolean;
} = {}) {
  render(
    <HomeFeed
      header={<h1>Para ti</h1>}
      bubbles={bubbles}
      isSignedIn={isSignedIn}
      initialPage={initialPage}
      beforeFeed={<p>Antes del feed</p>}
      empty={<p>Vacío</p>}
      slots={
        (withJoinCard ?? !isSignedIn)
          ? [{ key: "arma", after: 1, node: <VisitorJoinCard communities={[gaming, comida]} /> }]
          : []
      }
    />,
  );
}

/** Orden en que aparecen artículos y bloques intercalados. */
function sequenceOfBlocks() {
  return [...document.querySelectorAll("article, [data-slot='visitor-join-card']")].map((node) =>
    node.matches("article") ? "post" : "arma-tu-feed",
  );
}

describe("HomeFeed: visitante", () => {
  it("«Arma tu feed» va después de la 2.ª publicación y solo donde no hay columna derecha", () => {
    renderHome();

    expect(sequenceOfBlocks()).toEqual(["post", "post", "arma-tu-feed", "post", "post"]);
    const card = screen.getByRole("region", { name: "Arma tu feed" });
    expect(card).toHaveClass("xl:hidden");
  });

  it("cada comunidad lleva a crear cuenta con esa comunidad ya elegida", () => {
    renderHome();

    const card = screen.getByRole("region", { name: "Arma tu feed" });
    expect(
      within(card).getByRole("link", { name: "Gaming: crear cuenta y unirme" }),
    ).toHaveAttribute("href", "/registro?unirse=gaming");
    expect(within(card).getByRole("link", { name: "Crear cuenta gratis" })).toHaveAttribute(
      "href",
      "/registro",
    );
  });

  it("con una sola publicación, la tarjeta va después de ella", () => {
    renderHome({ initialPage: page("Uno") });

    expect(sequenceOfBlocks()).toEqual(["post", "arma-tu-feed"]);
  });
});

describe("HomeFeed: filtros", () => {
  it("tocar una comunidad pide su feed y lo pinta; «Para ti» vuelve a la página inicial", async () => {
    const fetchMock = vi.fn(async () => Response.json(page("Solo de Comida")));
    vi.stubGlobal("fetch", fetchMock);
    renderHome({ isSignedIn: true });

    await userEvent.click(screen.getByRole("button", { name: "Comida" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/feed?community=comida");
    expect(await screen.findByText(/Solo de Comida/)).toBeInTheDocument();
    expect(screen.queryByText(/^Uno/)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Comida" })).toHaveAttribute("aria-pressed", "true");
    // Lo que acompaña a «Para ti» (compositor, bienvenida) no se repite en un filtro.
    expect(screen.queryByText("Antes del feed")).not.toBeInTheDocument();
    expect(screen.getByText("Mostrando publicaciones de Comida")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Para ti" }));
    expect(screen.getByText(/^Uno/)).toBeInTheDocument();
    expect(screen.getByText("Antes del feed")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("«Siguiendo» pide following=1 y, vacío, invita a encontrar gente sin inventar nada", async () => {
    const fetchMock = vi.fn(async () => Response.json({ items: [], nextCursor: null }));
    vi.stubGlobal("fetch", fetchMock);
    renderHome({ isSignedIn: true });

    await userEvent.click(screen.getByRole("button", { name: "Siguiendo" }));

    expect(fetchMock).toHaveBeenCalledWith("/api/feed?following=1");
    expect(
      await screen.findByRole("heading", { name: "Aquí verás a quienes sigues" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar comunidades" })).toHaveAttribute(
      "href",
      "/descubrir",
    );
  });

  it("si el servidor vuelve a pintar el inicio (p. ej. al seguir a alguien), «Siguiendo» se vuelve a pedir", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(Response.json({ items: [], nextCursor: null }))
      .mockResolvedValueOnce(Response.json(page("De quien acabas de seguir")));
    vi.stubGlobal("fetch", fetchMock);
    const props = {
      header: <h1>Para ti</h1>,
      bubbles: { filters: [gaming], suggested: [] },
      isSignedIn: true,
      empty: <p>Vacío</p>,
    };
    const { rerender } = render(<HomeFeed {...props} initialPage={page("Uno")} />);

    await userEvent.click(screen.getByRole("button", { name: "Siguiendo" }));
    await screen.findByRole("heading", { name: "Aquí verás a quienes sigues" });
    await userEvent.click(screen.getByRole("button", { name: "Para ti" }));
    // Sin cambios del servidor, la página guardada se reutiliza (no hay otra petición)…
    await userEvent.click(screen.getByRole("button", { name: "Siguiendo" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await userEvent.click(screen.getByRole("button", { name: "Para ti" }));

    // …pero después de un refresco del servidor (nueva primera página) se pide de nuevo.
    rerender(<HomeFeed {...props} initialPage={page("Uno")} />);
    await userEvent.click(screen.getByRole("button", { name: "Siguiendo" }));
    expect(await screen.findByText(/De quien acabas de seguir/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("un refresco del servidor conserva la página del filtro abierto", async () => {
    const fetchMock = vi.fn(async () => Response.json(page("Solo de Gaming")));
    vi.stubGlobal("fetch", fetchMock);
    const props = {
      header: <h1>Para ti</h1>,
      bubbles: { filters: [gaming], suggested: [] },
      isSignedIn: true,
      empty: <p>Vacío</p>,
    };
    const { rerender } = render(<HomeFeed {...props} initialPage={page("Uno")} />);

    await userEvent.click(screen.getByRole("button", { name: "Gaming" }));
    await screen.findByText(/Solo de Gaming/);
    rerender(<HomeFeed {...props} initialPage={page("Uno")} />);

    expect(screen.getByText(/Solo de Gaming/)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("si falla, ofrece reintentar", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(Response.json(page("Ya cargó")));
    vi.stubGlobal("fetch", fetchMock);
    renderHome({ isSignedIn: true });

    await userEvent.click(screen.getByRole("button", { name: "Gaming" }));
    await userEvent.click(await screen.findByRole("button", { name: "Reintentar" }));

    expect(await screen.findByText(/Ya cargó/)).toBeInTheDocument();
  });

  it("los bloques intercalados solo acompañan a «Para ti»", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json(page("A", "B", "C"))),
    );
    renderHome({ isSignedIn: false, withJoinCard: true });

    await userEvent.click(screen.getByRole("button", { name: "Gaming" }));
    await screen.findByText(/^A /);

    expect(screen.queryByRole("region", { name: "Arma tu feed" })).not.toBeInTheDocument();
  });
});
