import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { ProductCardDTO } from "@/modules/catalog/queries";
import type { FeedProductsDTO } from "../product-carousel-compose";
import { ProductCarousel } from "./product-carousel";

const product = (n: number): ProductCardDTO => ({
  id: `0199a000-0000-7000-8000-0000000000${n.toString().padStart(2, "0")}`,
  slug: `producto-${n}`,
  title: `Producto ${n}`,
  priceCents: 10_000 * n,
  currency: "MXN",
  city: "Guadalajara",
  inStock: true,
  tryOn: false,
  image: null,
});

const block: FeedProductsDTO = {
  title: "Lo más vendido",
  reason: "En los últimos 30 días",
  href: "/comprar",
  items: [
    { product: product(1), sponsored: true },
    { product: product(2), sponsored: false },
    { product: product(3), sponsored: false },
  ],
};

describe("ProductCarousel (ADR-051)", () => {
  it("título con su razón escrita, «Ver todo» a su destino y la etiqueta solo en lo patrocinado", () => {
    render(<ProductCarousel block={block} />);

    expect(screen.getByRole("region", { name: "Lo más vendido" })).toBeInTheDocument();
    expect(screen.getByText("En los últimos 30 días")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todo" })).toHaveAttribute("href", "/comprar");
    expect(screen.getAllByText("Patrocinado")).toHaveLength(1);
    // El patrocinado lleva `ref=destacado` (la tienda ve las visitas que le trajo); el resto, no.
    expect(screen.getByRole("link", { name: /Producto 1/ })).toHaveAttribute(
      "href",
      "/producto/producto-1?ref=destacado",
    );
    expect(screen.getByRole("link", { name: /Producto 2/ })).toHaveAttribute(
      "href",
      "/producto/producto-2",
    );
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
  });

  it("tiene flechas que controlan la fila y se apagan en los extremos", () => {
    render(<ProductCarousel block={block} />);

    const list = screen.getByRole("list", { name: "" }).closest("ul") ?? screen.getByRole("list");
    const previous = screen.getByRole("button", { name: "Ver productos anteriores" });
    const next = screen.getByRole("button", { name: "Ver más productos" });
    expect(previous).toHaveAttribute("aria-controls", list.id);
    expect(next).toHaveAttribute("aria-controls", list.id);
    // jsdom no mide: la fila «cabe» completa, así que las dos flechas están apagadas.
    expect(previous).toBeDisabled();
    expect(next).toBeDisabled();
  });

  it("sin razón no deja una línea vacía", () => {
    render(<ProductCarousel block={{ ...block, reason: "", title: "Patrocinado" }} />);

    expect(screen.getByRole("region", { name: "Patrocinado" })).toBeInTheDocument();
    expect(screen.queryByText("En los últimos 30 días")).not.toBeInTheDocument();
  });
});
