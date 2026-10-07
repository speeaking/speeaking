import { render, screen, within } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ModerationQueue, QueueReportGroup } from "@/modules/trust/service";

const ADMIN = "0199a000-0000-7000-8000-0000000000ad";
const POST = "0199a000-0000-7000-8000-0000000000f1";
const COMMENT = "0199a000-0000-7000-8000-0000000000f2";
const AT = new Date("2026-10-07T12:00:00Z");

const trust = vi.hoisted(() => ({ getModerationQueue: vi.fn() }));

vi.mock("@/modules/admin/guard", () => ({
  requireAdmin: vi.fn(async () => ({ userId: ADMIN })),
  getAdminViewer: vi.fn(async () => ({ userId: ADMIN })),
}));
vi.mock("@/modules/trust/service", () => trust);
vi.mock("@/modules/trust/actions", () => ({ moderationAction: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { default: ModerationPage } = await import("./page");

function group(overrides: Partial<QueueReportGroup>): QueueReportGroup {
  return {
    targetType: "POST",
    targetId: POST,
    target: {
      kind: "POST",
      excerpt: "Mi outfit de hoy",
      href: `/p/${POST}`,
      author: "ana",
      hidden: false,
    },
    urgent: false,
    reasons: [{ reason: "SPAM", label: "Spam", count: 1 }],
    reports: [{ id: "r1", reasonLabel: "Spam", details: null, reporter: "beto", createdAt: AT }],
    oldestAt: AT,
    ...overrides,
  };
}

const queue: ModerationQueue = {
  checks: [],
  // El servicio ya los ordena: urgentes primero.
  reports: [
    group({
      targetType: "COMMENT",
      targetId: COMMENT,
      target: {
        kind: "COMMENT",
        excerpt: "Un comentario reportado",
        href: `/p/${POST}`,
        author: "beto",
        hidden: false,
      },
      urgent: true,
      reasons: [{ reason: "CHILD_SAFETY", label: "Pone en riesgo a un menor", count: 1 }],
    }),
    group({}),
  ],
  hidden: {
    products: [],
    posts: [],
    comments: [
      {
        id: "0199a000-0000-7000-8000-0000000000f3",
        excerpt: "Comentario oculto",
        href: `/p/${POST}`,
        author: "carla",
        at: AT,
      },
    ],
  },
};

describe("/admin/moderacion", () => {
  it("lo urgente va primero, marcado «Urgente», y un comentario se puede ocultar", async () => {
    trust.getModerationQueue.mockResolvedValue(queue);
    render(await ModerationPage());

    const cards = screen.getAllByRole("article");
    expect(cards[0]).toHaveAccessibleName("Urgente: reportes de comentario");
    expect(within(cards[0]!).getByText("Urgente")).toBeVisible();
    expect(within(cards[0]!).getByText("Pone en riesgo a un menor · 1")).toBeVisible();
    expect(
      within(cards[0]!).getByRole("link", { name: "Un comentario reportado" }),
    ).toHaveAttribute("href", `/p/${POST}`);
    expect(within(cards[0]!).getByRole("button", { name: "Ocultar comentario" })).toBeVisible();

    expect(cards[1]).toHaveAccessibleName("Reportes de publicación");
    expect(within(cards[1]!).queryByText("Urgente")).toBeNull();
    expect(screen.getByText(/1 urgente va primero/)).toBeVisible();
  });

  it("una cuenta reportada (p. ej., de un menor) solo se descarta aquí: lleva a Usuarios para bloquearla", async () => {
    const USER = "0199a000-0000-7000-8000-0000000000f4";
    trust.getModerationQueue.mockResolvedValue({
      ...queue,
      reports: [
        group({
          targetType: "USER",
          targetId: USER,
          target: {
            kind: "USER",
            displayName: "Pepe",
            username: "pepe_99",
            href: "/u/pepe_99",
            hidden: false,
          },
          reasons: [{ reason: "MINOR_ACCOUNT", label: "Cuenta de un menor de edad", count: 1 }],
        }),
      ],
    });
    render(await ModerationPage());

    const card = screen.getByRole("article", { name: "Reportes de cuenta" });
    expect(within(card).queryByRole("button", { name: /Ocultar/ })).toBeNull();
    expect(within(card).getByRole("button", { name: "Descartar reportes" })).toBeVisible();
    expect(within(card).getByRole("link", { name: "Bloquearla en Usuarios" })).toHaveAttribute(
      "href",
      "/admin/usuarios?q=pepe_99",
    );
  });

  it("un comentario oculto se puede restaurar", async () => {
    trust.getModerationQueue.mockResolvedValue(queue);
    render(await ModerationPage());

    expect(screen.getByText("Comentario oculto")).toBeVisible();
    expect(screen.getByRole("button", { name: "Restaurar comentario" })).toBeVisible();
  });
});
