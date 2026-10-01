import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { RouteDrawer } from "./route-drawer";

const back = vi.hoisted(() => vi.fn());
const pathname = vi.hoisted(() => ({ current: "/p/abc/comentarios" }));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ back }),
  usePathname: () => pathname.current,
}));

beforeEach(() => {
  back.mockClear();
  pathname.current = "/p/abc/comentarios";
});

function renderDrawer() {
  return render(
    <RouteDrawer
      path="/p/abc/comentarios"
      title="Comentarios (2)"
      meta={<span>❤️ 3 reacciones</span>}
      footer={<button type="button">Comentar</button>}
    >
      <p>Primer comentario</p>
    </RouteDrawer>,
  );
}

describe("RouteDrawer (ADR-057)", () => {
  it("abre un panel con su título, su línea de reacciones, el contenido y lo fijo de abajo", () => {
    renderDrawer();

    const dialog = screen.getByRole("dialog", { name: "Comentarios (2)" });
    expect(dialog).toHaveTextContent("❤️ 3 reacciones");
    expect(dialog).toHaveTextContent("Primer comentario");
    expect(screen.getByRole("button", { name: "Comentar" })).toBeInTheDocument();
  });

  it("«Cerrar» termina la animación y regresa en el historial", async () => {
    renderDrawer();

    await userEvent.click(screen.getByRole("button", { name: "Cerrar" }));

    await waitFor(() => expect(back).toHaveBeenCalledTimes(1));
  });

  it("si la URL ya no es la suya (se navegó desde dentro), no se pinta", () => {
    pathname.current = "/u/ana";
    renderDrawer();

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(back).not.toHaveBeenCalled();
  });
});
