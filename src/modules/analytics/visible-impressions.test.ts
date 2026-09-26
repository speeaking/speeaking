import { beforeEach, describe, expect, it, vi } from "vitest";

const db = vi.hoisted(() => ({
  post: { findMany: vi.fn() },
  profile: { findUnique: vi.fn() },
  analyticsEvent: { findMany: vi.fn(), createMany: vi.fn() },
}));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/rate-limit", () => ({ rateLimit: vi.fn(async () => ({ ok: true })) }));
vi.mock("@/modules/platform/settings", () => ({
  getFeedExperimentAssignments: vi.fn(async () => []),
}));
vi.mock("@/server/env", () => ({
  env: { BETTER_AUTH_SECRET: "s".repeat(32), TRUSTED_PROXY_HOPS: 0, NODE_ENV: "test" },
}));

const { recordVisibleImpressions } = await import("./visible-impressions");

const VIEWER = "0199a000-0000-7000-8000-000000000001";
const AUTHOR = "0199a000-0000-7000-8000-000000000002";
const POST = "0199a000-0000-7000-8000-0000000000a1";
const item = { postId: POST, surface: "FEED" as const, position: 2 };

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, "error").mockImplementation(() => {});
  db.post.findMany.mockResolvedValue([{ id: POST, authorId: AUTHOR }]);
  db.profile.findUnique.mockResolvedValue({
    personalizationEnabled: true,
    onboardedAt: new Date(),
  });
  db.analyticsEvent.findMany.mockResolvedValue([
    {
      entityId: POST,
      surface: "FEED",
      position: 2,
      score: 0.5,
      algorithmVersion: "v0-explicable",
      metadata: { slot: "content" },
    },
  ]);
});

describe("recordVisibleImpressions: nunca rompe la petición", () => {
  it("si la base falla al guardar, no lanza: lo deja en el log y lo cuenta como no guardado", async () => {
    db.analyticsEvent.createMany.mockRejectedValue(new Error("Invalid value for argument `type`"));
    const outcome = await recordVisibleImpressions({ viewerId: VIEWER, ip: null, items: [item] });
    expect(outcome).toEqual({ recorded: 0, duplicates: 0, rejected: 0, failed: 1 });
    expect(console.error).toHaveBeenCalledOnce();
  });

  it("si falla antes de verificar, tampoco", async () => {
    db.post.findMany.mockRejectedValue(new Error("sin base"));
    const outcome = await recordVisibleImpressions({
      viewerId: null,
      ip: null,
      items: [item, item],
    });
    expect(outcome).toEqual({ recorded: 0, duplicates: 0, rejected: 0, failed: 1 });
  });

  it("las vistas del autor no cuentan", async () => {
    db.post.findMany.mockResolvedValue([{ id: POST, authorId: VIEWER }]);
    const outcome = await recordVisibleImpressions({ viewerId: VIEWER, ip: null, items: [item] });
    expect(outcome).toEqual({ recorded: 0, duplicates: 0, rejected: 1, failed: 0 });
    expect(db.analyticsEvent.createMany).not.toHaveBeenCalled();
  });
});
