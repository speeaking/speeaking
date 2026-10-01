import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { getPostContextAction } from "../context-actions";
import { ContextButton } from "./context-button";

vi.mock("../context-actions", () => ({ getPostContextAction: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => "/p/abc" }));

const POST = "0199a000-0000-7000-8000-0000000000c1";

describe("ContextButton (ADR-060)", () => {
  it("al tocarlo pide el resumen, lo muestra con la nota de IA y se puede ocultar", async () => {
    vi.mocked(getPostContextAction).mockResolvedValue({
      ok: true,
      summary: "La colonia lleva tres días sin agua.",
      simulated: false,
      cached: true,
    });
    render(<ContextButton postId={POST} />);

    const button = screen.getByRole("button", { name: "Contexto" });
    expect(button).toHaveAttribute("aria-expanded", "false");
    await userEvent.click(button);

    const panel = await screen.findByRole("region", { name: "Contexto" });
    expect(await screen.findByText("La colonia lleva tres días sin agua.")).toBeInTheDocument();
    expect(panel).toHaveTextContent("Resumen hecho con IA a partir de esta publicación");
    expect(getPostContextAction).toHaveBeenCalledWith(POST);

    await userEvent.click(button);
    expect(screen.queryByRole("region", { name: "Contexto" })).not.toBeInTheDocument();
    // Volver a abrirlo no lo pide otra vez.
    await userEvent.click(button);
    expect(getPostContextAction).toHaveBeenCalledTimes(1);
  });

  it("con la IA simulada lo dice así", async () => {
    vi.mocked(getPostContextAction).mockResolvedValue({
      ok: true,
      summary: "Resumen.",
      simulated: true,
      cached: false,
    });
    render(<ContextButton postId={POST} />);
    await userEvent.click(screen.getByRole("button", { name: "Contexto" }));

    expect(await screen.findByText("Texto de ejemplo (IA simulada)")).toBeInTheDocument();
  });

  it("sin sesión invita a crear cuenta; si falla lo dice sin romper la tarjeta", async () => {
    vi.mocked(getPostContextAction).mockResolvedValueOnce({ ok: false, reason: "needs_auth" });
    const { unmount } = render(<ContextButton postId={POST} />);
    await userEvent.click(screen.getByRole("button", { name: "Contexto" }));
    expect(await screen.findByRole("link", { name: "Crea tu cuenta gratis" })).toHaveAttribute(
      "href",
      "/registro?next=%2Fp%2Fabc",
    );
    unmount();

    vi.mocked(getPostContextAction).mockRejectedValueOnce(new Error("red"));
    render(<ContextButton postId={POST} />);
    await userEvent.click(screen.getByRole("button", { name: "Contexto" }));
    expect(await screen.findByRole("status")).toHaveTextContent("No pudimos resumirla");
  });
});
