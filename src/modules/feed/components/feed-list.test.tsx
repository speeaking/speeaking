import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { FeedItemDTO } from "../dto";
import { FeedList } from "./feed-list";

vi.mock("@/modules/social/actions", () => ({
  toggleLikeAction: vi.fn(),
  toggleSaveAction: vi.fn(),
}));
vi.mock("@/modules/social/context-actions", () => ({ getPostContextAction: vi.fn() }));
vi.mock("@/modules/social/interaction-actions", () => ({ recordShareAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/",
}));

/** Último observador creado: permite simular que el final de la lista entra en pantalla. */
let reachEnd: () => void = () => {};

beforeEach(() => {
  // jsdom no trae IntersectionObserver (el scroll infinito solo lo usa para cargar más).
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
        reachEnd = () => callback([{ isIntersecting: true }]);
      }
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const gaming = { slug: "gaming", name: "Gaming", emoji: "🎮", hue: 285 };
const DAY = 24 * 60 * 60 * 1000;

let sequence = 0;
function item(overrides: Partial<FeedItemDTO> = {}): FeedItemDTO {
  sequence += 1;
  return {
    id: `0199a000-0000-7000-8000-${String(sequence).padStart(12, "0")}`,
    type: "POST",
    body: "Un texto corto para la comunidad.",
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
    community: gaming,
    media: [],
    product: null,
    stats: { likes: 0, comments: 0, saves: 0, reactions: [] },
    viewer: { reaction: null, saved: false, withinBudget: false },
    ranking: null,
    ...overrides,
  };
}

const photo = {
  url: "/media/foto.webp",
  width: 800,
  height: 1000,
  blurDataUrl: null,
  alt: "Control de videojuegos",
  credit: null,
};

const variants = () =>
  screen.getAllByRole("article").map((article) => article.getAttribute("data-variant"));

describe("FeedList: variantes y separador de la portada", () => {
  it("pinta cada pieza con su variante sin cambiar el orden del feed", () => {
    render(
      <FeedList
        initialPage={{
          items: [item(), item({ media: [photo] }), item({ media: [photo] })],
          nextCursor: null,
        }}
        empty={null}
      />,
    );

    expect(variants()).toEqual(["bigType", "cover", "standard"]);
  });

  it("solo dice «Hoy en» si la portada es de hoy; si no, «Destacado en»", () => {
    const old = new Date(Date.now() - 3 * DAY).toISOString();
    const { unmount } = render(
      <FeedList
        initialPage={{ items: [item({ media: [photo], publishedAt: old })], nextCursor: null }}
        empty={null}
      />,
    );
    expect(screen.getByText("Destacado en Gaming")).toBeInTheDocument();
    expect(screen.queryByText(/Hoy en/)).not.toBeInTheDocument();
    unmount();

    render(
      <FeedList
        initialPage={{ items: [item({ media: [photo] })], nextCursor: null }}
        empty={null}
      />,
    );
    expect(screen.getByText("Hoy en Gaming")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ir a la comunidad Gaming" })).toHaveAttribute(
      "href",
      "/c/gaming",
    );
  });

  it("dentro de una comunidad no repite el separador", () => {
    render(
      <FeedList
        community="gaming"
        initialPage={{ items: [item({ media: [photo] })], nextCursor: null }}
        empty={null}
      />,
    );

    expect(variants()).toEqual(["cover"]);
    expect(screen.queryByText(/(Hoy|Destacado) en Gaming/)).not.toBeInTheDocument();
  });

  it("a una persona visitante le da enlaces para crear cuenta en lugar de toggles", () => {
    render(
      <FeedList
        isSignedIn={false}
        initialPage={{ items: [item({ community: null })], nextCursor: null }}
        empty={null}
      />,
    );

    expect(screen.getByRole("link", { name: "Me gusta" })).toHaveAttribute(
      "href",
      "/registro?next=%2F",
    );
    expect(screen.queryByRole("button", { name: "Me gusta" })).not.toBeInTheDocument();
  });

  it("sin piezas muestra el estado vacío", () => {
    render(<FeedList initialPage={{ items: [], nextCursor: null }} empty={<p>Nada aún</p>} />);

    expect(screen.getByText("Nada aún")).toBeInTheDocument();
  });

  it("si el servidor vuelve a pintar la página y no se cargó más, adopta la versión nueva", () => {
    // P. ej. tras «Ya no busco esto» en la columna: la tarjeta ya no puede decir «Porque buscas…».
    const sale = item({
      type: "PRODUCT",
      community: null,
      product: {
        slug: "tenis",
        title: "Tenis ligeros",
        priceCents: 149_900,
        currency: "MXN",
        inStock: true,
        availability: "available",
        city: "Guadalajara",
        state: "Jalisco",
        categoryName: "Calzado",
        tryOn: false,
        facts: {
          status: "ACTIVE",
          stock: 3,
          city: "Guadalajara",
          state: "Jalisco",
          pickupAvailable: false,
          localDeliveryAvailable: false,
          localDeliveryZones: [],
          nationalShippingAvailable: false,
          shippingPriceCents: null,
          currency: "MXN",
          deliveryMinDays: null,
          deliveryMaxDays: null,
          warrantyType: "NONE",
          warrantyDays: null,
          returnWindowDays: 0,
          authenticity: "NOT_APPLICABLE",
          acceptedPaymentMethods: ["CARD"],
        },
      },
    });
    const ranking = {
      position: 0,
      score: 1,
      reason: "intent" as const,
      slot: "commerce" as const,
      algorithmVersion: "v0-explicable",
    };
    const chip = () => document.querySelector('[data-slot="intent-chip"]');
    const { rerender } = render(
      <FeedList
        initialPage={{
          items: [
            {
              ...sale,
              ranking: {
                ...ranking,
                intent: { basis: "query", query: "tenis", source: "declared" },
              },
            },
          ],
          nextCursor: "c1",
        }}
        empty={null}
      />,
    );
    expect(chip()).toHaveTextContent("Porque buscas “tenis”");

    rerender(
      <FeedList
        initialPage={{
          items: [{ ...sale, ranking: { ...ranking, intent: null } }],
          nextCursor: "c2",
        }}
        empty={null}
      />,
    );

    expect(chip()).toBeNull();
  });

  it("con más páginas cargadas conserva la lista para no mover lo que se está leyendo", async () => {
    const pageTwo = {
      items: [item({ body: "De la página dos.", community: null })],
      nextCursor: null,
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(JSON.stringify(pageTwo), { status: 200 })),
    );
    const first = {
      items: [item({ body: "De la página uno.", community: null })],
      nextCursor: "c1",
    };
    const { rerender } = render(<FeedList initialPage={first} empty={null} />);

    await act(async () => reachEnd());
    expect(await screen.findByText("De la página dos.")).toBeInTheDocument();

    rerender(
      <FeedList
        initialPage={{
          items: [item({ body: "Versión nueva.", community: null })],
          nextCursor: "c9",
        }}
        empty={null}
      />,
    );

    expect(screen.getByText("De la página uno.")).toBeInTheDocument();
    expect(screen.getByText("De la página dos.")).toBeInTheDocument();
    expect(screen.queryByText("Versión nueva.")).not.toBeInTheDocument();
  });
});

describe("FeedList: páginas siguientes", () => {
  it("si el cursor venció (400) termina la lista y no vuelve a pedir la misma página", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 400 }));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FeedList
        initialPage={{ items: [item({ body: "Única pieza." })], nextCursor: "cursor-viejo" }}
        empty={null}
        isSignedIn
      />,
    );

    await act(async () => reachEnd());
    await act(async () => reachEnd());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/Ya viste todo por ahora/)).toBeInTheDocument();
  });

  it("tras un error de red no reintenta solo: espera al botón «Reintentar»", async () => {
    const fetchMock = vi.fn().mockRejectedValue(new Error("offline"));
    vi.stubGlobal("fetch", fetchMock);
    render(
      <FeedList
        initialPage={{ items: [item({ body: "Única pieza." })], nextCursor: "cursor" }}
        empty={null}
        isSignedIn
      />,
    );

    await act(async () => reachEnd());
    await act(async () => reachEnd());

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("button", { name: "Reintentar" })).toBeInTheDocument();
  });
});

describe("FeedList: carrusel de productos (ADR-051)", () => {
  const card = (n: number) => ({
    id: `0199a000-0000-7000-8000-0000000000c${n}`,
    slug: `producto-${n}`,
    title: `Producto ${n}`,
    priceCents: 10_000 * n,
    currency: "MXN",
    city: "Guadalajara",
    inStock: true,
    tryOn: false,
    image: null,
  });
  const products = {
    title: "Populares",
    reason: "Lo más visto esta semana",
    href: "/comprar",
    items: [1, 2, 3].map((n) => ({ product: card(n), sponsored: n === 1 })),
  };
  const pieces = (count: number) =>
    Array.from({ length: count }, (_, i) =>
      item({
        id: `0199a000-0000-7000-8000-0000000000a${i}`,
        publishedAt: new Date(2026, 8, 20 - i).toISOString(),
      }),
    );

  it("pinta el carrusel de la página después de su 4.ª pieza, con su razón y la etiqueta", () => {
    render(
      <FeedList initialPage={{ items: pieces(6), nextCursor: null, products }} empty={null} />,
    );

    const region = screen.getByRole("region", { name: "Populares" });
    expect(region).toHaveTextContent("Lo más visto esta semana");
    expect(region).toHaveTextContent("Patrocinado");
    const articles = screen.getAllByRole("article");
    expect(articles).toHaveLength(6);
    // Después de la 4.ª y antes de la 5.ª.
    expect(
      articles[3]!.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      region.compareDocumentPosition(articles[4]!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("con menos piezas va después de la última; sin carrusel no pinta nada", () => {
    const { unmount } = render(
      <FeedList initialPage={{ items: pieces(2), nextCursor: null, products }} empty={null} />,
    );
    const region = screen.getByRole("region", { name: "Populares" });
    const articles = screen.getAllByRole("article");
    expect(
      articles[1]!.compareDocumentPosition(region) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    unmount();

    render(<FeedList initialPage={{ items: pieces(6), nextCursor: null }} empty={null} />);
    expect(screen.queryByRole("region", { name: "Populares" })).not.toBeInTheDocument();
  });
});
