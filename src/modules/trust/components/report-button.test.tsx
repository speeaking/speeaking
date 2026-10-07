import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ reportAction: vi.fn() }));
const navigation = vi.hoisted(() => ({ pathname: "/producto/tenis-rojos-k3j9x2" }));

vi.mock("../actions", () => actions);
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("next/navigation", () => ({ usePathname: () => navigation.pathname }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { ReportButton } = await import("./report-button");

const ID = "0199a000-0000-7000-8000-000000000001";

beforeEach(() => {
  vi.clearAllMocks();
  navigation.pathname = "/producto/tenis-rojos-k3j9x2";
  actions.reportAction.mockResolvedValue({ ok: true, message: "Gracias." });
});

async function openDialog(props: Partial<Parameters<typeof ReportButton>[0]> = {}) {
  render(
    <ReportButton
      targetType="PRODUCT"
      targetId={ID}
      isSignedIn
      returnTo="/producto/tenis-rojos-k3j9x2"
      {...props}
    />,
  );
  await userEvent.click(screen.getByRole("button", { name: /Reportar/ }));
  return screen.findByRole("dialog");
}

describe("ReportDialog", () => {
  it("ofrece los motivos urgentes; «Cuenta de un menor de edad» solo para una persona", async () => {
    const dialog = await openDialog();
    expect(within(dialog).getByLabelText("Contenido íntimo sin consentimiento")).toBeVisible();
    expect(within(dialog).getByLabelText("Pone en riesgo a un menor")).toBeVisible();
    expect(within(dialog).queryByLabelText("Cuenta de un menor de edad")).toBeNull();
  });

  it("a una persona se le puede reportar como cuenta de un menor", async () => {
    navigation.pathname = "/mensajes/abc";
    const dialog = await openDialog({ targetType: "USER", returnTo: "/mensajes/abc" });
    expect(within(dialog).getByLabelText("Cuenta de un menor de edad")).toBeVisible();
  });

  it("con un motivo urgente recuerda llamar al 911 y envía el reporte", async () => {
    const dialog = await openDialog();
    expect(within(dialog).queryByText(/llama al 911/)).toBeNull();

    await userEvent.click(within(dialog).getByLabelText("Pone en riesgo a un menor"));
    expect(
      within(dialog).getByText("Si alguien está en peligro inmediato, llama al 911."),
    ).toBeVisible();

    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar reporte" }));
    await waitFor(() => expect(actions.reportAction).toHaveBeenCalledTimes(1));
    const data = actions.reportAction.mock.calls[0]![1] as FormData;
    expect(data.get("reason")).toBe("CHILD_SAFETY");
    expect(data.get("targetType")).toBe("PRODUCT");
    expect(await screen.findByText("Reportado")).toBeInTheDocument();
  });

  it("derechos de autor o marca: no crea un reporte, explica que no es anónimo y lleva al aviso formal", async () => {
    const dialog = await openDialog();

    await userEvent.click(
      within(dialog).getByLabelText("Infringe mis derechos de autor o mi marca"),
    );

    // Lo mismo que dice /derechos-de-autor: la ley obliga a mandar el contra-aviso a quien avisó; que
    // quien publicó reciba los datos del aviso es regla de speeaking, no «por ley».
    expect(
      within(dialog).getByText(
        "Los avisos por derechos de autor o de marca no son anónimos: quien publicó recibe tu nombre, tu correo y la descripción de tu aviso, y puede responder con un contra-aviso.",
      ),
    ).toBeVisible();
    expect(within(dialog).queryByText(/por ley/)).toBeNull();
    expect(
      within(dialog).getByText(
        "Llena el aviso formal; ahí te explicamos qué pasa después. Es gratis y no necesitas cuenta.",
      ),
    ).toBeVisible();
    // Ya no promete el anonimato de un reporte.
    expect(within(dialog).queryByText(/no sabrá quién lo reportó/)).toBeNull();
    expect(within(dialog).queryByRole("button", { name: "Enviar reporte" })).toBeNull();
    expect(within(dialog).queryByLabelText("Detalles (opcional)")).toBeNull();
    const link = within(dialog).getByRole("link", { name: "Ir al aviso formal" });
    expect(link).toHaveAttribute(
      "href",
      `/derechos-de-autor?url=${encodeURIComponent("https://www.speeaking.com/producto/tenis-rojos-k3j9x2")}#aviso`,
    );
    expect(actions.reportAction).not.toHaveBeenCalled();
  });

  it("si el envío falla, el motivo sigue marcado y el aviso urgente sigue a la vista", async () => {
    actions.reportAction.mockResolvedValueOnce({ error: "Espera un momento para reportar." });
    const dialog = await openDialog();

    await userEvent.click(within(dialog).getByLabelText("Contenido íntimo sin consentimiento"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar reporte" }));

    expect(await within(dialog).findByRole("alert")).toHaveTextContent(
      "Espera un momento para reportar.",
    );
    expect(within(dialog).getByLabelText("Contenido íntimo sin consentimiento")).toBeChecked();
    expect(within(dialog).getByText(/llama al 911/)).toBeVisible();
  });

  it("la publicación se identifica por su propia dirección, no por la página donde se ve", async () => {
    navigation.pathname = "/";
    const dialog = await openDialog({ targetType: "POST", returnTo: "/" });
    await userEvent.click(
      within(dialog).getByLabelText("Infringe mis derechos de autor o mi marca"),
    );
    expect(within(dialog).getByRole("link", { name: "Ir al aviso formal" })).toHaveAttribute(
      "href",
      `/derechos-de-autor?url=${encodeURIComponent(`https://www.speeaking.com/p/${ID}`)}#aviso`,
    );
  });

  it("desde mensajes no manda la dirección privada del hilo", async () => {
    navigation.pathname = "/mensajes/abc";
    const dialog = await openDialog({ targetType: "USER", returnTo: "/mensajes/abc" });
    await userEvent.click(
      within(dialog).getByLabelText("Infringe mis derechos de autor o mi marca"),
    );
    expect(within(dialog).getByRole("link", { name: "Ir al aviso formal" })).toHaveAttribute(
      "href",
      "/derechos-de-autor#aviso",
    );
  });

  it("un comentario no manda la dirección de su publicación (el aviso iría contra quien la publicó)", async () => {
    navigation.pathname = `/p/${ID}`;
    const dialog = await openDialog({
      targetType: "COMMENT",
      returnTo: `/p/${ID}`,
      compact: true,
      label: "Reportar comentario de Ana",
    });
    await userEvent.click(
      within(dialog).getByLabelText("Infringe mis derechos de autor o mi marca"),
    );
    expect(within(dialog).getByRole("link", { name: "Ir al aviso formal" })).toHaveAttribute(
      "href",
      "/derechos-de-autor#aviso",
    );
  });

  it("un comentario se reporta con su propio título", async () => {
    navigation.pathname = `/p/${ID}`;
    render(
      <ReportButton
        targetType="COMMENT"
        targetId={ID}
        isSignedIn
        returnTo={`/p/${ID}`}
        compact
        label="Reportar comentario de Ana"
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Reportar comentario de Ana" }));
    expect(await screen.findByRole("dialog", { name: "Reportar este comentario" })).toBeVisible();
  });
});

describe("ReportButton", () => {
  it("sin sesión lleva a iniciar sesión y regresa aquí", () => {
    render(
      <ReportButton
        targetType="COMMENT"
        targetId={ID}
        isSignedIn={false}
        returnTo={`/p/${ID}`}
        compact
        label="Reportar comentario de Ana"
      />,
    );
    expect(screen.getByRole("link", { name: "Reportar comentario de Ana" })).toHaveAttribute(
      "href",
      `/entrar?next=${encodeURIComponent(`/p/${ID}`)}`,
    );
  });
});
