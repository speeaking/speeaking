import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { aggregatePlaces } from "../places";
import { PlaceLinks } from "./place-links";

const places = aggregatePlaces([
  { state: "Jalisco", count: 8 },
  { state: "CDMX", count: 6 },
  { state: "Puebla", count: 2 },
]);

describe("PlaceLinks", () => {
  it("enlaza solo los estados con página, en orden alfabético", () => {
    render(<PlaceLinks title="Compra por estado" places={places} />);

    const nav = screen.getByRole("navigation", { name: "Compra por estado" });
    expect(nav).toBeInTheDocument();
    expect(
      screen.getAllByRole("link").map((link) => [link.textContent, link.getAttribute("href")]),
    ).toEqual([
      ["Ciudad de México", "/comprar/en/ciudad-de-mexico"],
      ["Jalisco", "/comprar/en/jalisco"],
    ]);
  });

  it("en una categoría enlaza la categoría en cada estado", () => {
    render(<PlaceLinks title="Decoración por estado" places={places} categorySlug="decoracion" />);

    expect(screen.getByRole("link", { name: "Jalisco" })).toHaveAttribute(
      "href",
      "/comprar/decoracion/en/jalisco",
    );
  });

  it("sin estados con página no muestra nada", () => {
    const { container } = render(
      <PlaceLinks
        title="Compra por estado"
        places={aggregatePlaces([{ state: "Puebla", count: 2 }])}
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });
});
