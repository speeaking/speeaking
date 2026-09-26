import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button";

// Verifica la cadena de pruebas de componentes (jsdom + Testing Library + alias `@/`).
describe("Button", () => {
  it("es accesible por su rol y nombre", () => {
    render(<Button>Publicar</Button>);

    expect(screen.getByRole("button", { name: "Publicar" })).toBeInTheDocument();
  });

  it("ejecuta onClick al hacer clic", async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Guardar</Button>);

    await userEvent.click(screen.getByRole("button", { name: "Guardar" }));

    expect(onClick).toHaveBeenCalledOnce();
  });

  it("no ejecuta onClick cuando está deshabilitado", async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Comprar
      </Button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Comprar" }));

    expect(onClick).not.toHaveBeenCalled();
  });
});
