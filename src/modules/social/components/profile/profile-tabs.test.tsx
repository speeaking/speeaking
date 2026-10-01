import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { ProfileTabs, type ProfileTabItem } from "./profile-tabs";

const items: ProfileTabItem[] = [
  { id: "publicaciones", label: "Publicaciones", count: 3, content: <p>Lista de publicaciones</p> },
  { id: "fotos", label: "Fotos", content: <p>Cuadrícula de fotos</p> },
  { id: "tienda", label: "Tienda", count: 2, content: <p>Productos en venta</p> },
];

describe("ProfileTabs", () => {
  it("abre en la pestaña inicial, con sus conteos, y cambia al tocar otra", async () => {
    render(<ProfileTabs initial="tienda" items={items} />);

    const shop = screen.getByRole("tab", { name: /Tienda/ });
    expect(shop).toHaveAttribute("aria-selected", "true");
    expect(shop).toHaveTextContent("2");
    expect(screen.getByText("Productos en venta")).toBeVisible();
    expect(screen.queryByText("Cuadrícula de fotos")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("tab", { name: /Fotos/ }));

    expect(screen.getByText("Cuadrícula de fotos")).toBeVisible();
    expect(screen.queryByText("Productos en venta")).not.toBeInTheDocument();
  });

  it("solo pinta las pestañas que recibe (sin Tienda cuando no vende nada)", () => {
    render(<ProfileTabs initial="publicaciones" items={items.slice(0, 2)} />);

    expect(screen.getAllByRole("tab")).toHaveLength(2);
    expect(screen.queryByRole("tab", { name: /Tienda/ })).not.toBeInTheDocument();
  });
});
