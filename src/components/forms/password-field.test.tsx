import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { PasswordField } from "./password-field";

describe("PasswordField", () => {
  it("oculta la contraseña y permite mostrarla con un botón de alternancia", async () => {
    render(<PasswordField label="Contraseña" name="password" />);
    const input = screen.getByLabelText("Contraseña");
    const toggle = screen.getByRole("button", { name: "Mostrar contraseña" });

    expect(input).toHaveAttribute("type", "password");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    await userEvent.click(toggle);
    expect(input).toHaveAttribute("type", "text");
    expect(toggle).toHaveAttribute("aria-pressed", "true");

    await userEvent.click(toggle);
    expect(input).toHaveAttribute("type", "password");
  });

  it("la etiqueta identifica solo al campo, no al botón (las pruebas E2E buscan por etiqueta)", () => {
    render(<PasswordField label="Contraseña" name="password" />);

    expect(screen.getAllByLabelText(/contraseña/i)).toHaveLength(1);
    expect(screen.getByRole("button")).not.toHaveAttribute("aria-label");
  });

  it("marca el campo como inválido y enlaza los errores", () => {
    render(<PasswordField label="Contraseña" name="password" errors={["Muy corta."]} />);
    const input = screen.getByLabelText("Contraseña");

    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription("Muy corta.");
  });
});
