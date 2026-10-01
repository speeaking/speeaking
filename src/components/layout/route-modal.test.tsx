import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { RouteModal } from "./route-modal";

const back = vi.fn();
let pathname = "/p/01a0d715-da33-72af-8a73-fcc13f938730";
vi.mock("next/navigation", () => ({
  useRouter: () => ({ back, push: vi.fn() }),
  usePathname: () => pathname,
}));

describe("RouteModal (ADR-052)", () => {
  it("abre en capa con su nombre y, al cerrar, regresa a la página anterior", async () => {
    render(
      <RouteModal label="Publicación" match="/p/">
        <p>Contenido de la publicación</p>
      </RouteModal>,
    );

    const dialog = screen.getByRole("dialog", { name: "Publicación" });
    expect(dialog).toHaveTextContent("Contenido de la publicación");

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("si la URL ya es de otra ruta, la capa no se pinta (el slot conserva el contenido anterior)", () => {
    pathname = "/comprar";
    render(
      <RouteModal label="Publicación" match="/p/">
        <p>Contenido viejo</p>
      </RouteModal>,
    );

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    pathname = "/p/01a0d715-da33-72af-8a73-fcc13f938730";
  });
});
