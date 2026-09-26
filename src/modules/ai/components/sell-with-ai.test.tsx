import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const aiAvailability = vi.hoisted(() => vi.fn());
vi.mock("../tasks/availability", () => ({ aiAvailability }));
vi.mock("./sell-with-ai-form", () => ({
  SellWithAiForm: ({ simulated }: { simulated?: boolean }) => (
    <p>{simulated ? "formulario simulado" : "formulario"}</p>
  ),
}));

const { SellWithAi } = await import("./sell-with-ai");

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SellWithAi (ADR-038)", () => {
  it("con un modelo de verdad, el formulario de siempre", async () => {
    aiAvailability.mockResolvedValue("real");
    render(await SellWithAi());
    expect(aiAvailability).toHaveBeenCalledWith("sale_proposal");
    expect(screen.getByText("formulario")).toBeInTheDocument();
  });

  it("con la IA simulada de un piloto, el formulario marca la propuesta como ejemplo", async () => {
    aiAvailability.mockResolvedValue("simulated");
    render(await SellWithAi());
    expect(screen.getByText("formulario simulado")).toBeInTheDocument();
  });

  it("sin IA disponible no ofrece plantillas: invita a publicar a mano", async () => {
    aiAvailability.mockResolvedValue("unavailable");
    render(await SellWithAi());
    expect(
      screen.getByRole("heading", { name: "Por ahora publica tu producto a mano" }),
    ).toBeVisible();
    expect(screen.getByRole("link", { name: "Publicar a mano" })).toHaveAttribute(
      "href",
      "/studio/productos/nuevo",
    );
    expect(screen.queryByText(/formulario/)).not.toBeInTheDocument();
  });
});
