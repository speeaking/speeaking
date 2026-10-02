import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ComplementDTO } from "../complements";
import type { TryOnResultDTO } from "../service";
import { TryOnDialog } from "./try-on-dialog";

const quickTryOnAction = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ refresh: vi.fn(), push: vi.fn() }));
vi.mock("../actions", () => ({ quickTryOnAction }));
vi.mock("@/modules/commerce/actions", () => ({ addToCartAction: vi.fn(), buyNowAction: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const product = {
  id: "0199a000-0000-7000-8000-00000000000a",
  slug: "camisa-blanca",
  title: "Camisa blanca",
  priceCents: 89_900,
};

const pants: ComplementDTO = {
  id: "0199a000-0000-7000-8000-00000000000b",
  slug: "pantalon-de-vestir",
  title: "Pantalón de vestir",
  // Con la camisa suman $12,345: la etiqueta más larga que pedimos que quepa a 360 px.
  priceCents: 1_144_600,
  currency: "MXN",
  slot: "bottom",
  slotLabel: "Parte de abajo",
  image: null,
  sellerName: "Tienda Centro",
};

const result: TryOnResultDTO = {
  id: "0199a000-0000-7000-8000-0000000000aa",
  status: "READY",
  image: { url: "/media/simulacion.webp", width: 800, height: 1000, blurDataUrl: null },
  createdAt: "2026-10-01T12:00:00.000Z",
  expiresAt: "2026-10-31T12:00:00.000Z",
  funding: "PLATFORM",
  chargedCents: 0,
  simulated: false,
  cached: false,
  products: [],
};

async function openResult() {
  quickTryOnAction.mockResolvedValue({ result });
  render(
    <TryOnDialog
      product={product}
      photos={[{ id: "0199a000-0000-7000-8000-0000000000f1", url: "/media/yo.webp" }]}
      complements={[pants]}
      status="trial"
      simulated={false}
      returnTo="/producto/camisa-blanca"
      defaultOpen
    />,
  );
  const dialog = screen.getByRole("dialog");
  await userEvent.click(within(dialog).getByRole("button", { name: "Ver cómo me veo" }));
  await within(dialog).findByRole("heading", { name: "Así podrías verte" });
  return dialog;
}

describe("TryOnDialog: comprar desde la simulación", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("con complementos, «Comprar todo» lleva el total completo a todo lo ancho y «Al carrito» debajo", async () => {
    const dialog = await openResult();
    expect(within(dialog).getByRole("button", { name: "Comprar ahora" })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: /Pantalón de vestir/ }));

    // El total lo suma el código (P2) y se lee completo, sin recortar el precio.
    const buyAll = within(dialog).getByRole("button", { name: "Comprar todo · $12,345" });
    const toCart = within(dialog).getByRole("button", { name: "Al carrito" });
    // jsdom no calcula el layout: se fija la decisión. A 360–390 px dos columnas dejan ~140 px por
    // botón y el precio no cabe; en una columna cada botón ocupa todo el ancho (como el pie del
    // carrito, ADR-052) y el principal va primero.
    const row = buyAll.parentElement!;
    expect(toCart.parentElement).toBe(row);
    expect(row).toHaveClass("flex", "flex-col");
    expect(row).not.toHaveClass("grid-cols-2");
    expect(buyAll.compareDocumentPosition(toCart) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
