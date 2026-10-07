import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NotificationItem } from "../group";

const actions = vi.hoisted(() => ({
  loadNotificationsAction: vi.fn(),
  markNotificationsReadAction: vi.fn(),
  markNotificationGroupReadAction: vi.fn(async () => 0),
}));

vi.mock("../actions", () => actions);
vi.mock("@/modules/identity/content-removal-actions", () => ({
  removeOwnContentAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("@/modules/relationships/actions", () => ({ friendshipAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/",
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { NotificationsPanel } = await import("./notifications-panel");

const comment: NotificationItem = {
  key: "comment:post-1",
  type: "COMMENT",
  actors: [{ username: "beto", displayName: "Beto", avatarUrl: null }],
  at: new Date(),
  unread: true,
  postExcerpt: "¿Cuál es su taquería favorita?",
  commentExcerpt: "¡La de mi barrio!",
  reactions: [],
  orderTitle: null,
  href: "/p/post-1/comentarios",
};

function renderPanel(onSeen = vi.fn()) {
  render(<NotificationsPanel onSeen={onSeen} trigger={<button type="button">Avisos</button>} />);
  return onSeen;
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.markNotificationsReadAction.mockResolvedValue(1);
});

describe("NotificationsPanel (ADR-068)", () => {
  it("abre los avisos ahí mismo, los marca leídos y apaga el globo", async () => {
    actions.loadNotificationsAction.mockResolvedValue([comment]);
    const onSeen = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Avisos" }));

    expect(screen.getByRole("dialog", { name: "Notificaciones" })).toBeInTheDocument();
    expect(await screen.findByText("comentó tu publicación")).toBeInTheDocument();
    expect(screen.getByText("«¡La de mi barrio!»")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Beto comentó/ })).toHaveAttribute(
      "href",
      "/p/post-1/comentarios",
    );
    expect(screen.getByRole("link", { name: "Ver todos" })).toHaveAttribute("href", "/avisos");
    expect(actions.markNotificationsReadAction).toHaveBeenCalledTimes(1);
    expect(onSeen).toHaveBeenCalledTimes(1);
  });

  it("sin avisos nuevos no marca nada", async () => {
    actions.loadNotificationsAction.mockResolvedValue([{ ...comment, unread: false }]);
    const onSeen = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Avisos" }));

    expect(await screen.findByText("comentó tu publicación")).toBeInTheDocument();
    expect(actions.markNotificationsReadAction).not.toHaveBeenCalled();
    expect(onSeen).not.toHaveBeenCalled();
  });

  it("vacío y error con reintento", async () => {
    actions.loadNotificationsAction.mockRejectedValueOnce(new Error("sin red"));
    actions.loadNotificationsAction.mockResolvedValueOnce([]);
    vi.spyOn(console, "error").mockImplementation(() => {});
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Avisos" }));
    expect(await screen.findByText("No pudimos cargar tus avisos.")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    // Vacío: dice qué va a llegar ahí (docs/social-activity.md).
    expect(await screen.findByText(/Aquí verás las respuestas, menciones/)).toBeInTheDocument();
  });
});
