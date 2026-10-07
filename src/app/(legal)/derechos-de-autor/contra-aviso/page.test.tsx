import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { OwnerCaseView } from "@/modules/rights/service";

const SELLER = "0199a000-0000-7000-8000-0000000000b1";
const AT = new Date("2026-10-07T16:00:00Z");

const mocks = vi.hoisted(() => ({
  getOwnerCase: vi.fn(),
  requireViewer: vi.fn(),
}));

vi.mock("@/modules/rights/service", () => ({ getOwnerCase: mocks.getOwnerCase }));
vi.mock("@/modules/identity/session", () => ({ requireViewer: mocks.requireViewer }));
vi.mock("@/modules/rights/actions", () => ({ submitCounterNoticeAction: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { default: CounterNoticePage } = await import("./page");

function view(overrides: Partial<OwnerCaseView> = {}): OwnerCaseView {
  return {
    caseNumber: "DA-000123",
    kind: "COPYRIGHT",
    kindLabel: "Derechos de autor",
    status: "CONTENT_REMOVED",
    statusLabel: "Contenido retirado",
    receivedAt: AT,
    contentRemovedAt: AT,
    restoreDueAt: null,
    restoredAt: null,
    claimant: { name: "Estudio Luz", principalName: null, email: "avisos@estudioluz.example" },
    workDescription: "Fotografía «Atardecer en Bacalar».",
    rightDescription: "Soy la autora.",
    facts: null,
    targets: [
      {
        typeLabel: "Publicación",
        label: "Atardecer increíble",
        href: "/p/x",
        state: "Oculta",
      },
    ],
    myCounterNotice: null,
    canFile: true,
    ...overrides,
  };
}

async function renderPage(caso: string | undefined) {
  render(await CounterNoticePage({ searchParams: Promise.resolve({ caso }) }));
}

describe("/derechos-de-autor/contra-aviso (ADR-076)", () => {
  beforeEach(() => {
    mocks.getOwnerCase.mockReset();
    mocks.requireViewer.mockReset();
    mocks.requireViewer.mockResolvedValue({
      userId: SELLER,
      name: "Tienda",
      email: "tienda@example.com",
    });
  });

  it("sin número de caso explica de dónde se manda, sin pedir sesión", async () => {
    await renderPage(undefined);

    expect(screen.getByText(/Abre el enlace del aviso que te mandamos/)).toBeInTheDocument();
    expect(mocks.requireViewer).not.toHaveBeenCalled();
  });

  it("pide la sesión y vuelve al mismo caso al entrar", async () => {
    mocks.getOwnerCase.mockResolvedValue(view());
    await renderPage("da-123");

    expect(mocks.requireViewer).toHaveBeenCalledWith(
      "/derechos-de-autor/contra-aviso?caso=DA-000123",
    );
    expect(mocks.getOwnerCase).toHaveBeenCalledWith(SELLER, 123);
  });

  it("a quien subió lo retirado: quién avisó (no es anónimo) y el formulario sin casillas marcadas", async () => {
    mocks.getOwnerCase.mockResolvedValue(view());
    await renderPage("DA-000123");

    expect(screen.getByRole("heading", { name: "Caso DA-000123" })).toBeInTheDocument();
    expect(document.body).toHaveTextContent("Estudio Luz · avisos@estudioluz.example");
    expect(
      screen.getByRole("checkbox", { name: /bajo protesta de decir verdad/ }),
    ).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /multa de 1,000 a 20,000 UMA/ })).not.toBeChecked();
    expect(screen.getByLabelText("Domicilio")).toBeRequired();
    expect(screen.getByRole("button", { name: "Enviar contra-aviso" })).toBeEnabled();
  });

  it("con el contra-aviso ya enviado muestra la fecha para restaurar y no otro formulario", async () => {
    mocks.getOwnerCase.mockResolvedValue(
      view({
        status: "COUNTER_NOTICE_RECEIVED",
        restoreDueAt: new Date("2026-10-21T16:00:00Z"),
        myCounterNotice: { createdAt: AT, basisLabel: "La obra es mía", forwarded: false },
        canFile: false,
      }),
    );
    await renderPage("DA-000123");

    expect(document.body).toHaveTextContent(
      "Volveremos a mostrar el contenido a partir del 21 de octubre de 2026",
    );
    expect(screen.queryByRole("button", { name: "Enviar contra-aviso" })).not.toBeInTheDocument();
  });

  it("a otra cuenta le responde como a un caso que no existe", async () => {
    mocks.getOwnerCase.mockResolvedValue(null);
    await renderPage("DA-000123");

    expect(screen.getByText(/No encontramos este caso en tu cuenta/)).toBeInTheDocument();
    expect(document.body).not.toHaveTextContent("Estudio Luz");
  });
});
