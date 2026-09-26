import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Composer } from "./composer";

describe("Composer", () => {
  it("invita por su nombre y abre la página de crear publicación", () => {
    render(
      <Composer firstName="Sofía" displayName="Sofía Ramírez" username="sofia" avatarUrl={null} />,
    );

    expect(screen.getByRole("region", { name: "Crear publicación" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "¿Qué quieres compartir, Sofía?" })).toHaveAttribute(
      "href",
      "/crear/publicacion",
    );
  });

  it("«Foto» y «Pregunta» llevan una pista en la URL", () => {
    render(<Composer firstName="Ana" displayName="Ana" username="ana" avatarUrl={null} />);

    expect(screen.getByRole("link", { name: "Foto" })).toHaveAttribute(
      "href",
      "/crear/publicacion?tipo=foto",
    );
    expect(screen.getByRole("link", { name: "Pregunta" })).toHaveAttribute(
      "href",
      "/crear/publicacion?tipo=pregunta",
    );
  });

  it("no tiene el botón lima de Vende con IA", () => {
    render(<Composer firstName="Ana" displayName="Ana" username="ana" avatarUrl={null} />);

    expect(screen.queryByText(/Vende/)).not.toBeInTheDocument();
    expect(document.querySelector(".bg-ai")).toBeNull();
  });
});
