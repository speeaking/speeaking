import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn(), dismiss: vi.fn() }));

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
  window.history.replaceState(null, "", "/c/gaming");
});

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

  it("unirse cambia al instante y se confirma con el servidor", async () => {
    vi.mocked(toggleMembershipAction).mockResolvedValue({ ok: true, active: true, count: 11 });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Unirme a Gaming" }));

    expect(toggleMembershipAction).toHaveBeenCalledWith(GAMING, true);
    expect(
      await screen.findByRole("button", { name: "Miembro, salir de Gaming" }),
    ).not.toHaveAttribute("aria-disabled", "true");
    expect(toast).not.toHaveBeenCalled();
    expect(toast.dismiss).toHaveBeenCalledWith(`membresia-${GAMING}`);
  });

  it("al salir avisa «Saliste de Gaming» con «Deshacer», que vuelve a unir", async () => {
    vi.mocked(toggleMembershipAction)
      .mockResolvedValueOnce({ ok: true, active: false, count: 10 })
      .mockResolvedValueOnce({ ok: true, active: true, count: 11 });
    renderButton({ initialJoined: true });

    await userEvent.click(screen.getByRole("button", { name: "Miembro, salir de Gaming" }));

    expect(toggleMembershipAction).toHaveBeenLastCalledWith(GAMING, false);
    await waitFor(() =>
      expect(toast).toHaveBeenCalledWith("Saliste de Gaming", {
        id: `membresia-${GAMING}`,
        action: { label: "Deshacer", onClick: expect.any(Function) },
      }),
    );
    expect(await screen.findByRole("button", { name: "Unirme a Gaming" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );

    const [, options] = toast.mock.calls[0] as [string, { action: { onClick: () => void } }];
    options.action.onClick();

    await waitFor(() => expect(toggleMembershipAction).toHaveBeenLastCalledWith(GAMING, true));
    expect(
      await screen.findByRole("button", { name: "Miembro, salir de Gaming" }),
    ).toBeInTheDocument();
    // Al volver a unirse, el aviso de «Saliste» se retira.
    expect(toast.dismiss).toHaveBeenCalledWith(`membresia-${GAMING}`);
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
