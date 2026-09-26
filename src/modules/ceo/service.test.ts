import { beforeEach, describe, expect, it, vi } from "vitest";

// Autorización del área: el servicio vuelve a leer el rol (assertAdmin) y las acciones responden un
// error genérico a quien no es ADMIN, sin llamar al servicio ni tocar la base.
const USER = "0199a000-0000-7000-8000-00000000000a";
const DECISION = "0199a000-0000-7000-8000-0000000000d1";

vi.mock("@/server/db", () => ({
  db: new Proxy(
    {},
    {
      get: () => {
        throw new Error("la base no debe tocarse sin autorización");
      },
    },
  ),
}));
vi.mock("@/modules/admin/service", async () => {
  class AdminAuthorizationError extends Error {}
  return {
    AdminAuthorizationError,
    assertAdmin: vi.fn(async () => {
      throw new AdminAuthorizationError("ADMIN_REQUIRED");
    }),
  };
});
vi.mock("@/modules/admin/guard", () => ({ getAdminViewer: vi.fn(async () => null) }));
vi.mock("@/server/rate-limit", () => ({
  rateLimit: vi.fn(async () => ({ ok: true })),
  rateLimitKey: vi.fn((scope: string, _subject: string, value: string) => `${scope}:user:${value}`),
  limitOrError: vi.fn(() => null),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

const service = await import("./service");
const actions = await import("./actions");
const { assertAdmin } = await import("@/modules/admin/service");
const { getAdminViewer } = await import("@/modules/admin/guard");
const { rateLimit } = await import("@/server/rate-limit");

beforeEach(() => {
  vi.mocked(assertAdmin).mockClear();
  vi.mocked(rateLimit).mockClear();
});

describe("servicio del motor de automejora", () => {
  it.each([
    [
      "getDecisionQueue",
      () => service.getDecisionQueue(USER, { status: "pendientes", risk: null }),
    ],
    ["getExperiments", () => service.getExperiments(USER)],
    ["getCeoWeeklyReport", () => service.getCeoWeeklyReport(USER)],
    ["approveDecision", () => service.approveDecision(USER, DECISION)],
    ["rejectDecision", () => service.rejectDecision(USER, DECISION)],
    ["revertDecision", () => service.revertDecision(USER, DECISION)],
    ["startExperimentAsAdmin", () => service.startExperimentAsAdmin(USER, DECISION)],
    ["stopExperimentAsAdmin", () => service.stopExperimentAsAdmin(USER, DECISION)],
    ["changeAutonomyMode", () => service.changeAutonomyMode(USER, "low_risk")],
  ])("%s exige ADMIN antes de leer o escribir", async (_name, run) => {
    await expect(run()).rejects.toThrow("ADMIN_REQUIRED");
    expect(assertAdmin).toHaveBeenCalledWith(USER);
  });
});

describe("acciones del motor de automejora", () => {
  function form(fields: Record<string, string>) {
    const data = new FormData();
    for (const [key, value] of Object.entries(fields)) data.set(key, value);
    return data;
  }

  it.each([
    ["approve", () => actions.approveDecisionAction({}, form({ decisionId: DECISION }))],
    ["reject", () => actions.rejectDecisionAction({}, form({ decisionId: DECISION }))],
    ["revert", () => actions.revertDecisionAction({}, form({ decisionId: DECISION }))],
    ["start", () => actions.startExperimentAction({}, form({ experimentId: DECISION }))],
    ["stop", () => actions.stopExperimentAction({}, form({ experimentId: DECISION }))],
    ["autonomy", () => actions.setAutonomyAction({}, form({ mode: "low_risk" }))],
  ])("%s: a quien no es ADMIN le responde un error genérico", async (_name, run) => {
    expect(await run()).toEqual({ ok: false, error: "No encontramos lo que buscas." });
    expect(assertAdmin).not.toHaveBeenCalled();
    expect(rateLimit).not.toHaveBeenCalled();
  });

  it("valida la entrada y limita por persona antes de llamar al servicio", async () => {
    vi.mocked(getAdminViewer).mockResolvedValue({ userId: USER } as Awaited<
      ReturnType<typeof getAdminViewer>
    >);
    expect(
      await actions.approveDecisionAction({}, form({ decisionId: "no-es-uuid" })),
    ).toMatchObject({
      ok: false,
    });
    expect(await actions.setAutonomyAction({}, form({ mode: "todo" }))).toEqual({
      ok: false,
      error: "Modo de autonomía inválido.",
    });
    expect(rateLimit).toHaveBeenCalledWith(
      expect.objectContaining({ key: `admin.decision.approve:user:${USER}` }),
    );
    expect(assertAdmin).not.toHaveBeenCalled();
  });
});
