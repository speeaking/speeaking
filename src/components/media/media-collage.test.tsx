import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MediaCollage } from "./media-collage";
import type { MediaItem } from "./media-layout";

const photos = (count: number): MediaItem[] =>
  Array.from({ length: count }, (_, index) => ({
    url: `/media/foto-${index + 1}.webp`,
    width: 1000,
    height: 1000,
    blurDataUrl: null,
    alt: `Imagen ${index + 1} de la publicación de Ana`,
  }));

function renderCollage(count: number) {
  const { container } = render(<MediaCollage items={photos(count)} href="/p/abc" />);
  return container.firstElementChild as HTMLElement;
}

describe("MediaCollage", () => {
  it.each([
    [1, "1", 1],
    [2, "2", 2],
    [3, "3", 3],
    [4, "4", 4],
    [5, "5", 5],
    [7, "5", 5],
  ])("con %i fotos usa la forma %s y muestra %i mosaicos", (count, layout, tiles) => {
    const collage = renderCollage(count);

    expect(collage).toHaveAttribute("data-layout", layout);
    expect(screen.getAllByRole("link")).toHaveLength(tiles);
  });

  it("con 3 fotos la primera ocupa las dos filas", () => {
    renderCollage(3);

    expect(screen.getAllByRole("link")[0]).toHaveClass("row-span-2");
  });

  it("la proporción no depende de cuándo carguen las fotos y ninguna se deforma", () => {
    expect(parseFloat(renderCollage(2).style.aspectRatio)).toBeCloseTo(4 / 3);
    for (const image of screen.getAllByRole("img")) {
      expect(image).toHaveStyle({ objectFit: "cover" });
    }
  });

  it("una sola foto usa su propio marco acotado entre 4:5 y 1.91:1", () => {
    const { container } = render(
      <MediaCollage items={[{ ...photos(1)[0]!, width: 900, height: 1600 }]} href="/p/abc" />,
    );

    const collage = container.firstElementChild as HTMLElement;
    expect(parseFloat(collage.style.aspectRatio)).toBeCloseTo(4 / 5);
  });

  it("con 5 fotos van dos arriba y tres abajo, como en Facebook", () => {
    renderCollage(5);

    const links = screen.getAllByRole("link");
    expect(links.slice(0, 2).every((link) => link.classList.contains("col-span-3"))).toBe(true);
    expect(links.slice(2).every((link) => link.classList.contains("col-span-2"))).toBe(true);
  });

  it("con más de 5 fotos resume el resto con +N sobre el último mosaico", () => {
    renderCollage(10);

    const links = screen.getAllByRole("link");
    expect(screen.getByText("+5")).toBeInTheDocument();
    expect(links[4]).toHaveTextContent("+5");
    expect(links[4]).toHaveAccessibleName(/y 5 fotos más/);
  });

  it("sin fotos de más no hay +N", () => {
    renderCollage(5);

    expect(screen.queryByText(/^\+\d+$/)).not.toBeInTheDocument();
  });

  it("cada mosaico abre la publicación en esa foto", () => {
    renderCollage(3);

    const links = screen.getAllByRole("link");
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/p/abc",
      "/p/abc?foto=2",
      "/p/abc?foto=3",
    ]);
    expect(links[1]).toHaveAccessibleName("Imagen 2 de la publicación de Ana");
  });
});
