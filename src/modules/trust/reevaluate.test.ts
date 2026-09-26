import { describe, expect, it, vi } from "vitest";

vi.mock("./queries", () => ({}));
vi.mock("./service", () => ({ refreshAuthenticityCheck: vi.fn() }));

const { reevaluateOutdatedChecks } = await import("./reevaluate");

type Row = {
  productId: string;
  rulesVersion: string;
  status: "AUTO_CLEAR" | "NEEDS_PROOF" | "PROOF_SUBMITTED" | "VERIFIED_BY_ADMIN" | "REJECTED";
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
};

/**
 * Base simulada: `refresh` guarda la versión vigente salvo lo congelado (y salvo en simulación).
 * `unchecked`: productos sin revisión y el resultado de evaluarlos por primera vez.
 */
function fakeDb(
  rows: Row[],
  outcomes: Record<string, "frozen" | "missing" | "fail" | Row>,
  unchecked: Record<string, Row> = {},
) {
  const stored = new Map(rows.map((row) => [row.productId, { ...row }]));
  const pending = new Map(Object.entries(unchecked));
  const deps = {
    listOutdated: vi.fn(async (version: string, after: string | null, take: number) =>
      [...stored.values()]
        .filter((row) => row.rulesVersion !== version && (after === null || row.productId > after))
        .sort((a, b) => a.productId.localeCompare(b.productId))
        .slice(0, take)
        .map((row) => ({ ...row })),
    ),
    listUnchecked: vi.fn(async (after: string | null, take: number) =>
      [...pending.keys()]
        .filter((id) => after === null || id > after)
        .sort()
        .slice(0, take),
    ),
    refresh: vi.fn(async (productId: string, _now: Date, dryRun: boolean) => {
      const first = pending.get(productId);
      if (first) {
        if (!dryRun) {
          pending.delete(productId);
          stored.set(productId, { ...first, productId, rulesVersion: "v2" });
        }
        return { status: first.status, level: first.riskLevel, score: 0.5 };
      }
      const current = stored.get(productId)!;
      const next = outcomes[productId];
      if (next === "fail") throw new Error("se cayó la base");
      if (next === "missing") return null;
      if (next === "frozen" || next === undefined) {
        return { status: current.status, level: current.riskLevel, score: 0.5 };
      }
      if (!dryRun) stored.set(productId, { ...next, productId, rulesVersion: "v2" });
      return { status: next.status, level: next.riskLevel, score: 0.5 };
    }),
    countWithoutCheck: vi.fn(async () => pending.size),
  };
  return { deps, stored };
}

const row = (productId: string, rest: Partial<Row> = {}): Row => ({
  productId,
  rulesVersion: "v1",
  status: "AUTO_CLEAR",
  riskLevel: "LOW",
  ...rest,
});

describe("reevaluateOutdatedChecks", () => {
  const rows = [
    row("p1", { status: "NEEDS_PROOF", riskLevel: "HIGH" }),
    row("p2"),
    row("p3", { status: "VERIFIED_BY_ADMIN", riskLevel: "MEDIUM" }),
    row("p4", { rulesVersion: "v2" }),
    row("p5", { rulesVersion: "v0" }),
    row("p6"),
  ];
  const outcomes = {
    p1: row("p1", { status: "AUTO_CLEAR", riskLevel: "MEDIUM" }),
    p2: row("p2"),
    p3: "frozen",
    p5: "missing",
    p6: "fail",
  } as const;

  it("reevalúa solo lo de otra versión, por tandas, y resume los cambios", async () => {
    const { deps } = fakeDb(rows, outcomes);

    const summary = await reevaluateOutdatedChecks(
      { batchSize: 2, rulesVersion: "v2", now: new Date("2026-09-26T12:00:00Z") },
      deps,
    );

    expect(summary).toEqual({
      rulesVersion: "v2",
      dryRun: false,
      outdated: 5,
      byVersion: { v1: 4, v0: 1 },
      reevaluated: 2,
      frozen: 1,
      missing: 1,
      failed: [{ productId: "p6", error: "se cayó la base" }],
      statusChanges: { "NEEDS_PROOF → AUTO_CLEAR": 1 },
      levelChanges: { "HIGH → MEDIUM": 1 },
      withoutCheck: 0,
      firstEvaluated: 0,
    });
    expect(deps.refresh.mock.calls.map(([id]) => id)).toEqual(["p1", "p2", "p3", "p5", "p6"]);
    // Paginación por llave: cada tanda empieza después del último producto de la anterior.
    expect(deps.listOutdated.mock.calls.map(([, after, take]) => [after, take])).toEqual([
      [null, 2],
      ["p2", 2],
      ["p5", 2],
    ]);
  });

  it("es idempotente: la segunda corrida solo vuelve a tocar lo congelado (sin escribir)", async () => {
    const { deps } = fakeDb(rows, { ...outcomes, p5: row("p5"), p6: row("p6") });
    await reevaluateOutdatedChecks({ rulesVersion: "v2" }, deps);
    deps.refresh.mockClear();

    const again = await reevaluateOutdatedChecks({ rulesVersion: "v2" }, deps);

    expect(again).toMatchObject({ outdated: 1, reevaluated: 0, frozen: 1, statusChanges: {} });
    expect(deps.refresh.mock.calls.map(([id]) => id)).toEqual(["p3"]);
  });

  it("con dryRun anticipa los mismos cambios sin guardar nada", async () => {
    const { deps, stored } = fakeDb(rows, outcomes);
    const before = structuredClone([...stored.values()]);

    const preview = await reevaluateOutdatedChecks({ dryRun: true, rulesVersion: "v2" }, deps);

    expect(preview).toMatchObject({
      dryRun: true,
      outdated: 5,
      byVersion: { v1: 4, v0: 1 },
      reevaluated: 2,
      frozen: 1,
      statusChanges: { "NEEDS_PROOF → AUTO_CLEAR": 1 },
      levelChanges: { "HIGH → MEDIUM": 1 },
    });
    expect(deps.refresh.mock.calls.every(([, , dryRun]) => dryRun === true)).toBe(true);
    expect([...stored.values()]).toEqual(before);

    // La corrida real da lo que anticipó la simulación.
    const { deps: real } = fakeDb(rows, outcomes);
    const done = await reevaluateOutdatedChecks({ rulesVersion: "v2" }, real);
    expect({ ...done, dryRun: true }).toEqual(preview);
  });

  it("un «Comprobante revisado» cuyo puntaje sube vuelve a la cola y se cuenta como cambio", async () => {
    const { deps } = fakeDb([row("p1", { status: "VERIFIED_BY_ADMIN", riskLevel: "MEDIUM" })], {
      p1: row("p1", { status: "PROOF_SUBMITTED", riskLevel: "HIGH" }),
    });

    const summary = await reevaluateOutdatedChecks({ rulesVersion: "v2" }, deps);

    expect(summary).toMatchObject({
      frozen: 0,
      reevaluated: 1,
      statusChanges: { "VERIFIED_BY_ADMIN → PROOF_SUBMITTED": 1 },
    });
  });

  it("sin revisión: solo se cuentan; con includeUnchecked se evalúan por tandas", async () => {
    const unchecked = {
      n1: row("n1", { status: "NEEDS_PROOF", riskLevel: "HIGH" }),
      n2: row("n2"),
      n3: row("n3"),
    };
    const counted = fakeDb([], {}, unchecked);
    await expect(
      reevaluateOutdatedChecks({ rulesVersion: "v2" }, counted.deps),
    ).resolves.toMatchObject({ withoutCheck: 3, firstEvaluated: 0 });
    expect(counted.deps.refresh).not.toHaveBeenCalled();

    const { deps } = fakeDb([], {}, unchecked);
    const summary = await reevaluateOutdatedChecks(
      { rulesVersion: "v2", includeUnchecked: true, batchSize: 2 },
      deps,
    );

    expect(summary).toMatchObject({
      withoutCheck: 3,
      firstEvaluated: 3,
      reevaluated: 0,
      statusChanges: { "sin revisión → NEEDS_PROOF": 1, "sin revisión → AUTO_CLEAR": 2 },
      levelChanges: { "sin revisión → HIGH": 1, "sin revisión → LOW": 2 },
    });
    expect(deps.listUnchecked.mock.calls.map(([after, take]) => [after, take])).toEqual([
      [null, 2],
      ["n2", 2],
    ]);
    // Ya tienen revisión: la siguiente corrida no encuentra ninguno.
    await expect(
      reevaluateOutdatedChecks({ rulesVersion: "v2", includeUnchecked: true }, deps),
    ).resolves.toMatchObject({ withoutCheck: 0, firstEvaluated: 0 });
  });

  it("rechaza tandas inválidas", async () => {
    const { deps } = fakeDb(rows, outcomes);
    for (const batchSize of [0, -1, 1.5, 501]) {
      await expect(reevaluateOutdatedChecks({ batchSize }, deps)).rejects.toThrow(RangeError);
    }
  });
});
