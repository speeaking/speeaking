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

  it("«Si algo te afecta» lleva a Reportar, a los avisos de derechos y al camino urgente (ADR-076)", () => {
    render(<SecurityPage />);

    const section = screen.getByRole("heading", { name: "Si algo te afecta" }).parentElement!;
    // Los motivos prioritarios con su nombre en el formulario de reporte (`trust/labels.ts`).
    expect(section).toHaveTextContent("«Reportar»");
    expect(section).toHaveTextContent("«Contenido íntimo sin consentimiento»");
    expect(section).toHaveTextContent("«Pone en riesgo a un menor»");
    expect(section).toHaveTextContent("llama al 911");
    expect(screen.getByRole("link", { name: "Mandar un aviso de derechos" })).toHaveAttribute(
      "href",
      "/derechos-de-autor#aviso",
    );
    expect(screen.getByRole("link", { name: "Responder con un contra-aviso" })).toHaveAttribute(
      "href",
      "/derechos-de-autor#contra-aviso",
    );
    expect(screen.getByRole("link", { name: "política de reincidentes" })).toHaveAttribute(
      "href",
      "/derechos-de-autor#reincidencia",
    );
    // El correo para autoridades aún no existe: se ve como pendiente, no inventado.
    expect(
      screen.getByText("[Correo para autoridades y asuntos legales — pendiente]"),
    ).toBeInTheDocument();
  });
});
