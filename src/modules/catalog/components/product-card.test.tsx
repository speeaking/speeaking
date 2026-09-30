import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
});
