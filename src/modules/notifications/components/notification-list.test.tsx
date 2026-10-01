import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { NotificationItem } from "../group";
import { NotificationList } from "./notification-list";

const at = new Date("2026-10-01T15:00:00Z");
const item = (overrides: Partial<NotificationItem>): NotificationItem => ({
  key: "k",
  type: "REACTION",
  actors: [{ username: "ana", displayName: "Ana", avatarUrl: null }],
  at,
  unread: false,
  postExcerpt: "Mi cocina nueva",
  commentExcerpt: null,
  reactions: ["LIKE", "HAHA"],
  orderTitle: null,
  href: "/p/abc",
  ...overrides,
});

describe("NotificationList (ADR-059)", () => {
  it("separa lo nuevo de lo anterior y cada aviso lleva a donde pasó", () => {
    render(
      <NotificationList
        items={[
          item({ key: "a", unread: true }),
          item({
            key: "b",
            type: "COMMENT",
            commentExcerpt: "¡Qué bonita!",
            href: "/p/abc/comentarios",
          }),
        ]}
      />,
    );

    const fresh = screen.getByRole("region", { name: "Nuevos" });
    expect(within(fresh).getByRole("link")).toHaveAttribute("href", "/p/abc");
    expect(within(fresh).getByRole("link")).toHaveTextContent("Ana reaccionó a tu publicación");
    expect(within(fresh).getByText("Nuevo")).toBeInTheDocument();
    const earlier = screen.getByRole("region", { name: "Anteriores" });
    expect(within(earlier).getByRole("link")).toHaveAttribute("href", "/p/abc/comentarios");
    expect(within(earlier).getByText("«¡Qué bonita!»")).toBeInTheDocument();
  });

  it("los pedidos dicen qué producto y no tienen persona", () => {
    render(
      <NotificationList
        items={[
          item({
            type: "ORDER_SHIPPED",
            actors: [],
            reactions: [],
            postExcerpt: null,
            orderTitle: "Camisa blanca",
            href: "/pedidos/o1",
          }),
        ]}
      />,
    );

    expect(screen.getByRole("link")).toHaveTextContent("Tu pedido va en camino: Camisa blanca");
  });
});
