import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PendingCard, Sparkline, StatTile, TrendBadge } from "./panel-pieces";
import { formatHours, PerformanceCard } from "./performance-card";

describe("TrendBadge", () => {
  it("dice si sube o baja contra el periodo anterior; sin periodo anterior no se pinta", () => {
    const { container, rerender } = render(<TrendBadge changePct={-6.8} />);
    expect(container).toHaveTextContent("6.8 % menos que la semana anterior");

    rerender(<TrendBadge changePct={12} />);
    expect(container).toHaveTextContent("12 % más que la semana anterior");

    rerender(<TrendBadge changePct={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe("StatTile", () => {
  it("el enlace se llama como su etiqueta; el número queda como contenido", () => {
    render(<StatTile label="Ventas" value="$3,499" href="/studio/pedidos" footer="Hoy" />);

    expect(screen.getByRole("link", { name: "Ventas" })).toHaveAttribute("href", "/studio/pedidos");
    expect(screen.getByText("$3,499")).toBeInTheDocument();
  });
});

describe("Sparkline", () => {
  it("la gráfica es decorativa y los valores van en una lista para lectores de pantalla", () => {
    render(
      <Sparkline
        points={[
          { day: "2026-09-30", label: "mié", value: 0 },
          { day: "2026-10-01", label: "jue", value: 64_900 },
        ]}
      />,
    );

    expect(screen.getByRole("list", { name: "Ventas por día" })).toHaveTextContent("jue: $649");
    expect(document.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});

describe("PendingCard", () => {
  it("solo enlista lo que tiene número; sin pendientes dice «Todo en orden»", () => {
    const { rerender } = render(
      <PendingCard
        title="Pendientes en tus ventas"
        allClear="Todo en orden."
        items={[
          { label: "Por despachar", count: 2, href: "/studio/pedidos", detail: "El más antiguo" },
          { label: "En camino", count: 0, href: "/studio/pedidos" },
        ]}
      />,
    );

    const region = screen.getByRole("region", { name: "Pendientes en tus ventas" });
    expect(region).toHaveTextContent("Por despachar");
    expect(region).not.toHaveTextContent("En camino");

    rerender(
      <PendingCard
        title="Pendientes en tus ventas"
        allClear="Todo en orden."
        items={[{ label: "En camino", count: 0, href: "/studio/pedidos" }]}
      />,
    );
    expect(screen.getByText("Todo en orden.")).toBeInTheDocument();
  });
});

describe("PerformanceCard", () => {
  it("sin pedidos suficientes lo dice con cuántos lleva", () => {
    render(<PerformanceCard performance={{ enough: false, orders: 2, needed: 5 }} />);

    expect(screen.getByText(/a partir de 5 pedidos pagados y llevas 2/)).toBeInTheDocument();
  });

  it("con datos muestra despacho y cancelaciones con su nivel", () => {
    render(
      <PerformanceCard
        performance={{
          enough: true,
          orders: 8,
          dispatch: { medianHours: 18, level: "excelente", overdue: 1 },
          cancellation: { rate: 0.125, level: "por_mejorar", cancelled: 1 },
        }}
      />,
    );

    expect(
      screen.getByText(/sale en 18 h o menos · 1 con más de 72 h esperando/),
    ).toBeInTheDocument();
    expect(screen.getByText("Excelente")).toBeInTheDocument();
    expect(screen.getByText("12.5 % de 8 pedidos")).toBeInTheDocument();
    expect(screen.getByText("Por mejorar")).toBeInTheDocument();
  });

  it("formatHours: horas hasta dos días, después días", () => {
    expect(formatHours(18.4)).toBe("18 h");
    expect(formatHours(60)).toBe("2.5 días");
  });
});
