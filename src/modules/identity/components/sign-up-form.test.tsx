import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({ signUpAction: vi.fn() }));

// La acción real vive en el servidor (Better Auth, base de datos); aquí solo el formulario.
vi.mock("../actions", () => actions);
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const { SignUpForm } = await import("./sign-up-form");

beforeEach(() => {
  vi.clearAllMocks();
  actions.signUpAction.mockResolvedValue({});
});

describe("SignUpForm", () => {
  it("pide «Tengo 18 años o más» con una casilla obligatoria y sin marcar", () => {
    render(<SignUpForm />);

    const adult = screen.getByRole("checkbox", { name: "Tengo 18 años o más" });
    expect(adult).not.toBeChecked();
    expect(adult).toBeRequired();
    expect(adult).toHaveAttribute("name", "confirmAge");
  });

  it("envía la casilla marcada y muestra el error del servidor si falta", async () => {
    actions.signUpAction.mockResolvedValueOnce({
      fieldErrors: { confirmAge: ["Para crear una cuenta necesitas tener 18 años o más."] },
    });
    render(<SignUpForm />);

    await userEvent.click(screen.getByRole("checkbox", { name: "Tengo 18 años o más" }));
    await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));

    await waitFor(() => expect(actions.signUpAction).toHaveBeenCalledTimes(1));
    const data = actions.signUpAction.mock.calls[0]![1] as FormData;
    expect(data.get("confirmAge")).toBe("on");
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Para crear una cuenta necesitas tener 18 años o más.",
    );
  });
});
