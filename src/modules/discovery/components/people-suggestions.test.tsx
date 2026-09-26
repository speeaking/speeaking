import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { PersonSuggestionDTO } from "../dto";

// El servicio (base de datos) y las acciones del servidor se simulan.
vi.mock("../service", () => ({ getPeopleSuggestions: vi.fn() }));
vi.mock("../actions", () => ({
  dismissSuggestionAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/modules/social/follow-actions", () => ({
  toggleFollowAction: vi.fn(async () => ({ ok: true, following: true })),
}));

const { getPeopleSuggestions } = await import("../service");
const { dismissSuggestionAction } = await import("../actions");
const { toggleFollowAction } = await import("@/modules/social/follow-actions");
const { PeopleSuggestions } = await import("./people-suggestions");
const { PeopleSuggestionsView } = await import("./people-suggestions-view");

function person(id: number, overrides: Partial<PersonSuggestionDTO> = {}): PersonSuggestionDTO {
  return {
    userId: `0199a000-0000-7000-8000-00000000000${id}`,
    username: `persona${id}`,
    displayName: `Persona ${id}`,
    avatarUrl: null,
    isStore: false,
    reason: "También está en Gaming",
    ...overrides,
  };
}

async function renderSuggestions(variant: "rail" | "feed" = "rail") {
  const element = await PeopleSuggestions({ viewerId: "viewer", variant });
  return { element, ...render(<>{element}</>) };
}

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("PeopleSuggestions", () => {
  it("no pinta nada con menos de 3 candidatos reales", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([person(1), person(2)]);
    const { element, container } = await renderSuggestions();
    expect(element).toBeNull();
    expect(container).toBeEmptyDOMElement();
  });

  it("sin candidatos tampoco", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([]);
    const { element } = await renderSuggestions("feed");
    expect(element).toBeNull();
  });

  it("en la columna muestra 3 personas con su razón y la insignia de tienda", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([
      person(1, { reason: "La siguen 2 personas que sigues" }),
      person(2, { isStore: true, reason: "Comentó tu publicación" }),
      person(3),
      person(4),
    ]);
    await renderSuggestions();

    const region = screen.getByRole("region", { name: "Gente de tus comunidades" });
    expect(within(region).getAllByRole("listitem")).toHaveLength(3);
    expect(within(region).getByText("La siguen 2 personas que sigues")).toBeInTheDocument();
    expect(within(region).getByText("Tienda")).toBeInTheDocument();
    expect(within(region).queryByText("Persona 4")).not.toBeInTheDocument();
    expect(within(region).getByRole("link", { name: /Persona 1/ })).toHaveAttribute(
      "href",
      "/u/persona1",
    );
  });

  it("«Quitar» oculta a la persona y guarda el descarte", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([person(1), person(2), person(3)]);
    await renderSuggestions();

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar a Persona 2 de tus sugerencias" }),
    );
    expect(screen.queryByText("Persona 2")).not.toBeInTheDocument();
    expect(dismissSuggestionAction).toHaveBeenCalledWith(person(2).userId);
  });

  it("si el servidor rechaza «Quitar», la persona vuelve con un aviso", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([person(1), person(2), person(3)]);
    vi.mocked(dismissSuggestionAction).mockResolvedValueOnce({
      ok: false,
      error: "No es posible quitar esta sugerencia.",
    });
    await renderSuggestions();

    await userEvent.click(
      screen.getByRole("button", { name: "Quitar a Persona 2 de tus sugerencias" }),
    );
    expect(await screen.findByText("Persona 2")).toBeInTheDocument();
  });

  it("si falla la consulta no rompe la página: no pinta nada", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(getPeopleSuggestions).mockRejectedValue(new Error("db caída"));
    const { element } = await renderSuggestions();
    expect(element).toBeNull();
  });

  it("el carrusel del feed se puede cerrar y no vuelve en la misma sesión", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([person(1), person(2), person(3)]);
    const { unmount } = await renderSuggestions("feed");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar sugerencias de personas" }));
    expect(screen.queryByRole("region", { name: "Gente de tus comunidades" })).toBeNull();
    expect(window.sessionStorage.getItem("vendeia:gente-de-tus-comunidades:cerrado")).toBe("1");

    // Otra página de la misma sesión del navegador: sigue cerrado.
    unmount();
    await renderSuggestions("feed");
    expect(screen.queryByRole("region", { name: "Gente de tus comunidades" })).toBeNull();
  });

  it("en el carrusel se oye primero a la persona y después «Quitar»", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([person(1), person(2), person(3)]);
    await renderSuggestions("feed");

    const [first] = screen.getAllByRole("listitem");
    const card = within(first!);
    const order = [
      card.getByRole("link", { name: /Persona 1/ }),
      card.getByRole("button", { name: "Seguir a Persona 1" }),
      card.getByRole("button", { name: "Quitar a Persona 1 de tus sugerencias" }),
    ];
    const tabbables = [...first!.querySelectorAll("a, button")];
    expect(order.map((control) => tabbables.indexOf(control))).toEqual([0, 1, 2]);
  });

  it("el carrusel del feed trae tarjetas con avatar, nombre, razón, «Seguir» y «Quitar»", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([
      person(1, { reason: "La siguen 2 personas que sigues" }),
      person(2),
      person(3),
    ]);
    await renderSuggestions("feed");

    const region = screen.getByRole("region", { name: "Gente de tus comunidades" });
    const cards = within(region).getAllByRole("listitem");
    expect(cards).toHaveLength(3);
    const card = within(cards[0]!);
    expect(card.getByRole("link", { name: /Persona 1/ })).toHaveAttribute("href", "/u/persona1");
    expect(card.getByText("La siguen 2 personas que sigues")).toBeInTheDocument();
    expect(card.getByRole("button", { name: "Seguir a Persona 1" })).toBeInTheDocument();
    expect(
      card.getByRole("button", { name: "Quitar a Persona 1 de tus sugerencias" }),
    ).toBeInTheDocument();
    // Con mouse hay flechas; al inicio (y antes de medir) no se puede ir hacia atrás.
    expect(
      within(region).getByRole("button", { name: "Ver sugerencias anteriores" }),
    ).toBeDisabled();
    expect(within(region).getByRole("button", { name: "Ver más sugerencias" })).toHaveAttribute(
      "aria-controls",
      within(region).getByRole("list").id,
    );
  });

  it("«Seguir» pide ese estado exacto y la tarjeta se queda con «Siguiendo»", async () => {
    const people = [person(1), person(2), person(3), person(4)];
    const { rerender } = render(<PeopleSuggestionsView people={people} variant="feed" />);

    await userEvent.click(screen.getByRole("button", { name: "Seguir a Persona 2" }));
    expect(toggleFollowAction).toHaveBeenCalledWith(person(2).userId, true);

    // El servidor revalida y ya no sugiere a quien sigues; la tarjeta no desaparece ni se mueve.
    rerender(<PeopleSuggestionsView people={[person(1), person(3), person(4)]} variant="feed" />);
    const names = screen
      .getAllByRole("link")
      .map((link) => link.textContent?.match(/Persona \d/)?.[0]);
    expect(names).toEqual(["Persona 1", "Persona 2", "Persona 3", "Persona 4"]);
    expect(
      await screen.findByRole("button", { name: "Siguiendo, dejar de seguir a Persona 2" }),
    ).toHaveTextContent("Siguiendo");
  });

  it("en la columna, seguir a alguien no agranda la lista", async () => {
    const { rerender } = render(
      <PeopleSuggestionsView people={[person(1), person(2), person(3)]} variant="rail" />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Seguir a Persona 1" }));

    rerender(<PeopleSuggestionsView people={[person(2), person(3), person(4)]} variant="rail" />);
    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText("Persona 1")).toBeInTheDocument();
    expect(screen.queryByText("Persona 4")).toBeNull();
  });

  it("los botones del carrusel tienen área táctil de 44 px", async () => {
    vi.mocked(getPeopleSuggestions).mockResolvedValue([person(1), person(2), person(3)]);
    await renderSuggestions("feed");

    // 32 px + 6 px arriba y abajo; la × de 24 px + 10 px por lado; cerrar 28 px + 8 px por lado.
    expect(screen.getByRole("button", { name: "Seguir a Persona 1" })).toHaveClass(
      "h-8",
      "after:-inset-y-1.5",
    );
    expect(
      screen.getByRole("button", { name: "Quitar a Persona 1 de tus sugerencias" }),
    ).toHaveClass("size-6", "after:-inset-2.5");
    expect(screen.getByRole("button", { name: "Cerrar sugerencias de personas" })).toHaveClass(
      "size-7",
      "after:-inset-2",
    );
  });
});
