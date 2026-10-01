import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  PICKER_HEIGHT,
  PICKER_WIDTH,
  pickerAnchor,
  ReactionButton,
  reactionLabel,
} from "./reaction-button";

function setup(state: Parameters<typeof ReactionButton>[0]["state"]) {
  const onReact = vi.fn();
  const onToggle = vi.fn();
  render(<ReactionButton state={state} onReact={onReact} onToggle={onToggle} />);
  return { onReact, onToggle };
}

describe("reactionLabel", () => {
  it("lleva la reacción puesta y el número; sin reacción dice «Me gusta»", () => {
    expect(reactionLabel({ kind: null, count: 0, top: [] })).toBe("Me gusta");
    expect(reactionLabel({ kind: null, count: 3, top: ["LIKE"] })).toBe("Me gusta, 3");
    expect(reactionLabel({ kind: "HAHA", count: 1200, top: ["HAHA"] })).toBe("Me divierte, 1.2 k");
  });
});

describe("pickerAnchor", () => {
  const button = { left: 100, top: 300, bottom: 344 };

  it("abre encima del botón cuando cabe debajo de la barra superior", () => {
    expect(pickerAnchor(button, 56, 1280)).toEqual({
      left: 100,
      top: 300 - 8 - PICKER_HEIGHT,
      placement: "up",
    });
  });

  it("si arriba choca con la barra fija, abre debajo del botón", () => {
    expect(pickerAnchor({ ...button, top: 80, bottom: 124 }, 56, 1280)).toEqual({
      left: 100,
      top: 124 + 8,
      placement: "down",
    });
  });

  it("a los lados nunca se sale de la pantalla", () => {
    expect(pickerAnchor({ ...button, left: 300 }, 0, 375).left).toBe(375 - PICKER_WIDTH - 8);
    expect(pickerAnchor({ ...button, left: 2 }, 0, 375).left).toBe(8);
  });
});

describe("ReactionButton", () => {
  it("un toque simple llama a onToggle (❤️ o quitar), sin abrir la tira", async () => {
    const { onToggle, onReact } = setup({ kind: null, count: 0, top: [] });

    await userEvent.click(screen.getByRole("button", { name: "Me gusta" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onReact).not.toHaveBeenCalled();
    expect(screen.queryByRole("group", { name: "Reacciones" })).not.toBeInTheDocument();
  });

  it("«Elegir reacción» abre la tira con las seis y elegir una la cierra y avisa", async () => {
    const { onReact } = setup({ kind: null, count: 2, top: ["LIKE"] });

    const chooser = screen.getByRole("button", { name: "Elegir reacción" });
    expect(chooser).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(chooser);

    const picker = screen.getByRole("group", { name: "Reacciones" });
    expect(within(picker).getAllByRole("button")).toHaveLength(6);
    expect(chooser).toHaveAttribute("aria-expanded", "true");
    await userEvent.click(within(picker).getByRole("button", { name: "Me divierte" }));

    expect(onReact).toHaveBeenCalledWith("HAHA");
    expect(screen.queryByRole("group", { name: "Reacciones" })).not.toBeInTheDocument();
  });

  it("con una reacción puesta el botón la muestra, va presionado y la marca en la tira", async () => {
    setup({ kind: "WOW", count: 4, top: ["WOW", "LIKE"] });

    const button = screen.getByRole("button", { name: "Me asombra, 4" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("😮");
    await userEvent.click(screen.getByRole("button", { name: "Elegir reacción" }));
    expect(screen.getByRole("button", { name: "Me asombra" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "Me enoja" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("el resumen de emojis solo aparece con reacciones distintas del corazón", () => {
    const { rerender } = render(
      <ReactionButton
        state={{ kind: null, count: 9, top: ["LIKE"] }}
        onReact={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Me gusta, 9" })).not.toHaveTextContent("❤️");

    rerender(
      <ReactionButton
        state={{ kind: null, count: 9, top: ["LIKE", "HAHA", "SAD"] }}
        onReact={vi.fn()}
        onToggle={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Me gusta, 9" })).toHaveTextContent("❤️😂😢9");
  });

  it("Escape y la flecha arriba cierran y abren la tira desde el teclado", async () => {
    setup({ kind: null, count: 0, top: [] });
    const button = screen.getByRole("button", { name: "Me gusta" });

    button.focus();
    await userEvent.keyboard("{ArrowUp}");
    expect(screen.getByRole("group", { name: "Reacciones" })).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group", { name: "Reacciones" })).not.toBeInTheDocument();
  });
});
