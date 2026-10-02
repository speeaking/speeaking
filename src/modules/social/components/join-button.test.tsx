import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() =>
  Object.assign(vi.fn(), {
    error: vi.fn(),
    dismiss: vi.fn(),
    getToasts: vi.fn((): { id: string | number }[] => []),
  }),
);

vi.mock("next/navigation", () => ({
  usePathname: () => "/c/gaming",
  useRouter: () => router,
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: { href: string; children: ReactNode }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));
vi.mock("sonner", () => ({ toast }));
// La acción real vive en el servidor (sesión y base de datos).
vi.mock("../community-actions", () => ({ toggleMembershipAction: vi.fn() }));

const { toggleMembershipAction } = await import("../community-actions");
const { JoinButton } = await import("./join-button");

const GAMING = "0199a000-0000-7000-8000-000000000001";

function renderButton(props: Partial<Parameters<typeof JoinButton>[0]> = {}) {
  return render(
    <JoinButton
      communityId={GAMING}
      communityName="Gaming"
      communitySlug="gaming"
      initialJoined={false}
      isSignedIn
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  toast.getToasts.mockReturnValue([]);
  window.history.replaceState(null, "", "/c/gaming");
});

/** Id de un aviso de membresía de Gaming: prefijo fijo y un número que nunca se repite. */
const GAMING_TOAST = new RegExp(`^membresia-${GAMING}:\\d+$`);

describe("JoinButton", () => {
  it("dice lo que hace: «Unirme a Gaming» (y no usa aria-pressed)", () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Unirme a Gaming" });
    expect(button).toHaveTextContent("Unirme");
    expect(button).not.toHaveAttribute("aria-pressed");
  });

  it("siendo miembro se anuncia «Miembro, salir de Gaming»: empieza con lo que se ve", () => {
    renderButton({ initialJoined: true });
    const button = screen.getByRole("button", { name: "Miembro, salir de Gaming" });
    expect(button).toHaveTextContent(/^Miembro/);
  });

  it("mide 44 px en móvil y 40 px en escritorio", () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Unirme a Gaming" });
    expect(button).toHaveClass("h-11", "md:h-10");
  });

  it("el tamaño compacto completa 44 px táctiles en móvil y 40 px en escritorio", () => {
    renderButton({ size: "sm" });
    const button = screen.getByRole("button", { name: "Unirme a Gaming" });
    // 36 px + 4 px arriba y abajo = 44 px; en escritorio 28 px + 6 px + 6 px = 40 px.
    expect(button).toHaveClass(
      "relative",
      "h-9",
      "after:-inset-y-1",
      "md:h-7",
      "md:after:-inset-y-1.5",
    );
  });

  it("unirse cambia al instante, se confirma con el servidor y retira solo el aviso de esa comunidad", async () => {
    vi.mocked(toggleMembershipAction).mockResolvedValue({ ok: true, active: true, count: 11 });
    toast.getToasts.mockReturnValue([{ id: `membresia-${GAMING}:7` }, { id: "otro-aviso" }]);
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Unirme a Gaming" }));

    expect(toggleMembershipAction).toHaveBeenCalledWith(GAMING, true);
    // El nombre cambia al instante (optimista) y el botón sigue deshabilitado mientras el servidor
    // confirma: con la máquina cargada `findByRole` lo encontraba antes de la confirmación.
    const member = await screen.findByRole("button", { name: "Miembro, salir de Gaming" });
    await waitFor(() => expect(member).not.toHaveAttribute("aria-disabled", "true"));
    expect(toast).not.toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledTimes(1);
    expect(toast.dismiss).toHaveBeenCalledWith(`membresia-${GAMING}:7`);
  });

  it("al salir avisa «Saliste de Gaming» con «Deshacer», que vuelve a unir", async () => {
    vi.mocked(toggleMembershipAction)
      .mockResolvedValueOnce({ ok: true, active: false, count: 10 })
      .mockResolvedValueOnce({ ok: true, active: true, count: 11 });
    renderButton({ initialJoined: true });

    await userEvent.click(screen.getByRole("button", { name: "Miembro, salir de Gaming" }));

    expect(toggleMembershipAction).toHaveBeenLastCalledWith(GAMING, false);
    // 10 s y no los 4 de sonner: con teclado o lector de pantalla hay que llegar hasta «Deshacer».
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Saliste de Gaming", {
        id: expect.stringMatching(GAMING_TOAST),
        duration: 10_000,
        action: { label: "Deshacer", onClick: expect.any(Function) },
      }),
    );
    expect(await screen.findByRole("button", { name: "Unirme a Gaming" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );

    const [, options] = toast.mock.calls[0] as [
      string,
      { id: string; action: { onClick: () => void } },
    ];
    toast.getToasts.mockReturnValue([{ id: options.id }]);
    options.action.onClick();

    await waitFor(() => expect(toggleMembershipAction).toHaveBeenLastCalledWith(GAMING, true));
    expect(
      await screen.findByRole("button", { name: "Miembro, salir de Gaming" }),
    ).toBeInTheDocument();
    // Al volver a unirse, el aviso de «Saliste» se retira.
    expect(toast.dismiss).toHaveBeenCalledWith(options.id);
  });

  it("salir otra vez crea un aviso con id nuevo y retira el anterior (nunca reutiliza un id)", async () => {
    // Sonner borra por id el aviso que se está retirando: uno nuevo con el mismo id, creado en esos
    // 200 ms, heredaba el «borrar» y no se veía (la prueba E2E de «Deshacer» fallaba a veces).
    vi.mocked(toggleMembershipAction)
      .mockResolvedValueOnce({ ok: true, active: false, count: 10 })
      .mockResolvedValueOnce({ ok: true, active: true, count: 11 })
      .mockResolvedValueOnce({ ok: true, active: false, count: 10 });
    renderButton({ initialJoined: true });

    await userEvent.click(screen.getByRole("button", { name: "Miembro, salir de Gaming" }));
    await waitFor(() => expect(toast).toHaveBeenCalledTimes(1));
    const first = (toast.mock.calls[0] as [string, { id: string }])[1].id;

    await userEvent.click(await screen.findByRole("button", { name: "Unirme a Gaming" }));
    await screen.findByRole("button", { name: "Miembro, salir de Gaming" });
    // El primero sigue en pantalla cuando se sale otra vez: se retira antes de crear el nuevo.
    toast.getToasts.mockReturnValue([{ id: first }]);
    await userEvent.click(screen.getByRole("button", { name: "Miembro, salir de Gaming" }));

    await waitFor(() => expect(toast).toHaveBeenCalledTimes(2));
    const second = (toast.mock.calls[1] as [string, { id: string }])[1].id;
    expect(second).toMatch(GAMING_TOAST);
    expect(second).not.toBe(first);
    expect(toast.dismiss).toHaveBeenLastCalledWith(first);
  });

  it("mientras espera al servidor conserva el foco de teclado (no usa `disabled` nativo)", async () => {
    let resolve!: (value: { ok: true; active: boolean; count: number }) => void;
    vi.mocked(toggleMembershipAction).mockReturnValue(new Promise((done) => (resolve = done)));
    renderButton();
    const button = screen.getByRole("button", { name: "Unirme a Gaming" });

    button.focus();
    await userEvent.keyboard("{Enter}");

    const pending = screen.getByRole("button", { name: "Miembro, salir de Gaming" });
    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(pending).not.toHaveAttribute("disabled");
    expect(pending).toHaveFocus();
    // Un segundo toque mientras espera no manda otra petición.
    await userEvent.click(pending);
    expect(toggleMembershipAction).toHaveBeenCalledTimes(1);

    resolve({ ok: true, active: true, count: 11 });
    await waitFor(() => expect(pending).not.toHaveAttribute("aria-disabled", "true"));
    expect(pending).toHaveFocus();
  });

  it("recién unida, sigue diciendo «Miembro» (no «Salir») hasta que el puntero sale", async () => {
    vi.mocked(toggleMembershipAction).mockResolvedValue({ ok: true, active: true, count: 11 });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Unirme a Gaming" }));
    const button = await screen.findByRole("button", { name: "Miembro, salir de Gaming" });
    expect(button).toHaveAttribute("data-fresh");

    await userEvent.unhover(button);
    expect(button).not.toHaveAttribute("data-fresh");
  });

  it("si el servidor falla, vuelve al estado anterior con un aviso", async () => {
    vi.mocked(toggleMembershipAction).mockResolvedValue({
      ok: false,
      error: "Esa comunidad ya no existe.",
    });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Unirme a Gaming" }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Esa comunidad ya no existe."));
    expect(await screen.findByRole("button", { name: "Unirme a Gaming" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("al visitante lo lleva a crear cuenta con la comunidad, sin marcarlo «Miembro»", async () => {
    renderButton({ isSignedIn: false });

    const link = screen.getByRole("link", { name: "Unirme a Gaming" });
    expect(link).toHaveAttribute("href", "/registro?next=%2Fc%2Fgaming&unirse=gaming");
    expect(link).toHaveClass("h-11", "md:h-10");
    expect(screen.queryByRole("button")).toBeNull();
    // jsdom no navega: se evita el intento y se comprueba que no hubo acción ni cambio optimista.
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);
    expect(toggleMembershipAction).not.toHaveBeenCalled();
  });

  it("si la sesión expiró, el servidor lo manda a crear cuenta con la comunidad", async () => {
    vi.mocked(toggleMembershipAction).mockResolvedValue({
      ok: false,
      error: "Inicia sesión para unirte.",
      needsAuth: true,
    });
    renderButton({ isSignedIn: undefined });

    await userEvent.click(screen.getByRole("button", { name: "Unirme a Gaming" }));

    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith("/registro?next=%2Fc%2Fgaming&unirse=gaming"),
    );
    expect(toast.error).not.toHaveBeenCalled();
  });

  it("sin el nombre de la comunidad conserva el texto visible como nombre", () => {
    renderButton({ communityName: undefined, communitySlug: undefined, isSignedIn: false });
    expect(screen.getByRole("link", { name: "Unirme" })).toHaveAttribute(
      "href",
      "/registro?next=%2Fc%2Fgaming",
    );
  });
});
