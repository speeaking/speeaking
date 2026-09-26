import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_FEED_POLICY } from "@/modules/feed/policy";
import { assignVariant } from "./experiments";

// `getFeedPolicy(viewerId)` con la base simulada: la política guardada más el valor de tratamiento de
// los experimentos en curso a los que la persona quedó asignada.
const experiments = vi.hoisted(() => ({ rows: [] as unknown[] }));

vi.mock("@/server/db", () => ({
  db: {
    platformSetting: {
      findUnique: vi.fn(async () => ({ value: { ...DEFAULT_FEED_POLICY, authorWindow: 5 } })),
    },
    experiment: { findMany: vi.fn(async () => experiments.rows) },
  },
}));

const { getFeedPolicy } = await import("./settings");
const { db } = await import("@/server/db");

const KEY = "commerceSlotEvery.2026-09-26.abc";

/** Una persona que sí cae en el tratamiento con 50 %. */
function personIn(variant: "control" | "treatment") {
  for (let i = 0; ; i++) {
    const id = `0199a000-0000-7000-8000-${String(i).padStart(12, "0")}`;
    if (assignVariant(KEY, id, 0.5) === variant) return id;
  }
}

beforeEach(() => {
  experiments.rows = [
    {
      key: KEY,
      settingKey: "feed.policy.commerceSlotEvery",
      variants: { control: 4, treatment: 5 },
      allocation: 0.5,
    },
  ];
  vi.mocked(db.experiment.findMany).mockClear();
});

describe("getFeedPolicy con experimentos", () => {
  it("quien está en el tratamiento ve su valor; el resto, la política guardada", async () => {
    const treated = await getFeedPolicy(personIn("treatment"));
    expect(treated).toMatchObject({ commerceSlotEvery: 5, authorWindow: 5 });
    const control = await getFeedPolicy(personIn("control"));
    expect(control).toMatchObject({ commerceSlotEvery: 4, authorWindow: 5 });
  });

  it("sin sesión ni siquiera consulta los experimentos", async () => {
    expect(await getFeedPolicy(null)).toMatchObject({ commerceSlotEvery: 4 });
    expect(db.experiment.findMany).not.toHaveBeenCalled();
  });

  it("solo busca experimentos RUNNING de la política del feed", async () => {
    await getFeedPolicy(personIn("control"));
    expect(db.experiment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: "RUNNING", settingKey: { startsWith: "feed.policy." } },
      }),
    );
  });
});
