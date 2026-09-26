import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MediaCarousel } from "./media-carousel";
import type { MediaItem } from "./media-layout";

const photos = (count: number): MediaItem[] =>
  Array.from({ length: count }, (_, index) => ({
    url: `/media/foto-${index + 1}.webp`,
    width: 800,
    height: 1000,
    blurDataUrl: null,
    alt: `Tenis rojos, foto ${index + 1}`,
  }));

/** jsdom no calcula diseño: simulamos el ancho del carril y su desplazamiento. */
function mockTrack(width = 400) {
  const track = document.querySelector<HTMLDivElement>('[data-slot="carousel-track"]')!;
  Object.defineProperty(track, "clientWidth", { configurable: true, value: width });
  const scrollTo = vi.fn();
  track.scrollTo = scrollTo as typeof track.scrollTo;
  const scrollToSlide = (index: number) => {
    track.scrollLeft = index * width;
    fireEvent.scroll(track);
  };
  return { track, scrollTo, scrollToSlide };
}

const counter = () => screen.getByText(/^\d+\/\d+$/);

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("MediaCarousel", () => {
  it("expone el carrusel y cada diapositiva con ARIA en español", () => {
    render(<MediaCarousel items={photos(3)} label="Fotos de Tenis rojos" />);

    const carousel = screen.getByRole("region", { name: "Fotos de Tenis rojos" });
    expect(carousel).toHaveAttribute("aria-roledescription", "carrusel");
    const slides = within(carousel).getAllByRole("group");
    expect(slides).toHaveLength(3);
    expect(slides[1]).toHaveAttribute("aria-roledescription", "diapositiva");
    expect(slides[1]).toHaveAccessibleName("2 de 3");
    expect(screen.getByRole("img", { name: "Tenis rojos, foto 2" })).toBeInTheDocument();
  });

  it("el contador y los puntos siguen al desplazamiento", () => {
    render(<MediaCarousel items={photos(10)} label="Fotos" />);
    const { scrollToSlide } = mockTrack();

    expect(counter()).toHaveTextContent("1/10");
    scrollToSlide(2);
    expect(counter()).toHaveTextContent("3/10");
    expect(screen.getByText("Foto 3 de 10")).toHaveAttribute("aria-live", "polite");
    // Con la foto 3 la ventana de puntos sigue empezando en la 1: el activo es el tercero.
    const dots = [...document.querySelector('[data-slot="carousel-dots"]')!.children];
    expect(dots.findIndex((dot) => dot.hasAttribute("data-active"))).toBe(2);
    expect(dots.filter((dot) => dot.hasAttribute("data-active"))).toHaveLength(1);
  });

  it("con muchas fotos comprime los puntos a 7", () => {
    render(<MediaCarousel items={photos(10)} label="Fotos" />);

    const dots = document.querySelector('[data-slot="carousel-dots"]')!;
    expect(dots).toHaveAttribute("aria-hidden", "true");
    expect(dots.children).toHaveLength(7);
  });

  it("las flechas llevan a la foto anterior o siguiente y se desactivan en las orillas", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={photos(3)} label="Fotos" />);
    const { scrollTo, scrollToSlide } = mockTrack(400);

    const previous = screen.getByRole("button", { name: "Foto anterior" });
    const next = screen.getByRole("button", { name: "Foto siguiente" });
    expect(previous).toBeDisabled();

    await user.click(next);
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 400, behavior: "smooth" });

    scrollToSlide(2);
    expect(next).toBeDisabled();
    expect(previous).toBeEnabled();
  });

  it("responde a las flechas del teclado cuando tiene el foco", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={photos(4)} label="Fotos" />);
    const { track, scrollTo, scrollToSlide } = mockTrack(300);

    track.focus();
    await user.keyboard("{ArrowRight}");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 300, behavior: "smooth" });

    scrollToSlide(1);
    await user.keyboard("{ArrowLeft}");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 0, behavior: "smooth" });
    await user.keyboard("{End}");
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 900, behavior: "smooth" });
  });

  it("con movimiento reducido cambia de foto sin animación", async () => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) => ({ matches: query.includes("reduce"), media: query }) as MediaQueryList,
    );
    const user = userEvent.setup();
    render(<MediaCarousel items={photos(2)} label="Fotos" />);
    const { scrollTo } = mockTrack(400);

    await user.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(scrollTo).toHaveBeenLastCalledWith({ left: 400, behavior: "instant" });
  });

  it("abre en la foto pedida, desplazada antes de pintar", () => {
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(400);
    render(<MediaCarousel items={photos(5)} label="Fotos" initialIndex={3} />);

    expect(counter()).toHaveTextContent("4/5");
    expect(document.querySelector('[data-slot="carousel-track"]')!.scrollLeft).toBe(1200);
  });

  it("al llegar a la orilla con la flecha, el foco pasa al carril en vez de perderse", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={photos(3)} label="Fotos" />);
    const { track, scrollToSlide } = mockTrack(400);

    scrollToSlide(1);
    await user.click(screen.getByRole("button", { name: "Foto siguiente" }));
    expect(track).toHaveFocus();

    await user.click(screen.getByRole("button", { name: "Foto anterior" }));
    expect(track).toHaveFocus();
  });

  it("no intercepta atajos del navegador como Alt+←", async () => {
    const user = userEvent.setup();
    render(<MediaCarousel items={photos(3)} label="Fotos" />);
    const { track, scrollTo, scrollToSlide } = mockTrack(400);

    scrollToSlide(1);
    track.focus();
    await user.keyboard("{Alt>}{ArrowLeft}{/Alt}");
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("llena el marco si la foto casi coincide y si no la muestra completa sobre un fondo difuminado", () => {
    const blur = "data:image/webp;base64,AAAA";
    const items: MediaItem[] = [
      { ...photos(1)[0]!, blurDataUrl: blur },
      { ...photos(2)[1]!, width: 1000, height: 1000, blurDataUrl: blur },
    ];
    render(<MediaCarousel items={items} label="Fotos" aspect={4 / 5} />);

    const [portrait, square] = screen.getAllByRole("img");
    expect(portrait).toHaveStyle({ objectFit: "cover" });
    expect(square).toHaveStyle({ objectFit: "contain" });
    const [first, second] = screen.getAllByRole("group");
    expect(first!.querySelector('[aria-hidden="true"]')).toBeNull();
    expect(second!.querySelector('[aria-hidden="true"]')).toHaveStyle({
      backgroundImage: `url("${blur}")`,
    });
  });

  it('con fit="contain" nunca recorta', () => {
    render(<MediaCarousel items={photos(2)} label="Fotos" aspect={4 / 5} fit="contain" />);

    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveStyle({ objectFit: "contain" });
    }
  });

  it("con una sola foto no muestra controles de carrusel", () => {
    render(<MediaCarousel items={photos(1)} label="Fotos" />);

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Tenis rojos, foto 1" })).toBeInTheDocument();
  });

  it("el marco tiene proporción fija", () => {
    const { container } = render(<MediaCarousel items={photos(1)} label="Fotos" aspect={1} />);

    const frame = container.firstElementChild as HTMLElement;
    expect(parseFloat(frame.style.aspectRatio)).toBe(1);
  });

  it("pinta el contenido encima dentro del marco, con una o varias fotos", () => {
    const overlay = <button type="button">$899</button>;
    const { unmount } = render(<MediaCarousel items={photos(1)} label="Fotos" overlay={overlay} />);
    const single = screen.getByRole("button", { name: "$899" });
    expect(single.parentElement).toContainElement(screen.getByRole("img"));
    unmount();

    render(<MediaCarousel items={photos(3)} label="Fotos" overlay={overlay} />);
    const track = document.querySelector('[data-slot="carousel-track"]')!;
    expect(track.parentElement).toContainElement(screen.getByRole("button", { name: "$899" }));
  });
});
