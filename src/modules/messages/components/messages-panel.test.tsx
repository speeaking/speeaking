import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConversationSummaryDTO, ThreadDTO } from "../service";

const actions = vi.hoisted(() => ({
  loadInboxAction: vi.fn(),
  loadThreadAction: vi.fn(),
  sendMessageAction: vi.fn(),
  setMessagesBlockedAction: vi.fn(),
}));

vi.mock("../actions", () => actions);
vi.mock("@/modules/trust/actions", () => ({ reportAction: vi.fn() }));
vi.mock("@/modules/identity/content-removal-actions", () => ({
  removeOwnContentAction: vi.fn(async () => ({ ok: true })),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { MessagesPanel } = await import("./messages-panel");

const CONVERSATION = "0199a000-0000-7000-8000-0000000000c1";
const beto = { userId: "u-beto", username: "beto", displayName: "Beto Ruiz", avatarUrl: null };

const summary: ConversationSummaryDTO = {
  id: CONVERSATION,
  other: beto,
  lastMessage: { body: "¿Sigue disponible?", mine: false, at: new Date().toISOString() },
  unread: true,
};

const thread = (overrides: Partial<ThreadDTO> = {}): ThreadDTO => ({
  id: CONVERSATION,
  other: beto,
  messages: [
    { id: "m1", body: "¿Sigue disponible?", mine: false, at: new Date().toISOString() },
    { id: "m2", body: "Sí, todavía la tengo", mine: true, at: new Date().toISOString() },
  ],
  blocked: null,
  ...overrides,
});

function renderPanel(onRead = vi.fn()) {
  render(<MessagesPanel onRead={onRead} trigger={<button type="button">Mensajes</button>} />);
  return onRead;
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.loadInboxAction.mockResolvedValue([summary]);
  actions.loadThreadAction.mockResolvedValue(thread());
  actions.sendMessageAction.mockResolvedValue({});
});

describe("MessagesPanel (ADR-068)", () => {
  it("la bandeja se abre ahí mismo y la conversación se abre en el mismo recuadro", async () => {
    const onRead = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Mensajes" }));
    const inbox = await screen.findByRole("list", { name: "Conversaciones" });
    expect(within(inbox).getByText("Beto Ruiz")).toBeInTheDocument();
    expect(within(inbox).getByLabelText("Sin leer")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver todo" })).toHaveAttribute("href", "/mensajes");

    await userEvent.click(within(inbox).getByRole("button", { name: /Beto Ruiz/ }));

    const messages = await screen.findByRole("list", { name: "Mensajes" });
    expect(messages).toHaveTextContent("Sí, todavía la tengo");
    expect(actions.loadThreadAction).toHaveBeenCalledWith(CONVERSATION);
    // Tenía mensajes nuevos: el globo de la barra baja una vez.
    expect(onRead).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("Escribe un mensaje")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Opciones de la conversación con Beto Ruiz" }),
    ).toBeInTheDocument();

    // «Volver» regresa a la bandeja (ya sin el punto de no leído).
    await userEvent.click(screen.getByRole("button", { name: "Volver a mensajes" }));
    expect(await screen.findByRole("list", { name: "Conversaciones" })).toBeInTheDocument();
  });

  it("una conversación ya leída no baja el globo", async () => {
    actions.loadInboxAction.mockResolvedValue([{ ...summary, unread: false }]);
    const onRead = renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Mensajes" }));
    await userEvent.click(await screen.findByRole("button", { name: /Beto Ruiz/ }));
    await screen.findByRole("list", { name: "Mensajes" });

    expect(onRead).not.toHaveBeenCalled();
  });

  it("con un bloqueo, el campo para escribir cambia por el aviso (ADR-069)", async () => {
    actions.loadThreadAction.mockResolvedValue(thread({ blocked: "byThem" }));
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Mensajes" }));
    await userEvent.click(await screen.findByRole("button", { name: /Beto Ruiz/ }));

    expect(await screen.findByText("No puedes responder a esta conversación.")).toBeInTheDocument();
    expect(screen.queryByLabelText("Escribe un mensaje")).toBeNull();
  });

  it("bandeja vacía", async () => {
    actions.loadInboxAction.mockResolvedValue([]);
    renderPanel();

    await userEvent.click(screen.getByRole("button", { name: "Mensajes" }));

    expect(await screen.findByText(/Aún no tienes mensajes/)).toBeInTheDocument();
  });
});
