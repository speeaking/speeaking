import { describe, expect, it } from "vitest";
import { feedDateLabel, isSameLocalDay, localDay } from "./feed-date";

describe("fecha del feed (hora de México)", () => {
  it("usa el día de Ciudad de México, no el de UTC", () => {
    // 02:00 UTC del 26 son las 20:00 del 25 en Ciudad de México.
    const lateEvening = new Date("2026-09-26T02:00:00Z");
    expect(localDay(lateEvening)).toBe("2026-09-25");
    expect(feedDateLabel(lateEvening)).toBe("viernes 25 de septiembre");
  });

  it("compara días del calendario local", () => {
    const morning = new Date("2026-09-25T13:00:00Z");
    const night = new Date("2026-09-26T05:00:00Z"); // 23:00 del 25 en CDMX
    const nextDay = new Date("2026-09-26T07:00:00Z"); // 01:00 del 26 en CDMX

    expect(isSameLocalDay(morning, night)).toBe(true);
    expect(isSameLocalDay(morning, nextDay)).toBe(false);
  });
});
