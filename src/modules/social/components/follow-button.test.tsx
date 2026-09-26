import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
const toast = vi.hoisted(() => Object.assign(vi.fn(), { error: vi.fn() }));

vi.mock("next/navigation", () => ({
  usePathname: () => "/u/ana",
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
vi.mock("../follow-actions", () => ({ toggleFollowAction: vi.fn() }));

const { toggleFollowAction } = await import("../follow-actions");
const { FollowButton } = await import("./follow-button");

const ANA = "0199a000-0000-7000-8000-0000000000a1";

function renderButton(props: Partial<Parameters<typeof FollowButton>[0]> = {}) {
  return render(
    <FollowButton
      targetUserId={ANA}
      targetName="Ana"
      initialFollowing={false}
      isSignedIn
      {...props}
    />,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/u/ana");
});

describe("FollowButton", () => {
  it("dice lo que hace: «Seguir a Ana», mide 44 px en móvil y 40 px en escritorio", () => {
    renderButton();
    const button = screen.getByRole("button", { name: "Seguir a Ana" });
    expect(button).toHaveTextContent("Seguir");
    expect(button).not.toHaveAttribute("aria-pressed");
    expect(button).toHaveClass("h-11", "md:h-10");
  });

  it("siguiéndola se anuncia «Siguiendo, dejar de seguir a Ana»: empieza con lo que se ve", () => {
    renderButton({ initialFollowing: true });
    expect(
      screen.getByRole("button", { name: "Siguiendo, dejar de seguir a Ana" }),
    ).toHaveTextContent(/^Siguiendo/);
  });

  it("seguir pide ese estado exacto al servidor (un botón viejo no deja de seguir por error)", async () => {
    vi.mocked(toggleFollowAction).mockResolvedValue({ ok: true, following: true });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Seguir a Ana" }));

    expect(toggleFollowAction).toHaveBeenCalledWith(ANA, true);
    expect(
      await screen.findByRole("button", { name: "Siguiendo, dejar de seguir a Ana" }),
    ).not.toHaveAttribute("aria-disabled", "true");
  });

  it("dejar de seguir pide `false`", async () => {
    vi.mocked(toggleFollowAction).mockResolvedValue({ ok: true, following: false });
    renderButton({ initialFollowing: true });

    await userEvent.click(screen.getByRole("button", { name: "Siguiendo, dejar de seguir a Ana" }));

    expect(toggleFollowAction).toHaveBeenCalledWith(ANA, false);
    expect(await screen.findByRole("button", { name: "Seguir a Ana" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("mientras espera al servidor conserva el foco y no manda otra petición", async () => {
    let resolve!: (value: { ok: true; following: boolean }) => void;
    vi.mocked(toggleFollowAction).mockReturnValue(new Promise((done) => (resolve = done)));
    renderButton();
    screen.getByRole("button", { name: "Seguir a Ana" }).focus();
    await userEvent.keyboard("{Enter}");

    const pending = screen.getByRole("button", { name: "Siguiendo, dejar de seguir a Ana" });
    expect(pending).toHaveAttribute("aria-disabled", "true");
    expect(pending).toHaveFocus();
    await userEvent.click(pending);
    expect(toggleFollowAction).toHaveBeenCalledTimes(1);

    resolve({ ok: true, following: true });
    await waitFor(() => expect(pending).not.toHaveAttribute("aria-disabled", "true"));
    expect(pending).toHaveFocus();
    // Recién seguida: «Siguiendo» se queda hasta que el foco o el puntero salen.
    expect(pending).toHaveAttribute("data-fresh");
  });

  it("un error amable del servidor (cuenta inexistente) se muestra y el botón vuelve atrás", async () => {
    vi.mocked(toggleFollowAction).mockResolvedValue({
      ok: false,
      error: "No es posible seguir a esta cuenta.",
    });
    renderButton();

    await userEvent.click(screen.getByRole("button", { name: "Seguir a Ana" }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("No es posible seguir a esta cuenta."),
    );
    expect(await screen.findByRole("button", { name: "Seguir a Ana" })).not.toHaveAttribute(
      "aria-disabled",
      "true",
    );
  });

  it("al visitante lo lleva a crear cuenta y regresar, sin cambio optimista", async () => {
    renderButton({ isSignedIn: false });

    const link = screen.getByRole("link", { name: "Seguir a Ana" });
    expect(link).toHaveAttribute("href", "/registro?next=%2Fu%2Fana");
    expect(link).toHaveClass("h-11", "md:h-10");
    // jsdom no navega: se evita el intento y se comprueba que no hubo acción ni cambio optimista.
    link.addEventListener("click", (event) => event.preventDefault());
    await userEvent.click(link);
    expect(toggleFollowAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Siguiendo")).toBeNull();
  });

  it("si la sesión expiró, el servidor lo manda a crear cuenta", async () => {
    vi.mocked(toggleFollowAction).mockResolvedValue({
      ok: false,
      error: "Inicia sesión para seguir a otras personas.",
      needsAuth: true,
    });
    renderButton({ isSignedIn: undefined });

    await userEvent.click(screen.getByRole("button", { name: "Seguir a Ana" }));

    await waitFor(() => expect(router.push).toHaveBeenCalledWith("/registro?next=%2Fu%2Fana"));
  });

  it("donde hay otra acción principal, «Seguir» va en rosa suave", () => {
    renderButton({ variant: "soft" });
    expect(screen.getByRole("button", { name: "Seguir a Ana" })).toHaveClass("bg-primary-soft");
  });
});
