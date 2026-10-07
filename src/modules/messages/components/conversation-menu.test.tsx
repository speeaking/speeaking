import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ setMessagesBlockedAction: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));

vi.mock("../actions", () => actions);
vi.mock("@/modules/trust/actions", () => ({ reportAction: vi.fn() }));
vi.mock("@/modules/identity/content-removal-actions", () => ({
  removeOwnContentAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => router, usePathname: () => "/mensajes" }));
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

const { BlockedNotice, ConversationMenu } = await import("./conversation-menu");

const CONVERSATION = "0199a000-0000-7000-8000-0000000000c1";
const beto = { userId: "u-beto", username: "beto", displayName: "Beto Ruiz", avatarUrl: null };

beforeEach(() => {
  vi.clearAllMocks();
  actions.setMessagesBlockedAction.mockResolvedValue({ ok: true });
});

async function openMenu() {
  await userEvent.click(
    screen.getByRole("button", { name: "Opciones de la conversación con Beto Ruiz" }),
  );
  return screen.findByRole("menu");
}

describe("ConversationMenu (ADR-069)", () => {
  it("en la página: ver perfil, bloquear y reportar (abre el formulario ahí mismo)", async () => {
    render(<ConversationMenu conversationId={CONVERSATION} other={beto} blocked={null} />);

    await openMenu();
    expect(screen.getByRole("menuitem", { name: "Ver perfil" })).toHaveAttribute("href", "/u/beto");
    expect(screen.queryByRole("menuitem", { name: "Abrir en Mensajes" })).toBeNull();

    await userEvent.click(screen.getByRole("menuitem", { name: "Reportar" }));
    expect(await screen.findByRole("dialog", { name: "Reportar a esta persona" })).toBeVisible();
  });

  it("bloquear llama al servidor y refresca la página", async () => {
    render(<ConversationMenu conversationId={CONVERSATION} other={beto} blocked={null} />);

    await openMenu();
    await userEvent.click(screen.getByRole("menuitem", { name: "Bloquear mensajes" }));

    await waitFor(() =>
      expect(actions.setMessagesBlockedAction).toHaveBeenCalledWith(CONVERSATION, true),
    );
    await waitFor(() => expect(router.refresh).toHaveBeenCalledTimes(1));
  });

  it("en el recuadro: abrir en Mensajes y reportar desde la página del hilo", async () => {
    const onChanged = vi.fn();
    render(
      <ConversationMenu
        conversationId={CONVERSATION}
        other={beto}
        blocked="byMe"
        inPanel
        onChanged={onChanged}
      />,
    );

    await openMenu();
    expect(screen.getByRole("menuitem", { name: "Abrir en Mensajes" })).toHaveAttribute(
      "href",
      `/mensajes/${CONVERSATION}`,
    );
    expect(screen.getByRole("menuitem", { name: "Reportar" })).toHaveAttribute(
      "href",
      `/mensajes/${CONVERSATION}?reportar=1`,
    );

    await userEvent.click(screen.getByRole("menuitem", { name: "Desbloquear mensajes" }));
    await waitFor(() =>
      expect(actions.setMessagesBlockedAction).toHaveBeenCalledWith(CONVERSATION, false),
    );
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    expect(router.refresh).not.toHaveBeenCalled();
  });
});

describe("BlockedNotice (ADR-069)", () => {
  it("a quien bloqueó: lo dice y deja desbloquear; a la otra persona, sin «te bloqueó»", async () => {
    const onChanged = vi.fn();
    const { unmount } = render(
      <BlockedNotice
        conversationId={CONVERSATION}
        name="Beto Ruiz"
        blocked="byMe"
        onChanged={onChanged}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent("Bloqueaste los mensajes de Beto Ruiz");
    await userEvent.click(screen.getByRole("button", { name: "Desbloquear" }));
    await waitFor(() => expect(onChanged).toHaveBeenCalledTimes(1));
    unmount();

    render(<BlockedNotice conversationId={CONVERSATION} name="Ana" blocked="byThem" />);
    expect(screen.getByRole("status")).toHaveTextContent(
      "No puedes responder a esta conversación.",
    );
    expect(screen.getByRole("status")).not.toHaveTextContent(/bloque/i);
  });
});
