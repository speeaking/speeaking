import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SessionsList } from "./sessions-section";

// La sesión, la base y la acción viven en el servidor; aquí solo se prueba lo que se muestra.
vi.mock("../actions", () => ({ signOutEverywhereAction: vi.fn() }));
vi.mock("../session", () => ({ getSession: vi.fn() }));
vi.mock("../sessions", () => ({ listOpenSessions: vi.fn() }));

const NOW = new Date("2026-09-26T12:00:00Z");

// SEC-10: ver dónde está abierta la cuenta y cerrarla en todos lados.
describe("SessionsList", () => {
  it("lista los dispositivos y marca el actual", () => {
    render(
      <SessionsList
        now={NOW}
        sessions={[
          { id: "a", device: "Chrome en Android", lastActiveAt: NOW, current: true },
          {
            id: "b",
            device: "Safari en macOS",
            lastActiveAt: new Date("2026-09-24T12:00:00Z"),
            current: false,
          },
        ]}
      />,
    );

    const section = screen.getByRole("region", { name: "Tus sesiones" });
    const items = within(section).getAllByRole("listitem");
    expect(items.map((item) => item.textContent)).toEqual([
      "Chrome en AndroidEste dispositivo",
      "Safari en macOSActiva hace 2 días",
    ]);
  });

  it("ofrece cerrar sesión en todos los dispositivos", () => {
    render(<SessionsList now={NOW} sessions={[]} />);

    expect(
      screen.getByRole("button", { name: "Cerrar sesión en todos los dispositivos" }),
    ).toHaveAttribute("type", "submit");
    expect(screen.getByText(/Incluye este dispositivo/)).toBeInTheDocument();
  });
});
