import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CommentDTO } from "../comment-queries";

const trust = vi.hoisted(() => ({ reportAction: vi.fn() }));

vi.mock("@/modules/trust/actions", () => trust);
vi.mock("@/modules/identity/content-removal-actions", () => ({
  removeOwnContentAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn() } }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/p/0199a000-0000-7000-8000-0000000000p1",
  useRouter: () => ({ refresh: vi.fn(), replace: vi.fn() }),
}));
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    transitionTypes: _transitionTypes,
    ...props
  }: {
    href: string;
    children: ReactNode;
    transitionTypes?: string[];
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { CommentList } = await import("./comment-list");

const POST_PATH = "/p/0199a000-0000-7000-8000-0000000000p1";
const comments: CommentDTO[] = [
  {
    id: "0199a000-0000-7000-8000-0000000000c1",
    body: "¡Qué buen color!",
    createdAt: "2026-10-07T12:00:00.000Z",
    author: { username: "beto", displayName: "Beto Ruiz", avatarUrl: null },
    canDelete: false,
  },
  {
    id: "0199a000-0000-7000-8000-0000000000c2",
    body: "Gracias 🙌",
    createdAt: "2026-10-07T12:05:00.000Z",
    author: { username: "ana", displayName: "Ana López", avatarUrl: null },
    canDelete: true,
  },
];

beforeEach(() => {
  vi.clearAllMocks();
  trust.reportAction.mockResolvedValue({ ok: true, message: "Gracias." });
});

describe("CommentList", () => {
  it("cada comentario de otra persona se puede reportar; el propio no (se puede borrar)", () => {
    render(<CommentList comments={comments} isSignedIn />);

    expect(screen.getByRole("button", { name: "Reportar comentario de Beto Ruiz" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Reportar comentario de Ana López" })).toBeNull();
    expect(screen.getByRole("button", { name: "Eliminar mi comentario" })).toBeVisible();
  });

  it("reporta el comentario (no la publicación) con el flujo de siempre", async () => {
    render(<CommentList comments={comments} isSignedIn />);

    await userEvent.click(screen.getByRole("button", { name: "Reportar comentario de Beto Ruiz" }));
    const dialog = await screen.findByRole("dialog", { name: "Reportar este comentario" });
    await userEvent.click(within(dialog).getByLabelText("Contenido ofensivo"));
    await userEvent.click(within(dialog).getByRole("button", { name: "Enviar reporte" }));

    await waitFor(() => expect(trust.reportAction).toHaveBeenCalledTimes(1));
    const data = trust.reportAction.mock.calls[0]![1] as FormData;
    expect(data.get("targetType")).toBe("COMMENT");
    expect(data.get("targetId")).toBe(comments[0]!.id);
    expect(data.get("reason")).toBe("OFFENSIVE");
  });

  it("sin sesión, reportar lleva a iniciar sesión y regresa a la publicación", () => {
    render(<CommentList comments={comments} isSignedIn={false} />);

    expect(screen.getByRole("link", { name: "Reportar comentario de Beto Ruiz" })).toHaveAttribute(
      "href",
      `/entrar?next=${encodeURIComponent(POST_PATH)}`,
    );
  });
});
