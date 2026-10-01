import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ProfileHeader, type ProfileHeaderProps } from "./profile-header";

// Los botones del encabezado importan acciones de servidor (sesión, base de datos): aquí no hay nada
// de eso, solo se comprueba qué se pinta.
vi.mock("@/modules/identity/actions", () => ({ signOutAction: vi.fn() }));
vi.mock("../../follow-actions", () => ({ toggleFollowAction: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/u/ana",
}));

const base: ProfileHeaderProps["profile"] = {
  userId: "0199a000-0000-7000-8000-00000000000a",
  username: "ana",
  displayName: "Ana López",
  bio: "Vendo lo que ya no estreno.",
  avatarUrl: null,
  city: "Ciudad de México",
  joinedAt: new Date("2026-09-10T00:00:00Z"),
  isEditorial: false,
  isSeller: true,
  followerCount: 778,
  followingCount: 1,
  postCount: 0,
  viewerFollows: false,
};
const nobody = { people: [], peopleTotal: 0, communities: [] };

describe("ProfileHeader", () => {
  it("muestra nombre, usuario, ciudad, antigüedad, distintivo de tienda y contadores sin ceros", () => {
    render(
      <ProfileHeader profile={base} inCommon={nobody} cover={null} isOwn={false} isSignedIn />,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Ana López" })).toBeInTheDocument();
    expect(screen.getByText("@ana")).toBeInTheDocument();
    expect(screen.getByText("Ciudad de México")).toBeInTheDocument();
    expect(screen.getByText("Desde septiembre de 2026")).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Distintivos" })).toHaveTextContent("Tienda");
    expect(screen.getByText("Vendo lo que ya no estreno.")).toBeInTheDocument();
    const stats = document.querySelector("dl");
    expect(stats).toHaveTextContent("778");
    expect(stats).toHaveTextContent("seguidores");
    expect(stats).toHaveTextContent("siguiendo");
    // El cero se oculta (principio 5): nada de «0 publicaciones».
    expect(stats).not.toHaveTextContent("publicaci");
  });

  it("ajeno: Seguir es la acción primaria, con Mensaje y Compartir; sin Cerrar sesión", () => {
    render(
      <ProfileHeader profile={base} inCommon={nobody} cover={null} isOwn={false} isSignedIn />,
    );

    expect(screen.getByRole("button", { name: "Seguir a Ana López" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Mensaje" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Compartir perfil" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Cerrar sesión" })).not.toBeInTheDocument();
  });

  it("propio: Publicar, Editar perfil, Studio y Cerrar sesión; sin Seguir ni Mensaje", () => {
    render(<ProfileHeader profile={base} inCommon={nobody} cover={null} isOwn isSignedIn />);

    expect(screen.getByRole("link", { name: "Publicar" })).toHaveAttribute(
      "href",
      "/crear/publicacion",
    );
    expect(screen.getByRole("link", { name: "Editar perfil" })).toHaveAttribute("href", "/ajustes");
    expect(screen.getByRole("link", { name: "Studio" })).toHaveAttribute("href", "/studio");
    expect(screen.getByRole("button", { name: "Cerrar sesión" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Seguir/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Mensaje" })).not.toBeInTheDocument();
  });

  it("una cuenta editorial lleva su distintivo y no recibe mensajes (ADR-047)", () => {
    render(
      <ProfileHeader
        profile={{ ...base, isEditorial: true, isSeller: false, city: null }}
        inCommon={nobody}
        cover={null}
        isOwn={false}
        isSignedIn
      />,
    );

    expect(screen.getByRole("list", { name: "Distintivos" })).toHaveTextContent("Cuenta editorial");
    expect(screen.queryByRole("link", { name: "Mensaje" })).not.toBeInTheDocument();
    expect(screen.queryByText("Ciudad de México")).not.toBeInTheDocument();
  });

  it("la línea «en común» nombra a quienes sigues y las comunidades compartidas", () => {
    render(
      <ProfileHeader
        profile={base}
        inCommon={{
          people: [
            { username: "luis", displayName: "Luis", avatarUrl: null },
            { username: "mar", displayName: "Mar", avatarUrl: null },
          ],
          peopleTotal: 5,
          communities: ["Gaming", "Moda"],
        }}
        cover={null}
        isOwn={false}
        isSignedIn
      />,
    );

    expect(screen.getByText("Entre quienes sigues: Luis, Mar y 3 más")).toBeInTheDocument();
    expect(screen.getByText("Comparten Gaming y Moda")).toBeInTheDocument();
  });

  it("sin nada en común no hay línea, y sin sesión Seguir lleva a crear cuenta", () => {
    render(
      <ProfileHeader
        profile={base}
        inCommon={nobody}
        cover={null}
        isOwn={false}
        isSignedIn={false}
      />,
    );

    expect(screen.queryByText(/Entre quienes sigues/)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Seguir a Ana López" })).toHaveAttribute(
      "href",
      expect.stringContaining("/registro"),
    );
  });
});
