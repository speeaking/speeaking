import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminNoticeDetail } from "@/modules/rights/service";

const ADMIN = "0199a000-0000-7000-8000-0000000000ad";
const SELLER = "0199a000-0000-7000-8000-0000000000b1";
const NOTICE = "0199a000-0000-7000-8000-0000000000c1";
const AT = new Date("2026-10-07T16:00:00Z");

const rights = vi.hoisted(() => ({ getNoticeForAdmin: vi.fn() }));

vi.mock("@/modules/admin/guard", () => ({
  requireAdmin: vi.fn(async () => ({ userId: ADMIN })),
  getAdminViewer: vi.fn(async () => ({ userId: ADMIN })),
}));
vi.mock("@/modules/rights/service", () => rights);
vi.mock("@/modules/rights/actions", () => ({ rightsAdminAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { default: RightsNoticePage } = await import("./page");

function detail(overrides: Partial<AdminNoticeDetail> = {}): AdminNoticeDetail {
  return {
    id: NOTICE,
    number: 123,
    caseNumber: "DA-000123",
    kind: "COPYRIGHT",
    kindLabel: "Derechos de autor",
    status: "RECEIVED",
    statusLabel: "Recibido, en revisión",
    claimant: {
      name: "Estudio Luz",
      email: "avisos@estudioluz.example",
      altEmail: null,
      phone: null,
      domicile: null,
      role: "OWNER",
      roleLabel: "Soy titular del derecho",
      principalName: null,
    },
    trademarkRegistration: null,
    workDescription: "Fotografía «Atardecer en Bacalar».",
    rightDescription: "Soy la autora.",
    facts: null,
    swornStatement: true,
    penaltyAcknowledged: true,
    submittedWithAccount: false,
    urls: [{ raw: "https://www.speeaking.com/u/tienda", resolved: true }],
    targets: [
      {
        id: "t1",
        targetType: "USER",
        typeLabel: "Perfil (foto, portada o datos)",
        label: "Tienda (@tienda)",
        href: "/u/tienda",
        state: "Se revisa a mano",
        manual: true,
        ownerId: SELLER,
      },
    ],
    owners: [
      {
        userId: SELLER,
        username: "tienda",
        displayName: "Tienda",
        strikes: 1,
        reviewClosure: false,
      },
    ],
    timeline: {
      receivedAt: AT,
      contentRemovedAt: null,
      uploaderNotifiedAt: null,
      counterNoticeAt: null,
      restoreDueAt: null,
      restoredAt: null,
    },
    decidedBy: null,
    decisionNote: null,
    counterNotices: [],
    decisions: ["remove", "reject", "withdraw"],
    keepDownHidesAgain: false,
    restoreNeedsNote: true,
    emailEnabled: false,
    ...overrides,
  };
}

async function renderCase(notice: AdminNoticeDetail | null) {
  rights.getNoticeForAdmin.mockResolvedValue(notice);
  render(await RightsNoticePage({ params: Promise.resolve({ caso: "DA-000123" }) }));
}

describe("/admin/avisos/[caso] (ADR-076)", () => {
  beforeEach(() => {
    rights.getNoticeForAdmin.mockReset();
  });

  it("solo muestra lo que procede; lo que no se oculta solo pide confirmar que se retiró a mano", async () => {
    await renderCase(detail());

    const actions = screen.getByRole("region", { name: "Acciones" });
    expect(within(actions).getByRole("button", { name: "Retirar contenido" })).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "Rechazar" })).toBeEnabled();
    expect(within(actions).getByRole("button", { name: "Retirado por quien avisó" })).toBeEnabled();
    expect(within(actions).queryByRole("button", { name: "Restaurar" })).not.toBeInTheDocument();
    expect(
      within(actions).getByRole("checkbox", { name: /Ya retiré a mano la foto de perfil/ }),
    ).not.toBeChecked();
    expect(screen.getByText("· retirar a mano")).toBeInTheDocument();
    expect(rights.getNoticeForAdmin).toHaveBeenCalledWith(ADMIN, 123, expect.any(Date));
  });

  it("con 3 faltas pide revisar el cierre de la cuenta en Usuarios (nunca automático)", async () => {
    await renderCase(
      detail({
        owners: [
          {
            userId: SELLER,
            username: "tienda",
            displayName: null,
            strikes: 3,
            reviewClosure: true,
          },
        ],
      }),
    );

    const warning = screen.getByText(/Revisar cierre de cuenta: 3 faltas en 12 meses/);
    expect(within(warning).getByRole("link", { name: "Usuarios" })).toHaveAttribute(
      "href",
      "/admin/usuarios?q=tienda",
    );
  });

  it("restaurado tras un contra-aviso: «Volver a retirar» con motivo obligatorio", async () => {
    await renderCase(
      detail({
        status: "RESTORED",
        statusLabel: "Contenido restaurado",
        decisions: ["keep_down"],
        keepDownHidesAgain: true,
      }),
    );

    const actions = screen.getByRole("region", { name: "Acciones" });
    expect(within(actions).getAllByRole("button")).toHaveLength(1);
    expect(within(actions).getByRole("button", { name: "Volver a retirar" })).toBeEnabled();
    expect(within(actions).getByLabelText("Motivo (obligatorio)")).toBeRequired();
    expect(
      within(actions).getByRole("checkbox", { name: /Ya volví a retirar a mano/ }),
    ).toBeRequired();
  });

  it("sin proveedor de correo muestra la copia del contra-aviso para mandarla a mano", async () => {
    await renderCase(
      detail({
        status: "COUNTER_NOTICE_RECEIVED",
        statusLabel: "Contra-aviso recibido",
        decisions: ["restore", "keep_down", "withdraw"],
        counterNotices: [
          {
            id: "0199a000-0000-7000-8000-0000000000d1",
            name: "Tienda de prueba",
            email: "tienda@example.com",
            domicile: "Calle 5 de Mayo 20, Oaxaca",
            basis: "OWN_WORK",
            basisLabel: "La obra es mía",
            explanation: "La foto la tomé yo.",
            createdAt: AT,
            forwardedAt: null,
            copy: {
              subject: "Contra-aviso en tu caso DA-000123",
              text: "Nombre: Tienda de prueba",
            },
          },
        ],
      }),
    );

    expect(
      screen.getByText(/Sin proveedor de correo: manda esta copia hoy mismo a/),
    ).toHaveTextContent("avisos@estudioluz.example");
    expect(screen.getByText("Asunto: Contra-aviso en tu caso DA-000123")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Marcar copia como enviada" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "Mantener retirado" })).toBeEnabled();
  });

  it("un caso que no existe responde el 404 de siempre", async () => {
    await expect(renderCase(null)).rejects.toThrow("NEXT_NOT_FOUND");
  });
});
