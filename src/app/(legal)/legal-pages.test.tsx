import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import PrivacyNoticePage from "./privacidad/page";
import TermsPage from "./terminos/page";

// Los textos legales son borradores: lo que falta llenar debe verse marcado como pendiente, y cada
// página muestra la versión con la que se registra el consentimiento.
describe("Aviso de privacidad", () => {
  it("muestra su versión y lo que cambió, con ligas a cada sección", () => {
    render(<PrivacyNoticePage />);

    expect(
      screen.getByText(`Borrador para revisión legal · versión ${LEGAL_VERSIONS.privacyNotice}`),
    ).toBeInTheDocument();
    for (const [name, id] of [
      ["«Publicaciones que ves en pantalla»", "publicaciones-en-pantalla"],
      ["«Autenticidad de los productos»", "autenticidad"],
      ["«Reportes y moderación»", "reportes-y-moderacion"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `#${id}`);
      expect(document.getElementById(id)).toHaveRole("heading");
    }
  });

  it("explica las impresiones visibles, su anonimización y el plazo del código de deduplicación", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    expect(page).toHaveTextContent(
      "al menos a la mitad dentro de tu pantalla (o, si es más alta que la pantalla, ocupa al menos la mitad de ella) durante 1 segundo seguido",
    );
    expect(page).toHaveTextContent(
      "sin tu cuenta, sin el grupo de prueba y con la hora redondeada",
    );
    // Sin cuenta la hora NO se redondea (`recordVisibleImpressions` guarda como `track`): el aviso
    // no promete lo que el código no hace.
    expect(page).toHaveTextContent(
      "Si navegas sin cuenta, se guarda sin cuenta a la cual ligarla, sin tu IP y sin grupo de prueba; en ese caso la hora no se redondea",
    );
    expect(page).not.toHaveTextContent("o navegas sin cuenta, se guarda sin ligarla a nadie");
    expect(page).toHaveTextContent("vence a más tardar a las 25 horas y después se borra");
  });

  it("deja marcados como pendientes el proveedor de IA y los plazos que el código no aplica", () => {
    render(<PrivacyNoticePage />);

    expect(screen.getAllByText("[Proveedor de IA: nombre y país — pendiente]")).toHaveLength(2);
    expect(
      screen.getByText(/^\[Plazo máximo — pendiente; propuesta: 180 días/),
    ).toBeInTheDocument();
    expect(screen.getByText("[Plazo máximo — pendiente]")).toBeInTheDocument();
  });
});

describe("Términos y condiciones", () => {
  it("muestra su versión, la señal opcional de IA y cómo se avisa de los cambios", () => {
    render(<TermsPage />);

    expect(
      screen.getByText(`Borrador para revisión legal · versión ${LEGAL_VERSIONS.terms}`),
    ).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Qué cambió en esta versión" })).toBeInTheDocument();
    expect(screen.getByText(/nunca decide sola\. Si declaraste/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Cambios" })).toBeInTheDocument();
  });

  it("solo promete bitácora para las acciones que el equipo tiene y registra", () => {
    render(<TermsPage />);

    // Ocultar, restaurar y cambiar a genérico quedan en la bitácora (`trust/service.ts`); suspender
    // la venta aún no tiene pantalla ni bitácora, así que no entra en esa promesa.
    expect(document.body).toHaveTextContent(
      "cambiar un producto a «genérico» y restaurar lo que hayamos ocultado por error. Estas acciones las toma una persona del equipo, nunca la inteligencia artificial, y quedan registradas",
    );
    expect(document.body).not.toHaveTextContent(
      "suspender la venta de una cuenta que incumpla estas reglas, y restaurar",
    );
  });
});
