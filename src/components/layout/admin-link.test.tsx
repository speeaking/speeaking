import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps, ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ViewerSummary } from "@/modules/identity/viewer-summary";
import { SideNav } from "./side-nav";
import { TopBar } from "./top-bar";

// «Administración» solo aparece para el equipo (ADMIN): en el menú de la cuenta y al final de la
// columna izquierda, hacia /admin/resumen. A los demás ni la llave `isAdmin` les llega.

vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
// Los paneles de la barra (ADR-068) llaman acciones del servidor: aquí no se ejecutan.
vi.mock("@/modules/notifications/actions", () => ({
  loadNotificationsAction: vi.fn(async () => []),
  markNotificationsReadAction: vi.fn(async () => 0),
}));
vi.mock("@/modules/messages/actions", () => ({
  loadInboxAction: vi.fn(async () => []),
  loadThreadAction: vi.fn(async () => null),
  sendMessageAction: vi.fn(async () => ({})),
  setMessagesBlockedAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/modules/trust/actions", () => ({ reportAction: vi.fn(async () => ({})) }));
vi.mock("next/form", () => ({
  default: ({ action, children, ...props }: ComponentProps<"form"> & { action: string }) => (
    <form action={action} {...props}>
      {children}
    </form>
  ),
}));
vi.mock("@/modules/identity/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("@/modules/social/components/join-button", () => ({
  JoinButton: () => <button type="button">Unirme</button>,
}));

const person: NonNullable<ViewerSummary> = {
  username: "sofia",
  displayName: "Sofía Ramos",
  avatarUrl: null,
  isSeller: false,
  onboarded: true,
  cartCount: 0,
  unreadMessages: 0,
  unreadNotifications: 0,
  communities: [],
};
const admin: NonNullable<ViewerSummary> = { ...person, isAdmin: true };
const communities = { total: 12, items: [] };

describe("enlace a Administración", () => {
  it("columna izquierda: al final, solo para ADMIN", () => {
    const { unmount } = render(<SideNav viewer={admin} communities={communities} />);
    expect(screen.getByRole("link", { name: "Administración" })).toHaveAttribute(
      "href",
      "/admin/resumen",
    );
    unmount();

    render(<SideNav viewer={person} communities={communities} />);
    expect(screen.queryByRole("link", { name: "Administración" })).toBeNull();
  });

  it("sin sesión no aparece", () => {
    render(<SideNav viewer={null} communities={communities} />);
    expect(screen.queryByText("Administración")).toBeNull();
  });

  it("menú de la cuenta: solo para ADMIN", async () => {
    const user = userEvent.setup();
    const { unmount } = render(<TopBar viewer={admin} />);
    await user.click(screen.getByRole("button", { name: "Tu cuenta: Sofía Ramos" }));
    expect(await screen.findByRole("menuitem", { name: "Administración" })).toHaveAttribute(
      "href",
      "/admin/resumen",
    );
    unmount();

    render(<TopBar viewer={person} />);
    await user.click(screen.getByRole("button", { name: "Tu cuenta: Sofía Ramos" }));
    expect(await screen.findByRole("menuitem", { name: "Ajustes" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Administración" })).toBeNull();
  });
});
