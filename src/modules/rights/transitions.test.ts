import { describe, expect, it } from "vitest";
import {
  allowedDecisions,
  canDecide,
  isAutoTarget,
  keepDownHidesAgain,
  restoreNeedsNote,
} from "./transitions";

const now = new Date("2026-10-07T18:00:00Z");

describe("etapas del caso", () => {
  const stage = (
    status: Parameters<typeof canDecide>[0]["status"],
    counterNoticeAt: Date | null = null,
  ) => ({
    status,
    counterNoticeAt,
  });

  it("lo recibido se retira, se rechaza o lo retira quien avisó", () => {
    expect(allowedDecisions(stage("RECEIVED"))).toEqual(["remove", "reject", "withdraw"]);
    expect(canDecide(stage("RECEIVED"), "restore")).toBe(false);
  });

  it("lo retirado se restaura o se mantiene; lo cerrado ya no cambia", () => {
    expect(canDecide(stage("CONTENT_REMOVED"), "restore")).toBe(true);
    expect(canDecide(stage("COUNTER_NOTICE_RECEIVED", now), "keep_down")).toBe(true);
    expect(canDecide(stage("KEPT_DOWN"), "restore")).toBe(true);
    expect(canDecide(stage("KEPT_DOWN"), "keep_down")).toBe(false);
    expect(canDecide(stage("CONTENT_REMOVED"), "remove")).toBe(false);
    for (const status of ["RESTORED", "REJECTED", "WITHDRAWN"] as const) {
      expect(allowedDecisions(stage(status))).toEqual([]);
    }
  });

  it("restaurado tras un contra-aviso se vuelve a retirar si quien avisó acredita una acción legal", () => {
    // RLFDA art. 37 Nonies: la prueba puede llegar hasta 15 días hábiles después de la copia.
    expect(allowedDecisions(stage("RESTORED", now))).toEqual(["keep_down"]);
    expect(canDecide(stage("RESTORED"), "keep_down")).toBe(false);
  });

  it("mantener retirado vuelve a ocultar solo lo que ya se había restaurado", () => {
    expect(keepDownHidesAgain(stage("RESTORED", now))).toBe(true);
    expect(keepDownHidesAgain(stage("CONTENT_REMOVED"))).toBe(false);
    expect(keepDownHidesAgain(stage("COUNTER_NOTICE_RECEIVED", now))).toBe(false);
  });

  it("restaurar antes del plazo del contra-aviso, o sin él, exige nota", () => {
    const due = new Date(now.getTime() + 60_000);
    const past = new Date(now.getTime() - 60_000);
    expect(restoreNeedsNote({ status: "COUNTER_NOTICE_RECEIVED", restoreDueAt: due }, now)).toBe(
      true,
    );
    expect(restoreNeedsNote({ status: "COUNTER_NOTICE_RECEIVED", restoreDueAt: past }, now)).toBe(
      false,
    );
    expect(restoreNeedsNote({ status: "CONTENT_REMOVED", restoreDueAt: null }, now)).toBe(true);
    expect(restoreNeedsNote({ status: "KEPT_DOWN", restoreDueAt: past }, now)).toBe(true);
  });

  it("solo publicaciones y productos se ocultan con un clic", () => {
    expect(isAutoTarget("POST")).toBe(true);
    expect(isAutoTarget("PRODUCT")).toBe(true);
    expect(isAutoTarget("USER")).toBe(false);
    expect(isAutoTarget("COMMENT")).toBe(false);
  });
});
