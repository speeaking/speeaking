import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { HomeCommunityDTO } from "../dto";
import { FOR_YOU, type FeedFilter } from "../feed-filter";
import { CommunityBubbles } from "./community-bubbles";

const community = (slug: string, name: string, hue = 285): HomeCommunityDTO => ({
  id: `id-${slug}`,
  slug,
  name,
  emoji: "🎮",
  hue,
});
const gaming = community("gaming", "Gaming");
const deportes = community("deportes", "Deportes", 145);
const moda = community("moda", "Moda", 12);

function renderBubbles(
  props: Partial<Parameters<typeof CommunityBubbles>[0]> = {},
  value: FeedFilter = FOR_YOU,
) {
  const onChange = vi.fn();
  render(
    <CommunityBubbles
      communities={[gaming, deportes]}
      suggested={[moda]}
      value={value}
      onChange={onChange}
      isSignedIn
      {...props}
    />,
  );
  return onChange;
}

describe("CommunityBubbles", () => {
  it("Para ti, Siguiendo y tus comunidades filtran; la activa lleva aria-pressed", () => {
    renderBubbles({}, { kind: "community", slug: "gaming", name: "Gaming" });

    const group = screen.getByRole("group", { name: "Filtra tu feed" });
    expect(within(group).getByRole("button", { name: "Para ti" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(group).getByRole("button", { name: "Siguiendo" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(within(group).getByRole("button", { name: "Gaming" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(within(group).getByRole("button", { name: "Deportes" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("tocar una comunidad o «Siguiendo» pide ese filtro", async () => {
    const onChange = renderBubbles();

    await userEvent.click(screen.getByRole("button", { name: "Deportes" }));
    expect(onChange).toHaveBeenLastCalledWith({
      kind: "community",
      slug: "deportes",
      name: "Deportes",
    });
    await userEvent.click(screen.getByRole("button", { name: "Siguiendo" }));
    expect(onChange).toHaveBeenLastCalledWith({ kind: "following" });
  });

  it("las sugeridas llevan «+» y abren la comunidad; Explorar va a Descubrir", () => {
    renderBubbles();

    expect(screen.getByRole("link", { name: "Moda, comunidad sugerida" })).toHaveAttribute(
      "href",
      "/c/moda",
    );
    expect(screen.queryByRole("button", { name: /Moda/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Explorar" })).toHaveAttribute("href", "/descubrir");
  });

  it("se llega con el teclado en orden: Para ti, Siguiendo, comunidades, sugeridas, Explorar", async () => {
    renderBubbles();

    const expected = [
      screen.getByRole("button", { name: "Para ti" }),
      screen.getByRole("button", { name: "Siguiendo" }),
      screen.getByRole("button", { name: "Gaming" }),
      screen.getByRole("button", { name: "Deportes" }),
      screen.getByRole("link", { name: "Moda, comunidad sugerida" }),
      screen.getByRole("link", { name: "Explorar" }),
    ];
    for (const element of expected) {
      await userEvent.tab();
      expect(element).toHaveFocus();
    }
  });

  it("muestra «N nuevas» solo si es mayor que cero, con nombre accesible", () => {
    renderBubbles({ unread: { [gaming.id]: 4, [deportes.id]: 0 } });

    expect(
      screen.getByRole("button", { name: "Gaming, 4 publicaciones nuevas" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deportes" })).toBeInTheDocument();
    const badges = document.querySelectorAll('[data-slot="unread-badge"]');
    expect(badges).toHaveLength(1);
    expect(badges[0]).toHaveTextContent("4");
  });

  it("al filtrar por una comunidad su contador desaparece (el servidor la marca como vista)", async () => {
    renderBubbles({ unread: { [gaming.id]: 4 } });

    await userEvent.click(screen.getByRole("button", { name: "Gaming, 4 publicaciones nuevas" }));

    expect(screen.getByRole("button", { name: "Gaming" })).toBeInTheDocument();
    expect(document.querySelector('[data-slot="unread-badge"]')).toBeNull();
  });

  it("más de 99 se resume en «99+»", () => {
    renderBubbles({ unread: { [gaming.id]: 250 } });

    expect(document.querySelector('[data-slot="unread-badge"]')).toHaveTextContent("99+");
  });

  it("con mouse, una flecha fuera del orden de tabulación desplaza la fila cuando no cabe", async () => {
    const scrollBy = vi.fn();
    const sizes = { clientWidth: 300, scrollWidth: 900, scrollLeft: 0 };
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(private readonly callback: () => void) {}
        observe() {
          this.callback();
        }
        disconnect() {}
      },
    );
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    // jsdom no mide: la fila (un <ul>) dice que su contenido es 3 veces más ancho que ella.
    const overrides = { ...sizes, scrollBy };
    for (const [key, value] of Object.entries(overrides)) {
      Object.defineProperty(HTMLUListElement.prototype, key, { configurable: true, value });
    }
    try {
      renderBubbles();
      const group = screen.getByRole("group", { name: "Filtra tu feed" });
      // Al principio solo hay «siguiente»; no es un control accesible (Tab ya llega a todo).
      const arrows = group.querySelectorAll<HTMLButtonElement>("button[aria-hidden='true']");
      expect(arrows).toHaveLength(1);
      expect(arrows[0]).toHaveAttribute("tabindex", "-1");

      await userEvent.click(arrows[0]!);
      expect(scrollBy).toHaveBeenCalledWith({ left: 225, behavior: "smooth" });
    } finally {
      for (const key of Object.keys(overrides)) {
        delete (HTMLUListElement.prototype as unknown as Record<string, unknown>)[key];
      }
      vi.unstubAllGlobals();
    }
  });

  it("sin desbordar (o sin medir) no hay flechas", () => {
    renderBubbles();

    const group = screen.getByRole("group", { name: "Filtra tu feed" });
    expect(group.querySelectorAll("button[aria-hidden='true']")).toHaveLength(0);
  });

  it("visitante: sin «Siguiendo» y todas las comunidades filtran", () => {
    renderBubbles({ isSignedIn: false, communities: [gaming, deportes, moda], suggested: [] });

    expect(screen.queryByRole("button", { name: "Siguiendo" })).not.toBeInTheDocument();
    for (const name of ["Gaming", "Deportes", "Moda"]) {
      expect(screen.getByRole("button", { name })).toHaveAttribute("aria-pressed", "false");
    }
    expect(screen.getByRole("button", { name: "Para ti" })).toHaveAttribute("aria-pressed", "true");
  });
});
