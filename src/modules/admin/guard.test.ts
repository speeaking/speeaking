import { beforeEach, describe, expect, it, vi } from "vitest";

// /admin no se anuncia: quien no es ADMIN (con o sin sesión) recibe el mismo 404 que una ruta que no
// existe, nunca una redirección a iniciar sesión.
const mocks = vi.hoisted(() => ({
  getViewer: vi.fn(),
  notFound: vi.fn(() => {
    throw new Error("NEXT_HTTP_ERROR_FALLBACK;404");
  }),
  redirect: vi.fn(),
  findUserRole: vi.fn(),
  countAdminQueues: vi.fn(),
}));
vi.mock("next/navigation", () => ({ notFound: mocks.notFound, redirect: mocks.redirect }));
vi.mock("@/modules/identity/session", () => ({ getViewer: mocks.getViewer }));
vi.mock("./queries", () => ({
  findUserRole: mocks.findUserRole,
  countAdminQueues: mocks.countAdminQueues,
}));

const { getAdminViewer, requireAdmin } = await import("./guard");
const { AdminAuthorizationError, assertAdmin, getAdminOverview } = await import("./service");

const USER_ID = "0199a000-0000-7000-8000-000000000001";

function viewerWithRole(role: "USER" | "ADMIN" | null) {
  return {
    userId: USER_ID,
    name: "Persona",
    email: "persona@example.com",
    profile:
      role === null
        ? null
        : {
            username: "persona",
            displayName: "Persona",
            avatarUrl: null,
            onboarded: true,
            personalizationEnabled: true,
            role,
          },
    sellerProfileId: null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("requireAdmin", () => {
  it("deja pasar a una persona con rol ADMIN", async () => {
    const admin = viewerWithRole("ADMIN");
    mocks.getViewer.mockResolvedValue(admin);

    await expect(requireAdmin()).resolves.toBe(admin);
    expect(mocks.notFound).not.toHaveBeenCalled();
  });

  it("responde 404 a una persona con sesión sin el rol", async () => {
    mocks.getViewer.mockResolvedValue(viewerWithRole("USER"));

    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.notFound).toHaveBeenCalledOnce();
  });

  it("responde 404 (no redirige a iniciar sesión) sin sesión", async () => {
    mocks.getViewer.mockResolvedValue(null);

    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
    expect(mocks.notFound).toHaveBeenCalledOnce();
    expect(mocks.redirect).not.toHaveBeenCalled();
  });

  it("responde 404 a una cuenta sin perfil (sin bienvenida no hay rol)", async () => {
    mocks.getViewer.mockResolvedValue(viewerWithRole(null));

    await expect(requireAdmin()).rejects.toThrow("NEXT_HTTP_ERROR_FALLBACK;404");
  });
});

describe("getAdminViewer (acciones y rutas)", () => {
  it("devuelve null en lugar de lanzar para quien no es ADMIN", async () => {
    mocks.getViewer.mockResolvedValue(viewerWithRole("USER"));
    await expect(getAdminViewer()).resolves.toBeNull();

    mocks.getViewer.mockResolvedValue(null);
    await expect(getAdminViewer()).resolves.toBeNull();
    expect(mocks.notFound).not.toHaveBeenCalled();
  });
});

describe("assertAdmin (autorización en servicios)", () => {
  it("vuelve a leer el rol de la base", async () => {
    mocks.findUserRole.mockResolvedValue("ADMIN");
    await expect(assertAdmin(USER_ID)).resolves.toBeUndefined();
    expect(mocks.findUserRole).toHaveBeenCalledWith(USER_ID);
  });

  it("rechaza USER y cuentas sin perfil", async () => {
    for (const role of ["USER", null]) {
      mocks.findUserRole.mockResolvedValue(role);
      await expect(assertAdmin(USER_ID)).rejects.toBeInstanceOf(AdminAuthorizationError);
    }
  });

  it("el resumen no consulta nada si quien lo pide no es ADMIN", async () => {
    mocks.findUserRole.mockResolvedValue("USER");
    await expect(getAdminOverview(USER_ID)).rejects.toBeInstanceOf(AdminAuthorizationError);
    expect(mocks.countAdminQueues).not.toHaveBeenCalled();
  });
});
