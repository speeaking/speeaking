import { beforeEach, describe, expect, it, vi } from "vitest";

const ADMIN = "0199a000-0000-7000-8000-00000000000a";
const approvedRun = {
  id: "0199a000-0000-7000-8000-0000000000e1",
  model: "qwen/qwen3.5-9b",
  promptVersion: "ad-copy@4",
  cases: 32,
  passed: 31,
  metrics: { gate: { approved: true, reasons: [] } },
  createdAt: new Date("2026-09-20T12:00:00Z"),
};

const tx = vi.hoisted(() => ({
  $executeRaw: vi.fn(),
  platformSetting: {
    findUnique: vi.fn<() => Promise<{ value: unknown } | null>>(async () => null),
    upsert: vi.fn(),
  },
  platformDecision: {
    create: vi.fn(async () => ({ id: "decision-1" })),
    findMany: vi.fn<() => Promise<unknown[]>>(async () => []),
    findFirst: vi.fn<() => Promise<unknown>>(async () => null),
    update: vi.fn(),
    updateMany: vi.fn(async () => ({ count: 1 })),
  },
}));
const db = vi.hoisted(() => ({
  aIEvalRun: { findMany: vi.fn() },
  platformSetting: { findUnique: vi.fn(async () => null) },
  platformDecision: {
    create: vi.fn(async () => ({ id: "decision-2" })),
    count: vi.fn(async () => 0),
  },
  $transaction: vi.fn(async (callback: (client: unknown) => unknown) => callback(tx)),
}));
/** Variables de entorno del proveedor de IA (el modelo predeterminado de cada tarea). */
const env = vi.hoisted(() => ({
  AI_PROVIDER: "mock" as "mock" | "openai_compatible",
  AI_BASE_URL: undefined as string | undefined,
  AI_API_KEY: undefined as string | undefined,
  AI_DEFAULT_MODEL: undefined as string | undefined,
}));

vi.mock("@/server/db", () => ({ db }));
vi.mock("@/server/env", () => ({ env }));
vi.mock("@/modules/admin/service", () => ({
  assertAdmin: vi.fn(async (userId: string) => {
    if (userId !== ADMIN) throw new Error("ADMIN_REQUIRED");
  }),
}));

const {
  changeAiRouting,
  closeStaleAiRoutingProposals,
  discardAiRoutingProposal,
  proposeAiRoutingChange,
  RoutingChangeError,
  STALE_PROPOSAL_REASON,
} = await import("./routing-decisions");

const now = new Date("2026-09-26T12:00:00Z");
const qwen = { provider: "openai_compatible" as const, model: "qwen/qwen3.5-9b" };

const haiku = { provider: "openai_compatible" as const, model: "anthropic/claude-haiku-4.5" };
const routing = (tasks: Record<string, { provider: string; model: string }>) => ({
  version: 1,
  tasks,
});

/** Propuesta pendiente de la IA (como la deja `proposeAiRoutingChange`). */
function pending(id: string, previous: unknown, next: unknown) {
  return {
    id,
    previousValue: previous,
    newValue: next,
    title: "Proponer modelo",
    evaluation: { evalRunId: "0199a000-0000-7000-8000-0000000000d0", model: "x", trail: [] },
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  db.aIEvalRun.findMany.mockResolvedValue([]);
  tx.platformSetting.findUnique.mockResolvedValue(null);
  tx.platformDecision.findMany.mockResolvedValue([]);
  tx.platformDecision.findFirst.mockResolvedValue(null);
  tx.platformDecision.updateMany.mockResolvedValue({ count: 1 });
  db.platformDecision.count.mockResolvedValue(0);
  Object.assign(env, {
    AI_PROVIDER: "mock",
    AI_BASE_URL: undefined,
    AI_API_KEY: undefined,
    AI_DEFAULT_MODEL: undefined,
  });
});

/** Servidor de IA configurado con Qwen como modelo predeterminado. */
function withPaidDefault() {
  Object.assign(env, {
    AI_PROVIDER: "openai_compatible",
    AI_BASE_URL: "https://openrouter.ai/api/v1",
    AI_API_KEY: "sk-prueba-0123456789abcdef",
    AI_DEFAULT_MODEL: "qwen/qwen3.5-9b",
  });
}

const mock = { provider: "mock" as const, model: "mock" };

type UpdateManyCall = [{ where: { id: string }; data: Record<string, unknown> }];
const updateManyCalls = () =>
  tx.platformDecision.updateMany.mock.calls.map((call) => (call as unknown as UpdateManyCall)[0]);

describe("changeAiRouting (ADMIN, riesgo medio)", () => {
  it("solo ADMIN: otra cuenta no cambia nada", async () => {
    await expect(
      changeAiRouting("otra", { task: "ad_copy", route: qwen, reason: "Motivo de prueba" }, now),
    ).rejects.toThrow("ADMIN_REQUIRED");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("un modelo de pago sin evaluación aprobada reciente no se aplica", async () => {
    await expect(
      changeAiRouting(ADMIN, { task: "ad_copy", route: qwen, reason: "Motivo de prueba" }, now),
    ).rejects.toBeInstanceOf(RoutingChangeError);
    // Busca evidencia con el prompt vigente y de los últimos 30 días.
    expect(db.aIEvalRun.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          task: "CONTENT_GENERATION",
          model: "qwen/qwen3.5-9b",
          promptVersion: "ad-copy@4",
          createdAt: { gte: new Date("2026-08-27T12:00:00Z") },
        }),
      }),
    );
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("una evaluación NO aprobada no cuenta como evidencia", async () => {
    db.aIEvalRun.findMany.mockResolvedValue([
      { ...approvedRun, metrics: { gate: { approved: false, reasons: ["x"] } } },
    ]);
    await expect(
      changeAiRouting(ADMIN, { task: "ad_copy", route: qwen, reason: "Motivo de prueba" }, now),
    ).rejects.toBeInstanceOf(RoutingChangeError);
  });

  it("repetir la corrida hasta aprobar no sirve: una reprobada concluyente en la ventana bloquea", async () => {
    const failed = {
      ...approvedRun,
      id: "0199a000-0000-7000-8000-0000000000e0",
      createdAt: new Date("2026-09-19T12:00:00Z"),
      metrics: { gate: { approved: false, reasons: ["Cifras inventadas en 1 caso."] } },
    };
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun, failed]);
    await expect(
      changeAiRouting(ADMIN, { task: "ad_copy", route: qwen, reason: "Motivo de prueba" }, now),
    ).rejects.toThrow(/reprobó alguna/);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("una corrida con errores del proveedor o parcial no cuenta ni a favor ni en contra", async () => {
    const inconclusive = [
      {
        ...approvedRun,
        id: "0199a000-0000-7000-8000-0000000000e2",
        metrics: { gate: { approved: false, reasons: ["x"] }, providerErrors: 2 },
      },
      {
        ...approvedRun,
        id: "0199a000-0000-7000-8000-0000000000e3",
        cases: 25,
        metrics: { gate: { approved: true, reasons: [] }, suite: { total: 32 } },
      },
    ];
    db.aIEvalRun.findMany.mockResolvedValue(inconclusive);
    await expect(
      changeAiRouting(ADMIN, { task: "ad_copy", route: qwen, reason: "Motivo de prueba" }, now),
    ).rejects.toBeInstanceOf(RoutingChangeError);

    db.aIEvalRun.findMany.mockResolvedValue([...inconclusive, approvedRun]);
    await changeAiRouting(ADMIN, { task: "ad_copy", route: qwen, reason: "Motivo de prueba" }, now);
    expect(tx.platformDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          evaluation: expect.objectContaining({ evalRunId: approvedRun.id }),
        }),
      }),
    );
  });

  it("con evidencia: guarda el ajuste (v+1, HUMAN) y la decisión APPLIED con quién la aprobó", async () => {
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun]);

    await changeAiRouting(
      ADMIN,
      { task: "ad_copy", route: qwen, reason: "Pasó la evaluación y cuesta menos." },
      now,
    );

    const next = { version: 1, tasks: { ad_copy: qwen } };
    expect(tx.platformSetting.upsert).toHaveBeenCalledWith({
      where: { key: "ai.routing" },
      create: { key: "ai.routing", value: next, updatedBy: "HUMAN" },
      update: { value: next, version: { increment: 1 }, updatedBy: "HUMAN" },
    });
    expect(tx.platformDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor: "HUMAN",
          riskLevel: "MEDIUM",
          status: "APPLIED",
          approvedById: ADMIN,
          previousValue: { version: 1, tasks: {} },
          newValue: next,
          evaluation: expect.objectContaining({ evalRunId: approvedRun.id }),
        }),
      }),
    );
  });

  it("las tareas sin evaluación solo usan el predeterminado o el simulado", async () => {
    await expect(
      changeAiRouting(
        ADMIN,
        { task: "analyst_narrative", route: qwen, reason: "Motivo de prueba" },
        now,
      ),
    ).rejects.toThrow(/aún no tiene evaluación/);
    await changeAiRouting(
      ADMIN,
      {
        task: "analyst_narrative",
        route: { provider: "mock", model: "mock" },
        reason: "Apagar la IA de pago",
      },
      now,
    );
    expect(tx.platformDecision.create).toHaveBeenCalledTimes(1);
  });
});

describe("aplicar en /admin/ia cierra las propuestas de ese mismo cambio", () => {
  const apply = () =>
    changeAiRouting(
      ADMIN,
      { task: "ad_copy", route: qwen, reason: "Pasó la evaluación y cuesta menos." },
      now,
    );

  it("la propuesta más reciente queda APLICADA (sin crear otra decisión) y las repetidas, ligadas", async () => {
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun]);
    tx.platformDecision.findMany.mockResolvedValue([
      pending("newest", routing({}), routing({ ad_copy: qwen })),
      // Otra tarea u otro modelo: no se tocan.
      pending("other-task", routing({}), routing({ sale_proposal: qwen })),
      pending("other-model", routing({}), routing({ ad_copy: haiku })),
      // La misma propuesta, hecha cuando otra tarea tenía otra ruta: es el mismo cambio.
      pending(
        "older",
        routing({ sale_proposal: haiku }),
        routing({ sale_proposal: haiku, ad_copy: qwen }),
      ),
    ]);

    const result = await apply();

    expect(result).toEqual({ decisionId: "newest", closedProposals: 2 });
    expect(tx.platformDecision.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { settingKey: "ai.routing", kind: "ai.routing", status: "PROPOSED" },
        orderBy: { createdAt: "desc" },
      }),
    );
    // Una sola decisión del cambio: no se crea otra.
    expect(tx.platformDecision.create).not.toHaveBeenCalled();
    expect(tx.platformDecision.update).toHaveBeenCalledTimes(2);
    const [adopted, linked] = tx.platformDecision.update.mock.calls.map(
      (call) => (call as unknown as [{ where: { id: string }; data: Record<string, unknown> }])[0],
    );
    expect(adopted!.where).toEqual({ id: "newest" });
    expect(adopted!.data).toMatchObject({
      status: "APPLIED",
      approvedById: ADMIN,
      decidedAt: now,
      appliedAt: now,
      reason: "Pasó la evaluación y cuesta menos.",
      previousValue: { version: 1, tasks: {} },
      newValue: { version: 1, tasks: { ad_copy: qwen } },
      // La evidencia vigente al aplicar y la bitácora de quién la aplicó.
      evaluation: expect.objectContaining({
        evalRunId: approvedRun.id,
        trail: [expect.objectContaining({ action: "applied", actor: "HUMAN", userId: ADMIN })],
      }),
    });
    expect(linked!.where).toEqual({ id: "older" });
    expect(linked!.data).toMatchObject({
      status: "APPLIED",
      approvedById: ADMIN,
      reason: expect.stringContaining("decisión newest"),
      // En /admin/ia (título y estado) no parece un segundo cambio aplicado.
      title: expect.stringMatching(/^Repetida \(aplicada con otra decisión\): /),
    });
    // El cambio se cuenta una sola vez.
    expect(linked!.data).not.toHaveProperty("appliedAt");
    expect(tx.platformSetting.upsert).toHaveBeenCalledTimes(1);
  });

  it("sin una propuesta de ese cambio, crea la decisión de la persona como antes", async () => {
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun]);
    tx.platformDecision.findMany.mockResolvedValue([
      pending("other-model", routing({}), routing({ ad_copy: haiku })),
      pending("unreadable", "no es un ajuste", { tasks: "x" }),
    ]);

    expect(await apply()).toEqual({ decisionId: "decision-1", closedProposals: 0 });
    expect(tx.platformDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ actor: "HUMAN", status: "APPLIED" }),
      }),
    );
    expect(tx.platformDecision.update).not.toHaveBeenCalled();
  });

  it("volver al predeterminado cierra las propuestas de volver al predeterminado", async () => {
    tx.platformSetting.findUnique.mockResolvedValue({ value: routing({ ad_copy: qwen }) });
    const toHaiku = pending("to-haiku", routing({ ad_copy: qwen }), routing({ ad_copy: haiku }));
    tx.platformDecision.findMany
      .mockResolvedValueOnce([
        pending("to-default", routing({ ad_copy: qwen }), routing({})),
        toHaiku,
      ])
      // Después de aplicarla, «to-default» ya no está pendiente.
      .mockResolvedValueOnce([toHaiku]);

    const result = await changeAiRouting(
      ADMIN,
      { task: "ad_copy", route: null, reason: "Regresar al predeterminado." },
      now,
    );

    expect(result).toEqual({ decisionId: "to-default", closedProposals: 1 });
    expect(tx.platformDecision.update).toHaveBeenCalledTimes(1);
    // A Haiku sí cambiaría algo: sigue pendiente.
    expect(tx.platformDecision.updateMany).not.toHaveBeenCalled();
  });

  it("si el cambio no procede, ninguna propuesta se cierra", async () => {
    tx.platformDecision.findMany.mockResolvedValue([
      pending("newest", routing({}), routing({ ad_copy: qwen })),
    ]);
    // Sin evaluación aprobada.
    await expect(apply()).rejects.toBeInstanceOf(RoutingChangeError);
    expect(tx.platformDecision.update).not.toHaveBeenCalled();
  });
});

describe("proposeAiRoutingChange (IA CEO: solo propone)", () => {
  it("crea una propuesta PROPOSED con la evaluación aprobada como evidencia; no toca el ajuste", async () => {
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun]);

    const result = await proposeAiRoutingChange({
      task: "ad_copy",
      route: qwen,
      evalRunId: approvedRun.id,
      hypothesis: "Mismo resultado por menos costo.",
      now,
    });

    expect(result).toEqual({ decisionId: "decision-1", created: true });
    // Bajo el candado del ajuste, para que dos propuestas simultáneas no se dupliquen.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.platformDecision.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          actor: "AI",
          status: "PROPOSED",
          riskLevel: "MEDIUM",
          settingKey: "ai.routing",
        }),
      }),
    );
    expect(tx.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it("no duplica: si ya hay una propuesta pendiente de ese cambio, devuelve esa", async () => {
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun]);
    tx.platformDecision.findMany.mockResolvedValue([
      pending("existing", routing({}), routing({ ad_copy: qwen })),
    ]);

    const result = await proposeAiRoutingChange({
      task: "ad_copy",
      route: qwen,
      evalRunId: approvedRun.id,
      hypothesis: "Otra vez lo mismo.",
      now,
    });

    expect(result).toEqual({ decisionId: "existing", created: false });
    expect(tx.platformDecision.create).not.toHaveBeenCalled();
    expect(db.platformDecision.create).not.toHaveBeenCalled();
  });

  it("sin la evaluación aprobada que cita, no hay propuesta", async () => {
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun]);

    await expect(
      proposeAiRoutingChange({
        task: "ad_copy",
        route: qwen,
        evalRunId: "0199a000-0000-7000-8000-0000000000ff",
        hypothesis: "Sin evidencia.",
        now,
      }),
    ).rejects.toBeInstanceOf(RoutingChangeError);
    expect(db.platformDecision.create).not.toHaveBeenCalled();
    expect(tx.platformDecision.create).not.toHaveBeenCalled();
  });
});

describe("propuestas que ya no cambiarían nada se cierran solas", () => {
  it("sin propuestas pendientes no abre transacción", async () => {
    expect(await closeStaleAiRoutingProposals(now)).toBe(0);
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("cierra (REJECTED, por el sistema, con motivo) solo las que la tarea ya usa", async () => {
    db.platformDecision.count.mockResolvedValue(4);
    tx.platformDecision.findMany.mockResolvedValue([
      // Con AI_PROVIDER=mock y sin ruta, el kit ya usa el simulado: nada que aplicar.
      pending("stale-mock", routing({}), routing({ ad_copy: mock })),
      // A un modelo de pago: sí cambiaría (no se toca).
      pending("to-qwen", routing({}), routing({ ad_copy: qwen })),
      // Volver al predeterminado cuando ya no hay ruta: nada que aplicar.
      pending("stale-default", routing({ sale_proposal: haiku }), routing({})),
      pending("unreadable", "no es un ajuste", { tasks: "x" }),
    ]);

    expect(await closeStaleAiRoutingProposals(now)).toBe(2);

    // Bajo el candado del ajuste.
    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    const calls = updateManyCalls();
    expect(calls.map((call) => call.where.id)).toEqual(["stale-mock", "stale-default"]);
    for (const call of calls) {
      // Solo si sigue pendiente: una que otra operación ya cerró no se toca.
      expect(call.where).toMatchObject({ settingKey: "ai.routing", status: "PROPOSED" });
      expect(call.data).toMatchObject({
        status: "REJECTED",
        reason: STALE_PROPOSAL_REASON,
        decidedAt: now,
        evaluation: expect.objectContaining({
          trail: [expect.objectContaining({ action: "rejected", actor: "SYSTEM" })],
        }),
      });
      expect(call.data).not.toHaveProperty("approvedById");
    }
    expect(tx.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it("cuenta el modelo predeterminado de las variables de entorno como «ya lo usa»", async () => {
    withPaidDefault();
    db.platformDecision.count.mockResolvedValue(2);
    tx.platformSetting.findUnique.mockResolvedValue({ value: routing({ sale_proposal: haiku }) });
    tx.platformDecision.findMany.mockResolvedValue([
      pending("default-is-qwen", routing({}), routing({ ad_copy: qwen })),
      pending("route-is-haiku", routing({}), routing({ sale_proposal: qwen })),
    ]);

    expect(await closeStaleAiRoutingProposals(now)).toBe(1);
    expect(updateManyCalls().map((call) => call.where.id)).toEqual(["default-is-qwen"]);
  });

  it("al cambiar la ruta en /admin/ia, cierra las que quedaron sin nada que aplicar", async () => {
    tx.platformDecision.findMany
      // Propuestas del mismo cambio (ninguna).
      .mockResolvedValueOnce([])
      // Pendientes después de guardar la ruta nueva.
      .mockResolvedValueOnce([
        pending("now-stale", routing({}), routing({ analyst_narrative: mock })),
        pending("still-open", routing({}), routing({ ad_copy: qwen })),
      ]);

    const result = await changeAiRouting(
      ADMIN,
      { task: "analyst_narrative", route: mock, reason: "Apagar la IA de pago del analista." },
      now,
    );

    expect(result).toEqual({ decisionId: "decision-1", closedProposals: 1 });
    expect(updateManyCalls().map((call) => call.where.id)).toEqual(["now-stale"]);
  });

  it("la IA tampoco propone lo que la tarea ya usa por las variables de entorno", async () => {
    withPaidDefault();
    db.aIEvalRun.findMany.mockResolvedValue([approvedRun]);

    await expect(
      proposeAiRoutingChange({
        task: "ad_copy",
        route: qwen,
        evalRunId: approvedRun.id,
        hypothesis: "Ya es el predeterminado.",
        now,
      }),
    ).rejects.toThrow("Esa tarea ya usa ese modelo.");
    expect(tx.platformDecision.create).not.toHaveBeenCalled();
  });
});

describe("discardAiRoutingProposal (ADMIN descarta una propuesta)", () => {
  const input = {
    decisionId: "0199a000-0000-7000-8000-0000000000d1",
    reason: "Ya no aplica: preferimos esperar otra evaluación.",
  };

  it("solo ADMIN", async () => {
    await expect(discardAiRoutingProposal("otra", input, now)).rejects.toThrow("ADMIN_REQUIRED");
    expect(db.$transaction).not.toHaveBeenCalled();
  });

  it("queda REJECTED con el motivo, quién la descartó y la bitácora; la ruta no cambia", async () => {
    tx.platformDecision.findFirst.mockResolvedValue({ evaluation: { evalRunId: "x", trail: [] } });

    await discardAiRoutingProposal(ADMIN, input, now);

    expect(tx.$executeRaw).toHaveBeenCalledTimes(1);
    expect(tx.platformDecision.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: input.decisionId, status: "PROPOSED" }),
      }),
    );
    const [call] = updateManyCalls();
    expect(call!.where).toMatchObject({
      id: input.decisionId,
      kind: "ai.routing",
      settingKey: "ai.routing",
      status: "PROPOSED",
    });
    expect(call!.data).toMatchObject({
      status: "REJECTED",
      reason: input.reason,
      approvedById: ADMIN,
      decidedAt: now,
      evaluation: {
        evalRunId: "x",
        trail: [
          expect.objectContaining({
            action: "rejected",
            actor: "HUMAN",
            userId: ADMIN,
            note: expect.stringContaining(input.reason),
          }),
        ],
      },
    });
    expect(tx.platformSetting.upsert).not.toHaveBeenCalled();
  });

  it("una que ya no está pendiente (aplicada, descartada o de otro ajuste) no se toca", async () => {
    await expect(discardAiRoutingProposal(ADMIN, input, now)).rejects.toThrow(
      /ya no está pendiente/,
    );
    expect(tx.platformDecision.updateMany).not.toHaveBeenCalled();
  });
});
