import { beforeEach, describe, expect, it, vi } from "vitest";
import type * as IntegrityModule from "./integrity";

const after = vi.hoisted(() => vi.fn());
const headers = vi.hoisted(() => vi.fn());
const clientIp = vi.hoisted(() => vi.fn());
const filterTrustedEvents = vi.hoisted(() => vi.fn());
const db = vi.hoisted(() => ({
  profile: { findUnique: vi.fn() },
  analyticsEvent: { createMany: vi.fn() },
}));

vi.mock("next/server", () => ({ after }));
vi.mock("next/headers", () => ({ headers }));
vi.mock("@/server/client-ip", () => ({ clientIp }));
vi.mock("@/server/db", () => ({ db }));
vi.mock("./integrity", async (importActual) => ({
  ...(await importActual<typeof IntegrityModule>()),
  filterTrustedEvents,
}));
vi.mock("@/server/env", () => ({ env: { BETTER_AUTH_SECRET: "s".repeat(32) } }));
vi.mock("@/server/rate-limit", () => ({ rateLimit: vi.fn() }));

const { recordEvents, track } = await import("./track");

const PRODUCT = "0199a000-0000-7000-8000-0000000000b1";
const anonymousView = {
  type: "PRODUCT_VIEW" as const,
  entityType: "PRODUCT" as const,
  entityId: PRODUCT,
};

async function runAfter() {
  const callback = after.mock.calls.at(-1)![0] as () => Promise<void>;
  await callback();
}

beforeEach(() => {
  vi.clearAllMocks();
  headers.mockResolvedValue(new Headers({ "x-forwarded-for": "203.0.113.7" }));
  clientIp.mockReturnValue("203.0.113.7");
  filterTrustedEvents.mockImplementation(async (events: unknown[]) => events);
  db.analyticsEvent.createMany.mockResolvedValue({ count: 1 });
});

describe("track (SEC-20)", () => {
  it("lee la IP dentro de la petición y la pasa para deduplicar lo anónimo", async () => {
    track(anonymousView);
    // Antes de `after`: ahí un Server Component ya no puede leer las cabeceras.
    expect(headers).toHaveBeenCalled();
    await runAfter();

    expect(filterTrustedEvents).toHaveBeenCalledWith([anonymousView], { ip: "203.0.113.7" });
    expect(db.analyticsEvent.createMany).toHaveBeenCalledOnce();
  });

  it("con sesión no hace falta la IP", async () => {
    db.profile.findUnique.mockResolvedValue({
      personalizationEnabled: true,
      onboardedAt: new Date(),
    });

    track({ ...anonymousView, userId: "0199a000-0000-7000-8000-000000000001" });
    await runAfter();

    expect(clientIp).not.toHaveBeenCalled();
    expect(filterTrustedEvents).toHaveBeenCalledWith(expect.any(Array), { ip: null });
  });

  it.each([
    "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
    "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
    "facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)",
    "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ChatGPT-User/1.0)",
  ])("un rastreador (%s) no cuenta como interés de una persona", async (userAgent) => {
    headers.mockResolvedValue(new Headers({ "user-agent": userAgent }));

    track(anonymousView);
    await runAfter();

    expect(filterTrustedEvents).not.toHaveBeenCalled();
    expect(db.analyticsEvent.createMany).not.toHaveBeenCalled();
  });

  it("un navegador de una persona sí se registra", async () => {
    headers.mockResolvedValue(
      new Headers({
        "user-agent":
          "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148",
        "x-forwarded-for": "203.0.113.7",
      }),
    );

    track(anonymousView);
    await runAfter();

    expect(db.analyticsEvent.createMany).toHaveBeenCalledOnce();
  });

  it("fuera de una petición (scripts) no falla: sin IP", async () => {
    headers.mockImplementation(() => {
      throw new Error("headers() fuera de una petición");
    });

    track(anonymousView);
    await runAfter();

    expect(filterTrustedEvents).toHaveBeenCalledWith([anonymousView], { ip: null });
  });

  it("si todo se descarta (repetidos o referencias falsas) no escribe nada", async () => {
    filterTrustedEvents.mockResolvedValue([]);

    await recordEvents([anonymousView]);

    expect(db.analyticsEvent.createMany).not.toHaveBeenCalled();
  });
});
