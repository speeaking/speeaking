import { beforeEach, describe, expect, it, vi } from "vitest";

// SEC-10: Better Auth renueva la sesión mientras se use, sin tope. `getSession` corta a los 90 días
// de iniciada y borra la fila para que no sirva en ningún otro camino.
const mocks = vi.hoisted(() => ({
  getSession: vi.fn(),
  deleteMany: vi.fn(),
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("@/server/auth", () => ({ auth: { api: { getSession: mocks.getSession } } }));
vi.mock("@/server/db", () => ({ db: { session: { deleteMany: mocks.deleteMany } } }));
vi.mock("@/modules/social/unread", () => ({ getUnreadCounts: vi.fn() }));

const { getSession, MAX_SESSION_AGE_MS } = await import("./session");

const DAY = 24 * 60 * 60 * 1000;
const SESSION_ID = "0199a000-0000-7000-8000-00000000000a";

function sessionStartedAgo(ms: number) {
  return {
    session: { id: SESSION_ID, createdAt: new Date(Date.now() - ms) },
    user: { id: "0199a000-0000-7000-8000-000000000001" },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getSession (SEC-10)", () => {
  it("devuelve una sesión dentro del tope", async () => {
    const session = sessionStartedAgo(89 * DAY);
    mocks.getSession.mockResolvedValue(session);

    await expect(getSession()).resolves.toBe(session);
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });

  it("a los 90 días de iniciada ya no cuenta y se borra", async () => {
    mocks.getSession.mockResolvedValue(sessionStartedAgo(MAX_SESSION_AGE_MS + 1000));

    await expect(getSession()).resolves.toBeNull();
    expect(mocks.deleteMany).toHaveBeenCalledWith({ where: { id: SESSION_ID } });
  });

  it("sin sesión devuelve null", async () => {
    mocks.getSession.mockResolvedValue(null);

    await expect(getSession()).resolves.toBeNull();
    expect(mocks.deleteMany).not.toHaveBeenCalled();
  });
});
