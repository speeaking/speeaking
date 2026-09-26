import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({ session: { findMany: vi.fn() } }));
vi.mock("@/server/db", () => ({ db }));

const { describeDevice, listOpenSessions } = await import("./sessions");

const USER = "0199a000-0000-7000-8000-000000000001";
const ANDROID_CHROME =
  "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Mobile Safari/537.36";
const IPHONE_SAFARI =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1";

beforeEach(() => db.session.findMany.mockReset());

describe("describeDevice", () => {
  it("nombra navegador y sistema", () => {
    expect(describeDevice(ANDROID_CHROME)).toBe("Chrome en Android");
    expect(describeDevice(IPHONE_SAFARI)).toBe("Mobile Safari en iOS");
  });

  it("sin user agent no inventa nada", () => {
    expect(describeDevice(null)).toBe("Navegador desconocido");
  });
});

// SEC-10: la persona ve dónde está abierta su cuenta, sin exponer el token ni la IP.
describe("listOpenSessions", () => {
  it("solo sesiones vigentes de la persona, sin token ni IP, la actual primero", async () => {
    db.session.findMany.mockResolvedValue([
      { id: "s-new", userAgent: IPHONE_SAFARI, updatedAt: new Date("2026-09-26T10:00:00Z") },
      { id: "s-current", userAgent: ANDROID_CHROME, updatedAt: new Date("2026-09-20T10:00:00Z") },
    ]);

    const sessions = await listOpenSessions(USER, "s-current");

    const query = db.session.findMany.mock.calls[0]?.[0];
    expect(query.where).toEqual({ userId: USER, expiresAt: { gt: expect.any(Date) } });
    expect(query.select).toEqual({ id: true, userAgent: true, updatedAt: true });
    expect(sessions.map((session) => [session.id, session.current])).toEqual([
      ["s-current", true],
      ["s-new", false],
    ]);
    expect(Object.keys(sessions[0] ?? {}).sort()).toEqual([
      "current",
      "device",
      "id",
      "lastActiveAt",
    ]);
  });
});
