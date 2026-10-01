import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { FollowPersonDTO } from "../../follow-lists";
import { FollowList } from "./follow-list";

vi.mock("../../follow-actions", () => ({ toggleFollowAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/u/ana/seguidores",
}));

const profile = { username: "ana", displayName: "Ana", followerCount: 2, followingCount: 0 };
const person = (overrides: Partial<FollowPersonDTO> = {}): FollowPersonDTO => ({
  userId: "0199a000-0000-7000-8000-0000000000b1",
  username: "luis",
  displayName: "Luis",
  avatarUrl: null,
  isSeller: true,
  isEditorial: false,
  viewerFollows: false,
  isViewer: false,
  ...overrides,
});

describe("FollowList (ADR-058)", () => {
  it("pestañas con su número, cada persona a su perfil y «Seguir» de vuelta", () => {
    render(
      <FollowList
        profile={profile}
        direction="followers"
        page={{ people: [person()], nextCursor: null }}
        isSignedIn
      />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Seguidores" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Seguidores/ })).toHaveAttribute(
      "aria-current",
      "page",
    );
    expect(screen.getByRole("link", { name: "Siguiendo" })).toHaveAttribute(
      "href",
      "/u/ana/siguiendo",
    );
    expect(screen.getByRole("link", { name: /Luis/ })).toHaveAttribute("href", "/u/luis");
    expect(screen.getByText("Tienda")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Seguir a Luis" })).toBeInTheDocument();
  });

  it("quien mira no tiene botón de seguirse a sí mismo y «Ver más» lleva a la siguiente página", () => {
    render(
      <FollowList
        profile={profile}
        direction="followers"
        page={{ people: [person({ isViewer: true })], nextCursor: "0199a000-cursor" }}
        isSignedIn
      />,
    );

    expect(screen.queryByRole("button", { name: /Seguir/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver más" })).toHaveAttribute(
      "href",
      "/u/ana/seguidores?despues=0199a000-cursor",
    );
  });

  it("sin personas lo dice con el nombre del perfil", () => {
    render(
      <FollowList
        profile={profile}
        direction="following"
        page={{ people: [], nextCursor: null }}
        isSignedIn={false}
      />,
    );

    expect(screen.getByText("Ana todavía no sigue a nadie")).toBeInTheDocument();
  });
});
