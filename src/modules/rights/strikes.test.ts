import { describe, expect, it } from "vitest";
import { countStrikes, isStrike, STRIKE_THRESHOLD, strikeWindowStart } from "./strikes";

const now = new Date("2026-10-07T18:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);
const inDays = (days: number) => new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

describe("faltas por reincidencia", () => {
  it("cuenta lo retirado y lo que se mantiene retirado", () => {
    expect(isStrike({ status: "CONTENT_REMOVED", contentRemovedAt: daysAgo(3) }, now)).toBe(true);
    expect(isStrike({ status: "KEPT_DOWN", contentRemovedAt: daysAgo(40) }, now)).toBe(true);
  });

  it("un contra-aviso cuenta solo mientras corre su plazo", () => {
    expect(
      isStrike(
        {
          status: "COUNTER_NOTICE_RECEIVED",
          contentRemovedAt: daysAgo(5),
          restoreDueAt: inDays(2),
        },
        now,
      ),
    ).toBe(true);
    expect(
      isStrike(
        {
          status: "COUNTER_NOTICE_RECEIVED",
          contentRemovedAt: daysAgo(30),
          restoreDueAt: daysAgo(1),
        },
        now,
      ),
    ).toBe(false);
  });

  it("no cuentan lo restaurado, lo rechazado, lo retirado por quien avisó ni lo pendiente", () => {
    for (const status of ["RESTORED", "REJECTED", "WITHDRAWN", "RECEIVED"] as const) {
      expect(isStrike({ status, contentRemovedAt: daysAgo(3) }, now)).toBe(false);
    }
  });

  it("solo los últimos 12 meses", () => {
    expect(strikeWindowStart(now)).toEqual(new Date("2025-10-07T18:00:00Z"));
    expect(isStrike({ status: "KEPT_DOWN", contentRemovedAt: daysAgo(364) }, now)).toBe(true);
    expect(isStrike({ status: "KEPT_DOWN", contentRemovedAt: daysAgo(366) }, now)).toBe(false);
    expect(isStrike({ status: "CONTENT_REMOVED", contentRemovedAt: null }, now)).toBe(false);
  });

  it("suma un caso por aviso; con 3 se revisa el cierre", () => {
    const notices = [
      { status: "CONTENT_REMOVED" as const, contentRemovedAt: daysAgo(1) },
      { status: "KEPT_DOWN" as const, contentRemovedAt: daysAgo(100) },
      { status: "RESTORED" as const, contentRemovedAt: daysAgo(10) },
      { status: "CONTENT_REMOVED" as const, contentRemovedAt: daysAgo(200) },
    ];
    expect(countStrikes(notices, now)).toBe(3);
    expect(STRIKE_THRESHOLD).toBe(3);
  });
});
