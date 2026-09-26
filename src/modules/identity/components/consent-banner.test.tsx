import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ConsentBanner, consentBannerTitle, dismissKey } from "./consent-banner";

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }));
const router = vi.hoisted(() => ({ refresh: vi.fn() }));
vi.mock("sonner", () => ({ toast }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const BOTH = [
  { type: "PRIVACY_NOTICE", version: "2026-09-27" },
  { type: "TERMS", version: "2026-09-27" },
] as const;
const REGION = { name: "Cambios en los documentos legales" };

beforeEach(() => {
  vi.clearAllMocks();
  window.sessionStorage.clear();
});

describe("ConsentBanner", () => {
  it("dice qué cambió, con ligas a cada documento, y no bloquea (no es un diálogo)", () => {
    render(<ConsentBanner documents={BOTH} action={vi.fn()} />);

    const region = screen.getByRole("region", REGION);
    expect(region).toHaveTextContent(
      "Actualizamos el aviso de privacidad y los términos. Revisa los cambios: Aviso de privacidad · Términos y condiciones.",
    );
    expect(within(region).getByRole("link", { name: "Aviso de privacidad" })).toHaveAttribute(
      "href",
      "/privacidad",
    );
    expect(within(region).getByRole("link", { name: "Términos y condiciones" })).toHaveAttribute(
      "href",
      "/terminos",
    );
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("solo menciona los documentos que cambiaron", () => {
    expect(consentBannerTitle([BOTH[0]])).toBe(
      "Actualizamos el aviso de privacidad. Revisa los cambios",
    );
    expect(consentBannerTitle([BOTH[1]])).toBe(
      "Actualizamos los términos y condiciones. Revisa los cambios",
    );

    render(<ConsentBanner documents={[BOTH[1]]} action={vi.fn()} />);
    expect(screen.queryByRole("link", { name: "Aviso de privacidad" })).toBeNull();
    expect(screen.getByRole("link", { name: "Términos y condiciones" })).toBeInTheDocument();
  });

  it("«Aceptar» manda las versiones que se mostraron y, si se guardó, se quita", async () => {
    const action = vi.fn(async () => ({ ok: true as const }));
    render(<ConsentBanner documents={BOTH} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    expect(action).toHaveBeenCalledOnce();
    expect(action).toHaveBeenCalledWith(BOTH);
    await waitFor(() => expect(screen.queryByRole("region", REGION)).toBeNull());
    expect(toast.success).toHaveBeenCalled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("si una versión cambió mientras tanto, avisa y vuelve a pedir el aviso vigente", async () => {
    const error = "Los documentos cambiaron otra vez.";
    const action = vi.fn(async () => ({ ok: false as const, error, stale: true as const }));
    render(<ConsentBanner documents={BOTH} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(error));
    expect(router.refresh).toHaveBeenCalledOnce();
    expect(toast.success).not.toHaveBeenCalled();
  });

  it("si la acción responde un error (p. ej. el límite), lo muestra y el aviso sigue", async () => {
    const error = "Demasiados intentos. Intenta de nuevo en 10 minutos.";
    const action = vi.fn(async () => ({ ok: false as const, error }));
    render(<ConsentBanner documents={BOTH} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith(error));
    expect(screen.getByRole("region", REGION)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Aceptar" })).toBeEnabled();
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it("si la acción falla, avisa sin romper la página", async () => {
    const action = vi.fn(async () => {
      throw new Error("sin red");
    });
    render(<ConsentBanner documents={BOTH} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Aceptar" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "No pudimos guardar tu aceptación. Intenta de nuevo.",
      ),
    );
    expect(screen.getByRole("region", REGION)).toBeInTheDocument();
  });

  it("«Ocultar por ahora» lo esconde solo en esta sesión y sin aceptar nada", async () => {
    const action = vi.fn();
    const { unmount } = render(<ConsentBanner documents={BOTH} action={action} />);

    await userEvent.click(screen.getByRole("button", { name: "Ocultar por ahora" }));

    expect(screen.queryByRole("region", REGION)).toBeNull();
    expect(action).not.toHaveBeenCalled();
    expect(window.sessionStorage.getItem(dismissKey(BOTH))).toBe("1");

    // Otra página de la misma sesión: sigue oculto.
    unmount();
    render(<ConsentBanner documents={BOTH} action={action} />);
    expect(screen.queryByRole("region", REGION)).toBeNull();
  });

  it("una versión nueva vuelve a mostrarlo aunque se haya ocultado la anterior", () => {
    const previous = [{ type: "PRIVACY_NOTICE", version: "2026-09-26" }] as const;
    window.sessionStorage.setItem(dismissKey(previous), "1");

    render(<ConsentBanner documents={[BOTH[0]]} action={vi.fn()} />);

    expect(screen.getByRole("region", REGION)).toBeInTheDocument();
  });

  it("sin almacenamiento de sesión (modo privado), ocultar funciona en esta vista", async () => {
    const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("bloqueado");
    });
    try {
      render(<ConsentBanner documents={BOTH} action={vi.fn()} />);
      await userEvent.click(screen.getByRole("button", { name: "Ocultar por ahora" }));
      expect(screen.queryByRole("region", REGION)).toBeNull();
    } finally {
      setItem.mockRestore();
    }
  });

  it("sin documentos pendientes no pinta nada", () => {
    const { container } = render(<ConsentBanner documents={[]} action={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});
