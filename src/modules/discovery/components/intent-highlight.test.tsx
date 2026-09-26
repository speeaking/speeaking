import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { IntentHighlightDTO } from "../dto";
import { IntentHighlight } from "./intent-highlight";

vi.mock("../actions", () => ({ dismissIntentAction: vi.fn() }));
vi.mock("next/image", () => ({
  default: ({ alt }: { alt: string; children?: ReactNode }) => <span role="img" aria-label={alt} />,
}));

const intent: IntentHighlightDTO = {
  id: "0199a000-0000-7000-8000-0000000000c1",
  query: "tenis para correr",
  budgetMaxCents: 200_000,
  currency: "MXN",
  source: "ONBOARDING",
  createdAt: new Date().toISOString(),
  product: {
    slug: "tenis-ultraligeros",
    title: "Tenis para correr ultraligeros",
    priceCents: 149_900,
    currency: "MXN",
    city: "Guadalajara",
    image: null,
  },
};

describe("IntentHighlight: el producto no se repite si ya está en el feed", () => {
  it("sin repetición muestra el producto elegido por el servidor", () => {
    render(<IntentHighlight intent={intent} />);

    const region = screen.getByRole("region", { name: "Lo que buscas" });
    expect(
      within(region).getByRole("link", { name: /Tenis para correr ultraligeros/ }),
    ).toHaveAttribute("href", "/producto/tenis-ultraligeros");
  });

  it("si ya está en la primera página del feed, no lo repite y lo dice con honestidad", () => {
    render(<IntentHighlight intent={intent} productInFeed />);

    const region = screen.getByRole("region", { name: "Lo que buscas" });
    expect(within(region).queryByRole("link", { name: /ultraligeros/ })).not.toBeInTheDocument();
    expect(region).toHaveTextContent("Lo que mejor coincide ya está en tu feed.");
    // No dice que no haya coincidencias: sí las hay, solo que ya las tiene enfrente.
    expect(region).not.toHaveTextContent("Todavía no hay productos");
    expect(within(region).getByRole("link", { name: "Buscar más opciones" })).toHaveAttribute(
      "href",
      "/buscar?q=tenis%20para%20correr",
    );
  });
});
