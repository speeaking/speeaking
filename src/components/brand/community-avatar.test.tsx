import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { CommunityAvatar } from "./community-avatar";

const gaming = { name: "Gaming", emoji: "🎮", hue: 285 };

describe("CommunityAvatar", () => {
  it("se anuncia con el nombre de la comunidad y oculta el emoji", () => {
    render(<CommunityAvatar {...gaming} />);

    const avatar = screen.getByRole("img", { name: "Gaming" });
    expect(avatar).toHaveTextContent("🎮");
    expect(screen.getByText("🎮")).toHaveAttribute("aria-hidden", "true");
  });

  it("pinta el mosaico con el tono de la comunidad", () => {
    render(<CommunityAvatar {...gaming} />);

    const avatar = screen.getByRole("img", { name: "Gaming" });
    expect(avatar).toHaveClass("community-tile");
    expect(avatar.style.getPropertyValue("--hue")).toBe("285");
  });

  it("con decorative no se anuncia (el nombre ya está visible al lado)", () => {
    const { container } = render(<CommunityAvatar {...gaming} decorative />);

    expect(screen.queryByRole("img")).not.toBeInTheDocument();
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
  });

  it("las cuentas editoriales llevan el sello de speeaking y lo dicen", () => {
    const { container } = render(<CommunityAvatar {...gaming} editorial />);

    expect(
      screen.getByRole("img", { name: "Gaming, cuenta editorial de speeaking" }),
    ).toBeInTheDocument();
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("sin editorial no hay sello", () => {
    const { container } = render(<CommunityAvatar {...gaming} />);

    expect(container.querySelector("svg")).toBeNull();
  });

  it.each([
    ["sm", "size-8"],
    ["md", "size-12"],
    ["lg", "size-16"],
  ] as const)("tamaño %s", (size, expected) => {
    render(<CommunityAvatar {...gaming} size={size} />);

    expect(screen.getByRole("img", { name: "Gaming" })).toHaveClass(expected);
  });
});
