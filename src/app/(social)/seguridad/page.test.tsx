import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import SecurityPage from "./page";

describe("Seguridad y privacidad", () => {
  it("«Quién responde» no afirma lo que el aviso de privacidad aún no publica", () => {
    render(<SecurityPage />);

    const section = screen.getByRole("heading", { name: "Quién responde" }).parentElement!;
    // El aviso dice que el responsable, su domicilio y el medio para ejercer los derechos se
    // completarán antes del lanzamiento (privacidad/page.tsx): esta página no puede decir que ya
    // están ahí.
    expect(section).not.toHaveTextContent("El aviso de privacidad dice quién es la persona");
    expect(section).toHaveTextContent(
      "todavía no están publicados: se agregarán al aviso antes del lanzamiento",
    );
    expect(screen.getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute(
      "href",
      "/privacidad",
    );
    expect(screen.getByRole("link", { name: "Términos y reglas" })).toHaveAttribute(
      "href",
      "/terminos",
    );
  });
});
