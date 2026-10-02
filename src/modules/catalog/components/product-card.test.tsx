import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { ProductCardDTO } from "../queries";
import { ProductCard } from "./product-card";

const product = (overrides: Partial<ProductCardDTO> = {}): ProductCardDTO => ({
  id: "0199a000-0000-7000-8000-00000000000a",
  slug: "camisa-blanca",
  title: "Camisa blanca",
  priceCents: 89_900,
  currency: "MXN",
  city: "Guadalajara",
  inStock: true,
  tryOn: true,
  image: null,
  ...overrides,
});

describe("ProductCard", () => {
  it("en una prenda con existencia ofrece «Ver cómo me veo» y abre la ficha con el diálogo", () => {
    render(<ProductCard product={product()} from="buscar" />);

    expect(screen.getByRole("link", { name: "Ver cómo me veo: Camisa blanca" })).toHaveAttribute(
      "href",
      "/producto/camisa-blanca?probar=1&from=buscar",
    );
    // La tarjeta sigue enlazando a la ficha; son dos enlaces hermanos, no anidados.
    expect(screen.getByRole("link", { name: /Camisa blanca\s*\$899/ })).toHaveAttribute(
      "href",
      "/producto/camisa-blanca?from=buscar",
    );
  });

  it("no lo ofrece fuera de moda ni cuando está agotado", () => {
    const { unmount } = render(<ProductCard product={product({ tryOn: false })} />);
    expect(screen.queryByRole("link", { name: /Ver cómo me veo/ })).not.toBeInTheDocument();
    unmount();

    render(<ProductCard product={product({ inStock: false })} />);
    expect(screen.queryByRole("link", { name: /Ver cómo me veo/ })).not.toBeInTheDocument();
    expect(screen.getByText("Agotado")).toBeInTheDocument();
  });

  it("«Ver cómo me veo» se ancla a la foto, no al pie: un título de dos líneas no lo tapa", () => {
    render(<ProductCard product={product({ title: "Camisa blanca de lino con manga larga" })} />);

    // jsdom no calcula el layout: se fija la estructura. El botón vive en un marco que cubre
    // exactamente la foto (arriba, a todo lo ancho y con su misma proporción), así que no depende
    // de lo alto que quede el texto de abajo.
    const aspect = (element: Element) =>
      [...element.classList].find((name) => name.startsWith("aspect-"));
    const photo = screen.getByRole("link", { name: /\$899/ }).firstElementChild!;
    const tryOn = screen.getByRole("link", { name: /^Ver cómo me veo:/ });
    const frame = tryOn.parentElement!;

    expect(aspect(photo)).toBeDefined();
    expect(aspect(frame)).toBe(aspect(photo));
    expect(frame).toHaveClass("absolute", "inset-x-0", "top-0");
    expect(tryOn).toHaveClass("absolute", "right-2", "bottom-2");
    expect(tryOn.className).not.toMatch(/bottom-\[/);
    // El marco no le roba el toque a la foto (que abre la ficha); el botón sí lo recibe.
    expect(frame).toHaveClass("pointer-events-none");
    expect(tryOn).toHaveClass("pointer-events-auto");
  });
});

describe("ProductCard: la foto que viaja (ADR-052)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dos tarjetas del mismo producto conviven sin pelearse por el nombre de transición", () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <>
        <ProductCard
          product={product({
            image: { url: "/media/a.webp", width: 800, height: 1000, blurDataUrl: null, alt: null },
          })}
        />
        <ProductCard
          product={product({
            image: { url: "/media/a.webp", width: 800, height: 1000, blurDataUrl: null, alt: null },
          })}
        />
      </>,
    );

    const morphs = document.querySelectorAll('[data-slot="product-image-morph"]');
    expect(morphs).toHaveLength(2);
    expect(document.querySelectorAll("[data-armed]")).toHaveLength(0);

    // Solo la tarjeta tocada se arma; la otra sigue sin nombre.
    fireEvent.pointerDown(morphs[0]!);
    expect(document.querySelectorAll("[data-armed]")).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
  });
});
