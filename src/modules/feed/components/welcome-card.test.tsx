import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { WelcomeCard } from "./welcome-card";

const moment = {
  firstName: "Sofía",
  communities: [
    { id: "c1", slug: "gaming", name: "Gaming", emoji: "🎮", hue: 285 },
    { id: "c2", slug: "deportes", name: "Deportes", emoji: "⚽", hue: 145 },
  ],
  query: "tenis para correr",
};

beforeEach(() => {
  document.cookie = "vendeia_bienvenida=1; path=/";
});

describe("WelcomeCard", () => {
  it("saluda y muestra lo que eligió: comunidades y búsqueda (sin presupuesto)", () => {
    render(<WelcomeCard moment={moment} />);

    expect(screen.getByRole("heading", { level: 2, name: "¡Listo, Sofía!" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Gaming" })).toHaveAttribute("href", "/c/gaming");
    expect(screen.getByRole("link", { name: "Deportes" })).toHaveAttribute("href", "/c/deportes");
    const search = screen.getByRole("link", { name: /^Buscando: tenis para correr/ });
    expect(search).toHaveAttribute("href", "/ajustes");
    expect(screen.getByRole("region", { name: "¡Listo, Sofía!" })).not.toHaveTextContent(/\$/);
  });

  it("sin búsqueda declarada no hay chip «Buscando»", () => {
    render(<WelcomeCard moment={{ ...moment, query: null }} />);

    expect(screen.queryByText(/Buscando/)).not.toBeInTheDocument();
  });

  it("al cerrarla borra la cookie de bienvenida (no vuelve a aparecer)", async () => {
    render(<WelcomeCard moment={moment} />);
    expect(document.cookie).toContain("vendeia_bienvenida=1");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar bienvenida" }));

    expect(document.cookie).not.toContain("vendeia_bienvenida=1");
  });

  it("se puede cerrar y el foco pasa al siguiente control", async () => {
    render(
      <>
        <WelcomeCard moment={moment} />
        <a href="/crear/publicacion">Siguiente control</a>
      </>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Cerrar bienvenida" }));

    expect(screen.queryByRole("heading", { name: "¡Listo, Sofía!" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Siguiente control" })).toHaveFocus();
  });
});
