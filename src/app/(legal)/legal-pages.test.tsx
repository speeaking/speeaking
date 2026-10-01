import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import CookiesPage, { COOKIES_NOTICE_UPDATED } from "./cookies/page";
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
      ["«Buscar con una foto»", "buscar-con-una-foto"],
      ["«Contexto»", "contexto"],
      ["«Colaboraciones con tiendas»", "colaboraciones"],
      ["«Videos»", "videos"],
    ] as const) {
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `#${id}`);
      expect(document.getElementById(id)).toHaveRole("heading");
    }
  });

  it("promete solo lo que hacen la búsqueda por foto, los videos y las colaboraciones", () => {
    render(<PrivacyNoticePage />);

    const page = document.body;
    // La foto no se guarda (`search/photo-search-service.ts`: ni almacenamiento ni `AIRequest`).
    expect(page).toHaveTextContent("La foto no se guarda en ningún lado");
    // El navegador quita la ubicación y el servidor rechaza lo que la traiga (`video-metadata.ts`).
    expect(page).toHaveTextContent(
      "tu navegador los quita antes de subirlo y nuestro servidor no publica un video que todavía los traiga",
    );
    // Conteos por publicación sin quién (`creators/metrics.ts`).
    expect(page).toHaveTextContent("Nunca ven quién visitó, se probó o compró.");
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

  it("explica las colaboraciones y las cuentas editoriales como funcionan", () => {
    render(<TermsPage />);

    expect(screen.getByRole("link", { name: "«Colaboraciones con tiendas»" })).toHaveAttribute(
      "href",
      "#colaboraciones",
    );
    expect(document.getElementById("colaboraciones")).toHaveRole("heading");
    const page = document.body;
    // Apagado por omisión y solo productos a la venta (`creators/rules.ts`).
    expect(page).toHaveTextContent(
      "activaron «Aceptar colaboraciones» en su Studio (viene apagado)",
    );
    // Quitar la etiqueta quita también la marca (`removeProductTag`): no se promete otra cosa.
    expect(page).toHaveTextContent("la publicación sigue, ya sin el producto ni la etiqueta");
    expect(page).toHaveTextContent("no cobramos ni pagamos comisiones por ellos");
    // Redacción diaria (ADR-066): nada se publica sin aprobación.
    expect(page).toHaveTextContent("una persona del equipo revisa y aprueba antes de publicar");
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

describe("Cookies", () => {
  it("lista cada cookie real con su duración, dice que no hay de terceros y enlaza al aviso", () => {
    render(<CookiesPage />);

    expect(screen.getByRole("heading", { level: 1, name: "Cookies" })).toBeInTheDocument();
    expect(document.body).toHaveTextContent(`actualizado el ${COOKIES_NOTICE_UPDATED}`);
    for (const name of ["vendeia… (sesión)", "estreno-nav", "vendeia_bienvenida"]) {
      expect(screen.getByRole("cell", { name })).toBeInTheDocument();
    }
    expect(document.body).toHaveTextContent("No hay cookies de terceros, ni de publicidad");
    expect(document.body).toHaveTextContent("no te pedimos «aceptar cookies» al entrar");
    expect(screen.getAllByRole("link", { name: "aviso de privacidad" })[0]).toHaveAttribute(
      "href",
      "/privacidad#publicaciones-en-pantalla",
    );
  });
});
