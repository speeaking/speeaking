import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { completeOnboardingAction } from "../onboarding-actions";
import { OnboardingForm } from "./onboarding-form";

// La acción real vive en el servidor (base de datos, sesión); aquí solo probamos la navegación.
vi.mock("../onboarding-actions", () => ({ completeOnboardingAction: vi.fn(async () => ({})) }));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const communities = ["gaming", "tecnologia", "comida", "moda"].map((slug, index) => ({
  slug,
  name: slug,
  emoji: "⭐",
  hue: index * 40,
  description: `Comunidad ${slug}`,
}));

function renderForm() {
  return render(
    <OnboardingForm communities={communities} suggestedUsername="ana" defaultName="Ana" />,
  );
}

function backButton() {
  return new Promise<void>((resolve) => {
    window.addEventListener("popstate", () => resolve(), { once: true });
    window.history.back();
  });
}

describe("OnboardingForm", () => {
  beforeEach(() => {
    window.history.replaceState(null, "", "/bienvenida");
    window.scrollTo = vi.fn();
    vi.mocked(completeOnboardingAction).mockClear();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("lleva el enlace de origen a la acción para regresar ahí al terminar (ADR-022)", () => {
    const { container } = render(
      <OnboardingForm
        communities={communities}
        suggestedUsername="ana"
        defaultName="Ana"
        next="/p/0199a000-0000-7000-8000-0000000000c1"
      />,
    );
    expect(container.querySelector('input[type="hidden"][name="next"]')).toHaveValue(
      "/p/0199a000-0000-7000-8000-0000000000c1",
    );
  });

  it("con Google pide aceptar términos y declarar 18 años o más, sin marcar (ADR-076)", () => {
    render(
      <OnboardingForm
        communities={communities}
        suggestedUsername="ana"
        defaultName="Ana"
        needsLegalConsent
      />,
    );

    const legal = screen.getByRole("checkbox", { name: /Acepto los términos/ });
    const adult = screen.getByRole("checkbox", { name: "Tengo 18 años o más" });
    for (const box of [legal, adult]) {
      expect(box).not.toBeChecked();
      expect(box).toBeRequired();
    }
    expect(adult).toHaveAttribute("name", "confirmAge");
  });

  it("quien ya las hizo al registrarse no ve esas casillas", () => {
    renderForm();
    expect(screen.queryByRole("checkbox", { name: "Tengo 18 años o más" })).toBeNull();
    expect(screen.queryByRole("checkbox", { name: /Acepto los términos/ })).toBeNull();
  });

  it("si falta la edad, regresa al paso 1 con el error", async () => {
    vi.mocked(completeOnboardingAction).mockResolvedValueOnce({
      error: "Revisa los datos marcados.",
      fieldErrors: { confirmAge: ["Para crear una cuenta necesitas tener 18 años o más."] },
    });
    render(
      <OnboardingForm
        communities={communities}
        suggestedUsername="ana"
        defaultName="Ana"
        needsLegalConsent
      />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    for (const name of ["gaming", "tecnologia", "comida"]) {
      await userEvent.click(screen.getByText(name));
    }
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await userEvent.click(screen.getByRole("button", { name: "Empezar" }));

    expect(
      await screen.findByText("Para crear una cuenta necesitas tener 18 años o más."),
    ).toBeVisible();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cuéntanos de ti");
  });

  it("«Personalizar mi feed» es opcional y no viene marcada (finalidad secundaria)", () => {
    renderForm();
    // Está en el paso 3 (oculto al empezar).
    expect(
      screen.getByRole("checkbox", { name: /Personalizar mi feed/, hidden: true }),
    ).not.toBeChecked();
  });

  it("sin enlace de origen no manda `next`", () => {
    const { container } = renderForm();
    expect(container.querySelector('input[name="next"]')).toBeNull();
  });

  it("al avanzar refleja el paso en la URL, sube la página y enfoca el título", async () => {
    renderForm();

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));

    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Elige tus comunidades");
    expect(heading).toHaveFocus();
    expect(window.scrollTo).toHaveBeenCalledWith({ top: 0 });
    expect(window.location.search).toBe("?paso=2");
  });

  it("el botón Atrás del navegador regresa un paso sin perder lo elegido", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await userEvent.click(screen.getByText("gaming"));

    await act(backButton);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cuéntanos de ti");
    expect(window.location.search).toBe("");

    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    expect(screen.getByRole("checkbox", { name: /gaming/ })).toBeChecked();
  });

  it("el Atrás del formulario usa el historial y no apila otra entrada", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    const entries = window.history.length;

    const popped = new Promise((resolve) =>
      window.addEventListener("popstate", resolve, { once: true }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Atrás" }));
    await act(async () => {
      await popped;
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cuéntanos de ti");
    expect(window.history.length).toBe(entries);
  });

  it("dice cuántas comunidades faltan fuera del botón, que sigue llamándose Siguiente", async () => {
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    const next = screen.getByRole("button", { name: "Siguiente" });

    expect(next).toBeDisabled();
    expect(next).toHaveAccessibleDescription("Te faltan 3");

    await userEvent.click(screen.getByText("gaming"));
    await userEvent.click(screen.getByText("tecnologia"));
    expect(next).toHaveAccessibleDescription("Te falta 1");

    await userEvent.click(screen.getByText("comida"));
    expect(next).toBeEnabled();
    expect(screen.queryByText(/Te falta/)).not.toBeInTheDocument();
  });

  it("si el servidor regresa a un paso anterior, Atrás lleva al paso previo con un solo clic", async () => {
    vi.mocked(completeOnboardingAction).mockResolvedValueOnce({
      fieldErrors: { communities: ["Elige al menos 3 comunidades."] },
    });
    renderForm();
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    for (const name of ["gaming", "tecnologia", "comida"]) {
      await userEvent.click(screen.getByText(name));
    }
    await userEvent.click(screen.getByRole("button", { name: "Siguiente" }));
    await userEvent.click(screen.getByRole("button", { name: "Empezar" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Elige al menos 3 comunidades.");
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Elige tus comunidades");
    expect(window.location.search).toBe("?paso=2");

    // La entrada anterior del historial también es el paso 2: regresar a ella no cambiaría nada.
    await userEvent.click(screen.getByRole("button", { name: "Atrás" }));
    expect(heading).toHaveTextContent("Cuéntanos de ti");
    expect(window.location.search).toBe("");
  });

  it("Enter en un campo antes del último paso avanza en lugar de enviar el formulario", async () => {
    renderForm();

    await userEvent.type(screen.getByLabelText("Nombre de usuario"), "{Enter}");

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Elige tus comunidades");
    expect(completeOnboardingAction).not.toHaveBeenCalled();

    // Con menos de 3 comunidades, Enter no avanza ni envía.
    act(() => screen.getByRole("checkbox", { name: /gaming/ }).focus());
    await userEvent.keyboard("{Enter}");
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Elige tus comunidades");
    expect(completeOnboardingAction).not.toHaveBeenCalled();
  });

  it("si la URL ya trae un paso al cargar, vuelve al paso 1 sin crear otra entrada", () => {
    vi.useFakeTimers();
    window.history.replaceState(null, "", "/bienvenida?paso=3&next=%2Fcomprar");
    const entries = window.history.length;
    renderForm();

    act(() => {
      vi.runAllTimers();
    });

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Cuéntanos de ti");
    expect(window.location.search).toBe("?next=%2Fcomprar");
    expect(window.history.length).toBe(entries);
  });
});
