import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { FeedItemDTO } from "@/modules/feed/dto";
import { tapHaptic } from "@/lib/haptics";
import { reactAction, toggleSaveAction } from "../actions";
import { PostCard } from "./post-card";

// Las acciones reales viven en el servidor (base de datos, sesión): aquí se simulan.
vi.mock("../actions", () => ({ reactAction: vi.fn(), toggleSaveAction: vi.fn() }));
vi.mock("../context-actions", () => ({ getPostContextAction: vi.fn() }));
vi.mock("../interaction-actions", () => ({ recordShareAction: vi.fn() }));
// Micro-respuestas (ADR-052): la vibración y los avisos se observan, no se ejecutan.
vi.mock("@/lib/haptics", () => ({ tapHaptic: vi.fn() }));
vi.mock("sonner", () => ({
  toast: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }),
}));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/c/gaming",
}));

afterEach(() => {
  vi.clearAllMocks();
});

const POST_ID = "0199a000-0000-7000-8000-000000000001";
const gaming = { slug: "gaming", name: "Gaming", emoji: "🎮", hue: 285 };

const photos = (count: number, size = { width: 800, height: 1000 }): FeedItemDTO["media"] =>
  Array.from({ length: count }, (_, index) => ({
    url: `/media/foto-${index + 1}.webp`,
    ...size,
    blurDataUrl: null,
    alt: null,
    credit: null,
  }));

function post(overrides: Partial<FeedItemDTO> = {}): FeedItemDTO {
  return {
    id: POST_ID,
    type: "POST",
    body: "Miren lo que encontré",
    publishedAt: new Date().toISOString(),
    isAiGenerated: false,
    author: {
      userId: "0199a000-0000-7000-8000-000000000002",
      username: "ana",
      displayName: "Ana",
      avatarUrl: null,
      isEditorial: false,
      isSeller: false,
    },
    community: null,
    media: photos(3),
    product: null,
    stats: { likes: 0, comments: 0, saves: 0, reactions: [] },
    viewer: { reaction: null, saved: false, withinBudget: false },
    ranking: null,
    ...overrides,
  };
}

type Product = NonNullable<FeedItemDTO["product"]>;

const facts = (overrides: Partial<Product["facts"]> = {}): Product["facts"] => ({
  status: "ACTIVE",
  stock: 10,
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
  ...overrides,
});

const product = (overrides: Partial<Product> = {}): Product => ({
  slug: "tenis-rojos",
  title: "Tenis rojos",
  priceCents: 89_900,
  currency: "MXN",
  inStock: true,
  availability: "available",
  city: "Guadalajara",
  state: "Jalisco",
  categoryName: "Calzado",
  tryOn: false,
  facts: facts(),
  ...overrides,
});

const sale = (overrides: Partial<FeedItemDTO> = {}) =>
  post({ type: "PRODUCT", product: product(), ...overrides });

const ranking = (intent: NonNullable<FeedItemDTO["ranking"]>["intent"]) => ({
  position: 3,
  score: 1.2,
  reason: "intent" as const,
  slot: "commerce" as const,
  algorithmVersion: "v0-explicable",
  intent,
});

const frame = () => document.querySelector('[data-slot="carousel-track"]')!.parentElement!;
const header = () => screen.getByRole("article").querySelector("header")!;

describe("PostCard: fotos", () => {
  it("una publicación normal muestra el collage y cada foto abre la publicación en ella", () => {
    render(<PostCard post={post()} />);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    const tiles = screen.getAllByRole("link", { name: /^Imagen \d de la publicación de Ana/ });
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      `/p/${POST_ID}`,
      `/p/${POST_ID}?foto=2`,
      `/p/${POST_ID}?foto=3`,
    ]);
  });

  it("una venta con varias fotos va en mosaico en el feed y cada foto abre la publicación", () => {
    render(<PostCard post={sale()} />);

    expect(screen.queryByRole("region", { name: "Fotos de Tenis rojos" })).not.toBeInTheDocument();
    const tiles = screen.getAllByRole("link", { name: /^Tenis rojos, foto \d/ });
    expect(tiles.map((tile) => tile.getAttribute("href"))).toEqual([
      `/p/${POST_ID}`,
      `/p/${POST_ID}?foto=2`,
      `/p/${POST_ID}?foto=3`,
    ]);
  });

  it("abierta, la venta muestra el carrusel con el nombre del producto", () => {
    render(<PostCard post={sale()} expanded />);

    const carousel = screen.getByRole("region", { name: "Fotos de Tenis rojos" });
    expect(within(carousel).getByRole("img", { name: "Tenis rojos, foto 2" })).toBeInTheDocument();
    expect(within(carousel).getByText("1/3")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Tenis rojos, foto/ })).not.toBeInTheDocument();
  });

  it("en una venta el marco es 4:5 o cuadrado aunque la portada sea horizontal", () => {
    render(<PostCard post={sale({ media: photos(2, { width: 1600, height: 900 }) })} expanded />);

    expect(parseFloat(frame().style.aspectRatio)).toBe(1);
    // La foto horizontal no se recorta ni se estira: se ve completa dentro del cuadrado.
    for (const image of within(frame()).getAllByRole("img")) {
      expect(image).toHaveStyle({ objectFit: "contain" });
    }
  });

  it("en la página de la publicación abre el carrusel en la foto que se tocó", () => {
    render(<PostCard post={post()} expanded initialMediaIndex={2} />);

    const carousel = screen.getByRole("region", { name: "Fotos de la publicación de Ana" });
    expect(within(carousel).getByText("3/3")).toBeInTheDocument();
  });

  it("un texto alternativo vacío usa el de respaldo", () => {
    render(<PostCard post={post({ media: [{ ...photos(1)[0]!, alt: "  " }] })} />);

    expect(
      screen.getByRole("link", { name: "Imagen 1 de la publicación de Ana" }),
    ).toBeInTheDocument();
  });

  it("acredita las fotos de stock con enlace al autor en otra pestaña", () => {
    const [first, second] = photos(2);
    const credit = { name: "Ana Pérez", url: "https://unsplash.com/@ana", license: "Unsplash" };
    render(
      <PostCard
        post={post({
          media: [
            { ...first!, credit },
            { ...second!, credit },
          ],
        })}
      />,
    );

    const line = screen.getByText(/^Foto:/);
    expect(line).toHaveTextContent("Foto: Ana Pérez (se abre en otra pestaña) · Unsplash");
    const link = within(line).getByRole("link", { name: /Ana Pérez/ });
    expect(link).toHaveAttribute("href", "https://unsplash.com/@ana");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer nofollow");
  });

  it("sin crédito no hay línea de foto", () => {
    render(<PostCard post={post()} />);

    expect(screen.queryByText(/^Fotos?:/)).not.toBeInTheDocument();
  });
});

describe("PostCard: video corto (ADR-062)", () => {
  const video: NonNullable<FeedItemDTO["video"]> = {
    url: "/media/videos/2026/10/v.mp4",
    width: 180,
    height: 320,
    durationMs: 42_000,
    codec: "avc1",
    poster: { url: "/media/images/p.webp", width: 180, height: 320, blurDataUrl: null },
  };

  it("muestra el video con su portada, duración y controles, sin mosaico de fotos", () => {
    const { container } = render(<PostCard post={post({ media: [], video })} />);

    const element = container.querySelector("video")!;
    expect(element).toHaveAttribute("src", video.url);
    expect(element).toHaveAttribute("poster", "/media/images/p.webp?w=828");
    expect(element).toHaveAttribute("preload", "none");
    expect(element).toHaveAccessibleName("Video de la publicación de Ana");
    expect(screen.getByText("0:42")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reproducir video" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Activar sonido" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(container.querySelector("img[src*='/media/']")).toBeNull();
  });

  it("abierta, usa los controles del navegador y descarga solo sus datos", () => {
    const { container } = render(<PostCard post={post({ media: [], video })} expanded />);

    const element = container.querySelector("video")!;
    expect(element).toHaveAttribute("controls");
    expect(element).toHaveAttribute("preload", "metadata");
    expect(screen.queryByRole("button", { name: "Reproducir video" })).toBeNull();
  });

  it("con comunidad y sin fotos no se vuelve tarjeta tipográfica", () => {
    render(
      <PostCard
        post={post({ media: [], video, body: "¡Miren!", community: gaming })}
        variant="bigType"
      />,
    );

    expect(screen.getByRole("article")).toHaveAttribute("data-variant", "standard");
  });
});

describe("PostCard: producto de otra tienda (ADR-063)", () => {
  const video: NonNullable<FeedItemDTO["video"]> = {
    url: "/media/videos/2026/10/v.mp4",
    width: 180,
    height: 320,
    durationMs: 12_000,
    codec: "avc1",
    poster: null,
  };
  const theirs = (overrides: Partial<Product> = {}) =>
    product({ thirdPartyStore: "Ropero Demo", tryOn: true, ...overrides });

  it("dice de qué tienda es el producto y, con acuerdo declarado, «Colaboración con…»", () => {
    const { unmount } = render(
      <PostCard post={post({ product: theirs(), collaboration: true, media: photos(1) })} />,
    );
    expect(screen.getByText("Vendido por Ropero Demo")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="collaboration-chip"]')).toHaveTextContent(
      "Colaboración con Ropero Demo",
    );
    unmount();

    // Sin acuerdo declarado: se dice de quién es, sin la etiqueta de colaboración.
    render(<PostCard post={post({ product: theirs(), media: photos(1) })} />);
    expect(screen.getByText("Vendido por Ropero Demo")).toBeInTheDocument();
    expect(document.querySelector('[data-slot="collaboration-chip"]')).toBeNull();
  });

  it("un producto propio no dice «Vendido por» ni «Colaboración», aunque llegue marcado", () => {
    render(<PostCard post={sale({ collaboration: true })} />);

    expect(screen.queryByText(/Vendido por/)).toBeNull();
    expect(document.querySelector('[data-slot="collaboration-chip"]')).toBeNull();
  });

  it("en un video, el precio y «Ver cómo me veo» van encima, una sola vez por tarjeta", () => {
    render(<PostCard post={post({ media: [], video, product: theirs() })} />);

    const frame = document.querySelector("[data-video]")!;
    const price = within(frame as HTMLElement).getByRole("link", {
      name: /\$899.*ver Tenis rojos/,
    });
    expect(price).toHaveAttribute("href", `/producto/tenis-rojos?from=${POST_ID}`);
    const tryOn = screen.getAllByRole("link", { name: "Ver cómo me veo: Tenis rojos" });
    expect(tryOn).toHaveLength(1);
    expect(frame).toContainElement(tryOn[0]!);
    expect(tryOn[0]).toHaveAttribute("href", `/producto/tenis-rojos?from=${POST_ID}&probar=1`);
    // El bloque del producto ya no repite el precio.
    expect(screen.getAllByText(/\$899/)).toHaveLength(1);
  });

  it("un video de un producto agotado no lleva etiquetas encima: el bloque dice por qué", () => {
    render(
      <PostCard
        post={post({
          media: [],
          video,
          product: theirs({ availability: "sold_out", inStock: false }),
        })}
      />,
    );

    const frame = document.querySelector("[data-video]") as HTMLElement;
    expect(within(frame).queryByRole("link")).toBeNull();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
  });
});

describe("PostCard: visor de la capa (ADR-064)", () => {
  it("con fotos, la imagen va en su escenario y lo que sigue queda dentro de la publicación", () => {
    render(
      <PostCard post={post()} expanded layout="theater">
        <section aria-label="Comentarios">Sin comentarios</section>
      </PostCard>,
    );

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("data-layout", "theater");
    const stage = article.querySelector<HTMLElement>('[data-slot="post-stage"]')!;
    expect(
      within(stage).getByRole("region", { name: "Fotos de la publicación de Ana" }),
    ).toBeInTheDocument();
    expect(within(article).getByRole("region", { name: "Comentarios" })).toBeInTheDocument();
    // La foto se limita al alto de la ventana conservando su proporción (4:5 → 0.8).
    const frame = stage.firstElementChild as HTMLElement;
    expect(frame.style.getPropertyValue("--media-aspect")).toBe("0.8");
  });

  it("sin fotos ni video no hay visor: es la tarjeta abierta de siempre", () => {
    render(
      <PostCard post={post({ media: [] })} expanded layout="theater">
        <section aria-label="Comentarios">Sin comentarios</section>
      </PostCard>,
    );

    const article = screen.getByRole("article");
    expect(article).not.toHaveAttribute("data-layout");
    expect(article.querySelector('[data-slot="post-stage"]')).toBeNull();
    expect(within(article).getByRole("region", { name: "Comentarios" })).toBeInTheDocument();
  });

  it("en el feed (sin abrir) nunca es visor, aunque se pida", () => {
    render(<PostCard post={post()} layout="theater" />);

    expect(screen.getByRole("article")).not.toHaveAttribute("data-layout");
  });
});

describe("PostCard: cabecera", () => {
  it("una cuenta editorial empieza por su comunidad, sin avatar de iniciales", () => {
    render(
      <PostCard
        post={post({
          isAiGenerated: true,
          community: gaming,
          author: {
            ...post().author,
            username: "equipo.gaming",
            displayName: "Equipo VendeIA",
            isEditorial: true,
          },
        })}
      />,
    );

    const top = header();
    expect(within(top).getByRole("link", { name: "Gaming" })).toHaveAttribute("href", "/c/gaming");
    expect(within(top).getByText("Editorial")).toBeInTheDocument();
    expect(within(top).getByRole("link", { name: "Equipo VendeIA" })).toHaveAttribute(
      "href",
      "/u/equipo.gaming",
    );
    expect(within(top).getByText("Con ayuda de IA")).toBeInTheDocument();
    expect(within(top).queryByText("EV")).not.toBeInTheDocument();
    expect(screen.getByRole("article", { name: "Gaming Equipo VendeIA" })).toBeInTheDocument();
  });

  it("sin IA no dice «Con ayuda de IA»", () => {
    render(
      <PostCard
        post={post({ community: gaming, author: { ...post().author, isEditorial: true } })}
      />,
    );

    expect(screen.queryByText("Con ayuda de IA")).not.toBeInTheDocument();
  });

  it("una persona muestra su avatar, su nombre y la comunidad como chip", () => {
    render(<PostCard post={post({ community: gaming })} />);

    const top = header();
    expect(within(top).getByRole("link", { name: "Ana" })).toHaveAttribute("href", "/u/ana");
    expect(within(top).getByText("AN")).toBeInTheDocument();
    expect(within(top).getByRole("link", { name: "Gaming" })).toHaveAttribute("href", "/c/gaming");
    expect(within(top).queryByText("Editorial")).not.toBeInTheDocument();
    expect(within(top).queryByText("Tienda")).not.toBeInTheDocument();
  });

  it("una tienda lleva la insignia «Tienda»", () => {
    render(<PostCard post={sale({ author: { ...post().author, isSeller: true } })} />);

    expect(within(header()).getByText("Tienda")).toBeInTheDocument();
  });
});

describe("PostCard: contadores y acciones", () => {
  it("oculta los ceros e invita a comentar con honestidad", () => {
    render(<PostCard post={post()} isSignedIn />);

    const like = screen.getByRole("button", { name: "Me gusta" });
    expect(like).toHaveAttribute("aria-pressed", "false");
    expect(like).not.toHaveTextContent("0");
    expect(screen.getByRole("link", { name: "Comentar" })).toHaveAttribute(
      "href",
      `/p/${POST_ID}/comentarios`,
    );
    expect(screen.getByRole("link", { name: "Sé la primera persona en comentar" })).toHaveAttribute(
      "href",
      `/p/${POST_ID}/comentarios`,
    );
    expect(screen.queryByText("¿Qué opinas?")).not.toBeInTheDocument();
  });

  it("con números los incluye en el nombre y muestra «¿Qué opinas?»", () => {
    render(
      <PostCard
        post={post({ stats: { likes: 3, comments: 2, saves: 0, reactions: [] } })}
        isSignedIn
      />,
    );

    expect(screen.getByRole("button", { name: "Me gusta, 3" })).toHaveTextContent("3");
    expect(screen.getByRole("link", { name: "Comentar, 2 comentarios" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "¿Qué opinas?" })).toHaveAttribute(
      "href",
      `/p/${POST_ID}/comentarios`,
    );
  });

  it("un toque da ❤️: cambia aria-pressed y el número sin cambiar el nombre del botón", async () => {
    vi.mocked(reactAction).mockResolvedValue({ ok: true, kind: "LIKE", count: 4, top: ["LIKE"] });
    render(
      <PostCard
        post={post({ stats: { likes: 3, comments: 0, saves: 0, reactions: [] } })}
        isSignedIn
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Me gusta, 3" }));

    const like = await screen.findByRole("button", { name: "Me gusta, 4" });
    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(reactAction).toHaveBeenCalledWith(POST_ID, "LIKE");
  });

  it("elegir otra reacción de la tira la manda al servidor y el botón la muestra (ADR-054)", async () => {
    vi.mocked(reactAction).mockResolvedValue({
      ok: true,
      kind: "HAHA",
      count: 4,
      top: ["LIKE", "HAHA"],
    });
    render(
      <PostCard
        post={post({ stats: { likes: 3, comments: 0, saves: 0, reactions: ["LIKE"] } })}
        isSignedIn
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Elegir reacción" }));
    await userEvent.click(screen.getByRole("button", { name: "Me divierte" }));

    const button = await screen.findByRole("button", { name: "Me divierte, 4" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("😂");
    expect(reactAction).toHaveBeenCalledWith(POST_ID, "HAHA");
  });

  it("tocar el botón con una reacción puesta la quita", async () => {
    vi.mocked(reactAction).mockResolvedValue({ ok: true, kind: null, count: 2, top: ["LIKE"] });
    render(
      <PostCard
        post={post({
          stats: { likes: 3, comments: 0, saves: 0, reactions: ["LIKE", "WOW"] },
          viewer: { reaction: "WOW", saved: false, withinBudget: false },
        })}
        isSignedIn
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "Me asombra, 3" }));

    expect(await screen.findByRole("button", { name: "Me gusta, 2" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(reactAction).toHaveBeenCalledWith(POST_ID, null);
  });

  it("guardar y compartir tienen nombres fijos; guardar indica su estado", () => {
    render(
      <PostCard post={post({ viewer: { reaction: null, saved: true, withinBudget: false } })} />,
    );

    expect(screen.getByRole("button", { name: "Guardar" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: "Compartir" })).toBeInTheDocument();
  });

  it("una visitante va directo a crear su cuenta, sin toggles", () => {
    render(
      <PostCard
        post={post({ stats: { likes: 3, comments: 1, saves: 0, reactions: [] } })}
        isSignedIn={false}
      />,
    );

    const like = screen.getByRole("link", { name: "Me gusta, 3" });
    expect(like).toHaveAttribute("href", "/registro?next=%2Fc%2Fgaming");
    expect(like).not.toHaveAttribute("aria-pressed");
    expect(screen.getByRole("link", { name: "Guardar" })).toHaveAttribute(
      "href",
      "/registro?next=%2Fc%2Fgaming",
    );
    // Responder la lleva a la publicación después de crear su cuenta.
    expect(screen.getByRole("link", { name: "¿Qué opinas?" })).toHaveAttribute(
      "href",
      `/registro?next=${encodeURIComponent(`/p/${POST_ID}`)}`,
    );
    // Son enlaces, no toggles: no hay estado optimista que revertir.
    expect(screen.queryByRole("button", { name: /Me gusta|Guardar/ })).not.toBeInTheDocument();
    expect(reactAction).not.toHaveBeenCalled();
    expect(toggleSaveAction).not.toHaveBeenCalled();
  });

  it("en la página de la publicación no repite la fila de respuesta", () => {
    render(<PostCard post={post()} expanded />);

    expect(screen.queryByText("Sé la primera persona en comentar")).not.toBeInTheDocument();
    // «Comentar» salta al formulario de la misma página con un ancla nativa (dispara hashchange).
    expect(screen.getByRole("link", { name: "Comentar" })).toHaveAttribute("href", "#comentar");
  });
});

describe("PostCard: producto (P4)", () => {
  it("con una sola foto el precio va una vez, sobre la foto, y enlaza al producto", () => {
    render(<PostCard post={sale({ media: photos(1) })} />);

    expect(screen.getAllByText("$899")).toHaveLength(1);
    const tag = screen.getByRole("link", { name: "$899, ver Tenis rojos" });
    expect(tag).toHaveAttribute("href", `/producto/tenis-rojos?from=${POST_ID}`);
    // Va dentro del marco de la foto (una sola foto: sin carril de carrusel).
    const photo = screen.getByRole("img", { name: "Tenis rojos, foto 1" });
    expect(photo.parentElement).toContainElement(tag);
  });

  it("con varias fotos (mosaico) el precio va una vez, en el bloque del producto", () => {
    render(<PostCard post={sale()} />);

    expect(screen.getAllByText("$899")).toHaveLength(1);
    expect(screen.queryByRole("link", { name: "$899, ver Tenis rojos" })).not.toBeInTheDocument();
  });

  it("sin fotos el precio va en el bloque del producto, también una sola vez", () => {
    render(<PostCard post={sale({ media: [] })} />);

    expect(screen.getAllByText("$899")).toHaveLength(1);
    expect(screen.getByRole("link", { name: "Ver producto: Tenis rojos" })).toHaveAttribute(
      "href",
      `/producto/tenis-rojos?from=${POST_ID}`,
    );
  });

  it("en una prenda disponible ofrece «Ver cómo me veo» y abre la ficha con el diálogo", () => {
    render(<PostCard post={sale({ product: product({ tryOn: true }) })} />);

    expect(screen.getByRole("link", { name: "Ver cómo me veo: Tenis rojos" })).toHaveAttribute(
      "href",
      `/producto/tenis-rojos?from=${POST_ID}&probar=1`,
    );
  });

  it("no ofrece probarse lo que no es prenda ni lo agotado", () => {
    const { unmount } = render(<PostCard post={sale()} />);
    expect(screen.queryByRole("link", { name: /Ver cómo me veo/ })).not.toBeInTheDocument();
    unmount();

    render(
      <PostCard
        post={sale({
          product: product({ tryOn: true, inStock: false, availability: "sold_out" }),
        })}
      />,
    );
    expect(screen.queryByRole("link", { name: /Ver cómo me veo/ })).not.toBeInTheDocument();
  });

  it("muestra envío, entrega local, devoluciones y garantía de los datos estructurados", () => {
    render(
      <PostCard
        post={sale({
          product: product({
            facts: facts({
              nationalShippingAvailable: true,
              shippingPriceCents: 14_900,
              deliveryMinDays: 3,
              deliveryMaxDays: 7,
              localDeliveryAvailable: true,
              localDeliveryZones: ["Zapopan", "Guadalajara Centro"],
              returnWindowDays: 15,
              warrantyType: "SELLER",
              warrantyDays: 90,
            }),
          }),
        })}
      />,
    );

    expect(screen.getByText("+ $149 de envío a todo México · 3 a 7 días")).toBeInTheDocument();
    expect(
      screen.getByText("Entrega local sin costo en Zapopan y Guadalajara Centro"),
    ).toBeInTheDocument();
    expect(screen.getByText("15 días para devolverlo")).toBeInTheDocument();
    expect(screen.getByText("Garantía del vendedor de 90 días")).toBeInTheDocument();
  });

  it("sin datos de entrega no promete nada", () => {
    render(<PostCard post={sale()} />);

    expect(screen.queryByText(/envío|Entrega|devolverlo|Garantía/)).not.toBeInTheDocument();
  });

  it("«En tu presupuesto» solo si el servidor lo calculó", () => {
    const { rerender } = render(<PostCard post={sale()} />);
    expect(screen.queryByText("En tu presupuesto")).not.toBeInTheDocument();

    rerender(
      <PostCard post={sale({ viewer: { reaction: null, saved: false, withinBudget: true } })} />,
    );
    expect(screen.getByText("En tu presupuesto")).toBeInTheDocument();
  });

  it("un producto pausado dice «Pausado», no «Agotado», y no muestra precio", () => {
    render(
      <PostCard post={sale({ product: product({ availability: "paused", inStock: false }) })} />,
    );

    expect(screen.getByText("Pausado")).toBeInTheDocument();
    expect(screen.queryByText("Agotado")).not.toBeInTheDocument();
    expect(screen.queryByText("$899")).not.toBeInTheDocument();
  });

  it("un producto agotado dice «Agotado»", () => {
    render(
      <PostCard post={sale({ product: product({ availability: "sold_out", inStock: false }) })} />,
    );

    expect(screen.getByText("Agotado")).toBeInTheDocument();
  });
});

describe("PostCard: por qué lo ves", () => {
  const chip = () => document.querySelector('[data-slot="intent-chip"]');

  it("dice la búsqueda declarada que coincidió", () => {
    render(
      <PostCard
        post={sale({
          ranking: ranking({ basis: "query", query: "tenis para correr", source: "declared" }),
        })}
      />,
    );

    expect(chip()).toHaveTextContent("Porque buscas “tenis para correr”");
    expect(screen.queryByText(/Encontramos algo/)).not.toBeInTheDocument();
  });

  it("una búsqueda pasada se dice en pasado", () => {
    render(
      <PostCard
        post={sale({ ranking: ranking({ basis: "query", query: "audífonos", source: "search" }) })}
      />,
    );

    expect(chip()).toHaveTextContent("Porque buscaste “audífonos”");
  });

  it("por comportamiento dice la categoría que vio, nunca una búsqueda", () => {
    render(
      <PostCard post={sale({ ranking: ranking({ basis: "viewed", categoryName: "Calzado" }) })} />,
    );

    expect(chip()).toHaveTextContent("Por lo que has visto en Calzado");
    expect(chip()).not.toHaveTextContent(/busca/);
  });

  it("sin explicación honesta no hay chip", () => {
    render(<PostCard post={sale({ ranking: ranking(null) })} />);

    expect(chip()).toBeNull();
  });
});

describe("PostCard: variantes", () => {
  const editorial = {
    ...post().author,
    username: "equipo.gaming",
    displayName: "Equipo VendeIA",
    isEditorial: true,
  };

  it("portada: la primera oración es el titular y no se repite en el texto", () => {
    render(
      <PostCard
        variant="cover"
        post={post({
          community: gaming,
          author: editorial,
          body: "¿Algo para jugar con amigos este fin? Nuestro top: It Takes Two.",
        })}
      />,
    );

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("data-variant", "cover");
    expect(
      screen.getByRole("heading", { level: 2, name: "¿Algo para jugar con amigos este fin?" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Nuestro top: It Takes Two.")).toBeInTheDocument();
    expect(article).not.toHaveTextContent(/fin\?.*¿Algo para jugar/);
  });

  it("tipográfica: tinte suave con el tono de la comunidad y tinta encima, con sus acciones", () => {
    const body = "¿Control o teclado y mouse para shooters?";
    render(<PostCard variant="bigType" post={post({ community: gaming, media: [], body })} />);

    const article = screen.getByRole("article");
    expect(article).toHaveAttribute("data-variant", "bigType");
    // El tinte es toda la tarjeta y lleva el tono de su comunidad; ya no es una isla oscura (ADR-042).
    expect(screen.getByText(body).closest(".community-soft")).toBe(article);
    expect(article.style.getPropertyValue("--hue")).toBe("285");
    expect(article).not.toHaveClass("dark");
    expect(
      within(article).getByRole("link", { name: "Sé la primera persona en comentar" }),
    ).toBeInTheDocument();
  });

  it("portada: barra compacta de íconos y números; las palabras quedan como nombre accesible", () => {
    render(
      <PostCard
        variant="cover"
        isSignedIn
        post={post({
          community: gaming,
          stats: { likes: 3, comments: 2, saves: 0, reactions: [] },
        })}
      />,
    );

    const like = screen.getByRole("button", { name: "Me gusta, 3" });
    expect(within(like).getByText("Me gusta")).toHaveClass("sr-only");
    expect(within(like).getByText("3")).toBeVisible();
    const comment = screen.getByRole("link", { name: "Comentar, 2 comentarios" });
    expect(within(comment).getByText("Comentar")).toHaveClass("sr-only");
    expect(within(comment).getByText("2")).toBeVisible();
    for (const name of ["Guardar", "Compartir"]) {
      expect(within(screen.getByRole("button", { name })).getByText(name)).toHaveClass("sr-only");
    }
  });

  it("portada: sin números, tampoco se ven las palabras (no se parten en la columna angosta)", () => {
    render(<PostCard variant="cover" isSignedIn post={post({ community: gaming })} />);

    expect(
      within(screen.getByRole("button", { name: "Me gusta" })).getByText("Me gusta"),
    ).toHaveClass("sr-only");
    expect(
      within(screen.getByRole("link", { name: "Comentar" })).getByText("Comentar"),
    ).toHaveClass("sr-only");
  });

  it("fuera de la portada las acciones llevan texto en escritorio", () => {
    render(<PostCard isSignedIn post={post({ community: gaming, media: [] })} />);

    expect(
      within(screen.getByRole("button", { name: "Me gusta" })).getByText("Me gusta"),
    ).toHaveClass("md:inline");
  });

  it("portada: un titular largo baja de tamaño para no pasar de 3 líneas", () => {
    const long =
      "Cuando suena la alarma del lunes y tu cuerpo decide que hoy no es buen día para existir.";
    render(<PostCard variant="cover" post={post({ community: gaming, body: long })} />);

    expect(screen.getByRole("heading", { level: 2, name: long })).toHaveAttribute(
      "data-size",
      "sm",
    );
  });

  it("si la pieza no encaja con la variante pedida, se pinta estándar", () => {
    render(<PostCard variant="cover" post={sale()} />);

    expect(screen.getByRole("article")).toHaveAttribute("data-variant", "standard");
  });
});

describe("PostCard: micro-respuestas (ADR-052)", () => {
  it("al dar «me gusta» el corazón salta, vibra una vez y el número entra animado", async () => {
    vi.mocked(reactAction).mockResolvedValue({ ok: true, kind: "LIKE", count: 1, top: ["LIKE"] });
    render(<PostCard post={post()} />);
    const like = screen.getByRole("button", { name: "Me gusta" });
    expect(like.querySelector("svg")).not.toHaveClass("motion-safe:animate-pop");

    await userEvent.click(like);

    expect(like).toHaveAttribute("aria-pressed", "true");
    expect(like.querySelector("svg")).toHaveClass("motion-safe:animate-pop");
    expect(within(like).getByText("1")).toHaveClass("motion-safe:animate-in");
    expect(tapHaptic).toHaveBeenCalledTimes(1);
  });

  it("quitar el «me gusta» no vibra ni anima el corazón", async () => {
    vi.mocked(reactAction).mockResolvedValue({ ok: true, kind: null, count: 2, top: ["LIKE"] });
    render(
      <PostCard
        post={post({
          stats: { likes: 3, comments: 0, saves: 0, reactions: [] },
          viewer: { reaction: "LIKE", saved: false, withinBudget: false },
        })}
      />,
    );
    const like = screen.getByRole("button", { name: "Me gusta, 3" });

    await userEvent.click(like);

    expect(like).toHaveAttribute("aria-pressed", "false");
    expect(like.querySelector("svg")).not.toHaveClass("motion-safe:animate-pop");
    expect(tapHaptic).not.toHaveBeenCalled();
  });

  it("guardar avisa «Guardado» con la liga a Guardados; quitarlo, no", async () => {
    vi.mocked(toggleSaveAction).mockResolvedValue({ ok: true, active: true, count: 1 });
    render(<PostCard post={post()} />);

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(toast).toHaveBeenCalledWith(
      "Guardado",
      expect.objectContaining({ action: expect.objectContaining({ label: "Ver" }) }),
    );
    expect(tapHaptic).toHaveBeenCalledTimes(1);
  });
});
