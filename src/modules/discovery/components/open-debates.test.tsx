import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { DebateDTO, OpenDebatesDTO } from "../dto";
import { OpenDebates } from "./open-debates";

function debate(id: number, comments = 0): DebateDTO {
  return {
    id: `0199a000-0000-7000-8000-00000000000${id}`,
    text: `¿Pregunta ${id}?`,
    comments,
    community: { slug: `c${id}`, name: `Comunidad ${id}`, emoji: "🎮", hue: 40 * id },
  };
}

function debates(items: DebateDTO[], scope: OpenDebatesDTO["scope"] = "yours"): OpenDebatesDTO {
  return { scope, items, anyAnswered: items.some((item) => item.comments > 0) };
}

describe("OpenDebates", () => {
  it("numera 01–04 y, si nadie ha respondido, deja UNA sola invitación", () => {
    render(<OpenDebates debates={debates([1, 2, 3, 4].map((id) => debate(id)))} signedIn />);
    const region = screen.getByRole("region", { name: "Debates abiertos" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(4);
    expect(within(region).getByText("04")).toBeInTheDocument();
    expect(within(region).queryByText(/respuesta/)).toBeNull();
    expect(within(region).getAllByText(/la primera opinión puede ser la tuya/)).toHaveLength(1);
  });

  it("muestra solo los contadores reales mayores que cero", () => {
    render(<OpenDebates debates={debates([debate(1, 3), debate(2, 0), debate(3, 1)])} signedIn />);
    expect(screen.getByText("· 3 respuestas")).toBeInTheDocument();
    expect(screen.getByText("· 1 respuesta")).toBeInTheDocument();
    expect(screen.queryByText(/0 respuestas/)).toBeNull();
    expect(screen.queryByText(/la primera opinión/)).toBeNull();
  });

  it("sin preguntas: invitación a quien tiene sesión y nada para visitantes", () => {
    const { container, rerender } = render(<OpenDebates debates={debates([])} signedIn={false} />);
    expect(container).toBeEmptyDOMElement();
    rerender(<OpenDebates debates={debates([])} signedIn />);
    expect(screen.getByRole("link", { name: "Haz la primera" })).toHaveAttribute(
      "href",
      "/crear/publicacion",
    );
  });
});
