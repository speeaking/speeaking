import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CartSheetDTO } from "../cart-sheet";
import { CartSheet } from "./cart-sheet";

const cart: CartSheetDTO = {
  count: 3,
  subtotalCents: 2 * 34_900 + 89_900,
  currency: "MXN",
  lines: [
    {
      itemId: "item-1",
      slug: "airpods-pro-2",
      title: "AirPods Pro 2",
      imageUrl: null,
      quantity: 2,
      priceCents: 34_900,
      currency: "MXN",
      available: true,
    },
    {
      itemId: "item-2",
      slug: "tenis-rojos",
      title: "Tenis rojos",
      imageUrl: null,
      quantity: 1,
      priceCents: 89_900,
      currency: "MXN",
      available: false,
    },
  ],
};

describe("CartSheet (ADR-052)", () => {
  it("muestra lo agregado, el subtotal y las dos salidas sin sacar a la persona de la página", () => {
    render(<CartSheet open onOpenChange={vi.fn()} cart={cart} />);

    const dialog = screen.getByRole("dialog", { name: "Agregado al carrito" });
    expect(dialog).toHaveTextContent("3 piezas · $1,597");
    expect(screen.getByRole("link", { name: "AirPods Pro 2" })).toHaveAttribute(
      "href",
      "/producto/airpods-pro-2",
    );
    expect(dialog).toHaveTextContent("2 × $349");
    expect(dialog).toHaveTextContent("Ya no disponible");
    expect(screen.getByRole("link", { name: "Ir a pagar" })).toHaveAttribute("href", "/checkout");
    expect(screen.getByRole("button", { name: "Seguir viendo" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver el carrito completo" })).toHaveAttribute(
      "href",
      "/carrito",
    );
  });

  it("mientras llega el carrito, lo dice sin inventar números", () => {
    render(<CartSheet open onOpenChange={vi.fn()} cart={null} />);

    expect(screen.getByRole("dialog")).toHaveTextContent("Un momento…");
    expect(screen.queryByText(/piezas/)).not.toBeInTheDocument();
  });

  it("cerrado no pinta nada", () => {
    render(<CartSheet open={false} onOpenChange={vi.fn()} cart={cart} />);

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
