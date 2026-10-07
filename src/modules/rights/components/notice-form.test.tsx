import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { submitNoticeAction } = vi.hoisted(() => ({ submitNoticeAction: vi.fn() }));
vi.mock("../actions", () => ({ submitNoticeAction }));

const { NoticeForm } = await import("./notice-form");

async function send() {
  render(<NoticeForm />);
  await userEvent.click(screen.getByRole("button", { name: "Enviar aviso" }));
  return screen.findByRole("status");
}

describe("NoticeForm al enviarse (ADR-076)", () => {
  beforeEach(() => submitNoticeAction.mockReset());

  it("da el número de caso sin prometer seguimiento ni un correo que no salió", async () => {
    submitNoticeAction.mockResolvedValue({ ok: true, caseNumbers: [123], emailSent: false });
    const status = await send();

    expect(status).toHaveTextContent("Tu número de caso es DA-000123: guárdalo.");
    expect(status).toHaveTextContent("por ahora no mandamos acuse por correo");
    // No hay dónde consultar un caso: el número sirve para mencionarlo si nos escribe.
    expect(status).not.toHaveTextContent(/seguimiento/);
  });

  it("si lo señalado es de varias cuentas, da un número de caso por cada una", async () => {
    submitNoticeAction.mockResolvedValue({ ok: true, caseNumbers: [123, 124], emailSent: true });
    const status = await send();

    expect(status).toHaveTextContent(
      "Lo que señalaste lo subieron 2 cuentas distintas, así que abrimos un caso para cada una: DA-000123 y DA-000124.",
    );
    expect(status).toHaveTextContent("Te mandamos un acuse con estos números a tu correo.");
  });
});
