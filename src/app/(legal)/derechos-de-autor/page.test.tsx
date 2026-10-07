import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { LEGAL_VERSIONS } from "@/modules/identity/constants";
import { OPERATOR } from "../operator";

// El formulario llama a una acción del servidor (base, límites, Turnstile): aquí no se ejecuta.
vi.mock("@/modules/rights/actions", () => ({ submitNoticeAction: vi.fn(async () => ({})) }));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
const turnstile = vi.hoisted(() => ({ siteKey: undefined as string | undefined }));
vi.mock("@/modules/identity/turnstile", () => ({ turnstileSiteKey: () => turnstile.siteKey }));

const { default: CopyrightPage } = await import("./page");

type Props = Parameters<typeof CopyrightPage>[0];
/** Sin `?url=`: como se abre desde el pie de página o los Términos. */
const NO_PARAMS = {
  params: Promise.resolve({}),
  searchParams: Promise.resolve({}),
} as unknown as Props;
const withUrl = (url: string) =>
  ({ params: Promise.resolve({}), searchParams: Promise.resolve({ url }) }) as unknown as Props;

describe("/derechos-de-autor (ADR-076)", () => {
  beforeEach(() => {
    turnstile.siteKey = undefined;
  });

  it("muestra la versión y las anclas que enlazan los Términos, /seguridad y «Reportar»", async () => {
    render(await CopyrightPage(NO_PARAMS));

    const banner = screen.getByText(/Borrador para revisión legal/);
    expect(banner).toHaveTextContent(`versión ${LEGAL_VERSIONS.terms}`);
    expect(banner).toHaveTextContent(/vigente desde el \d{1,2} de [a-z]+ de \d{4}/);
    for (const [id, name] of [
      ["aviso", "Enviar un aviso"],
      ["contra-aviso", "Contra-aviso: si retiramos algo tuyo"],
      ["reincidencia", "Política de reincidencia"],
    ] as const) {
      expect(document.getElementById(id)).toHaveRole("heading");
      expect(screen.getByRole("link", { name })).toHaveAttribute("href", `#${id}`);
    }
  });

  it("dice que el aviso formal no es anónimo y la regla de reincidencia", async () => {
    render(await CopyrightPage(NO_PARAMS));

    const page = document.body;
    // Solo si se retira: un aviso pendiente o rechazado no expone a quien lo mandó.
    expect(page).toHaveTextContent(
      "si retiramos lo que señalas, quien subió el contenido recibe tu nombre, tu correo y la descripción de tu aviso",
    );
    expect(page).toHaveTextContent(
      "te enviamos una copia con su nombre, su contacto y su domicilio",
    );
    expect(page).toHaveTextContent("Con 3 faltas en 12 meses cerramos la cuenta y su tienda.");
    expect(page).toHaveTextContent("Las cuentas dedicadas a la piratería se cierran a la primera.");
    expect(page).toHaveTextContent(
      "Los memes y las parodias que usan obras ajenas no tienen una excepción clara",
    );
    expect(page).toHaveTextContent(
      "no te pedimos certificados de registro, títulos ni otros documentos",
    );
    expect(page).toHaveTextContent("tu aviso no se detiene si faltan");
    expect(page).toHaveTextContent(
      "Si lo que señalas lo subieron varias cuentas, abrimos un caso para cada una",
    );
  });

  it("imagen y voz de artistas: protegidas también frente a la IA, con la excepción de la ley", async () => {
    render(await CopyrightPage(NO_PARAMS));

    // Art. 87 (reforma DOF 14-05-2026): la parodia, la sátira y la imitación creativa no infringen;
    // la clonación que engaña al público o sustituye a la persona artista, sí.
    const page = document.body;
    expect(page).not.toHaveTextContent("incluso cuando se imitan");
    expect(page).toHaveTextContent(
      "La parodia, la sátira y la imitación creativa no infringen este derecho",
    );
    expect(page).toHaveTextContent("una clonación o suplantación que engañe al público");
  });

  it("los datos del responsable y los buzones se ven pendientes: nunca inventados", async () => {
    render(await CopyrightPage(NO_PARAMS));

    const contact = screen.getByRole("heading", { name: "Contacto para avisos" }).parentElement!;
    for (const pending of [
      OPERATOR.rightsEmail,
      OPERATOR.rightsAltEmail,
      OPERATOR.legalName,
      OPERATOR.domicile,
    ]) {
      expect(within(contact).getByText(pending)).toBeInTheDocument();
    }
    expect(document.body).not.toHaveTextContent(/@speeaking\.(com|mx)/);
  });

  it("el formulario funciona sin cuenta y sus dos declaraciones nunca vienen marcadas", async () => {
    render(await CopyrightPage(NO_PARAMS));

    const sworn = screen.getByRole("checkbox", { name: /bajo protesta de decir verdad/ });
    const penalty = screen.getByRole("checkbox", { name: /multa de 1,000 a 20,000 UMA/ });
    expect(sworn).not.toBeChecked();
    expect(penalty).not.toBeChecked();
    expect(screen.getByRole("radio", { name: /Marca registrada en el IMPI/ })).not.toBeChecked();
    expect(screen.getByLabelText("Direcciones del contenido en speeaking")).toBeRequired();
    expect(screen.getByLabelText("Tu nombre completo o razón social")).toBeRequired();
    // Lo que pide el reglamento pero la ley no exige para retirar no detiene el aviso.
    expect(screen.getByLabelText("Domicilio (opcional)")).not.toBeRequired();
    expect(screen.getByLabelText("Cuéntanos brevemente qué pasó (opcional)")).not.toBeRequired();
    expect(screen.getByLabelText("Teléfono (opcional)")).not.toBeRequired();
    // Sin Turnstile configurado no se pide la verificación.
    expect(screen.queryByLabelText("Verificación de seguridad")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enviar aviso" })).toBeEnabled();
  });
});

describe("/derechos-de-autor desde «Reportar»", () => {
  it("trae prellenada la dirección de speeaking que se reportó, pero nunca una ajena", async () => {
    const { unmount } = render(
      await CopyrightPage(withUrl("https://www.speeaking.com/producto/bolsa-de-piel")),
    );
    expect(screen.getByLabelText(/Direcciones/)).toHaveValue(
      "https://www.speeaking.com/producto/bolsa-de-piel",
    );
    unmount();

    render(await CopyrightPage(withUrl("https://evil.example/producto/bolsa")));
    expect(screen.getByLabelText(/Direcciones/)).toHaveValue("");
  });
});
