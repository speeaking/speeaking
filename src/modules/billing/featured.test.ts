import { describe, expect, it } from "vitest";
import { featuredDaysLeft, featuredUntilAfter, rotateFeatured, rotationKey } from "./featured";

const NOW = new Date("2026-09-30T15:30:00Z");

describe("producto destacado (ADR-046)", () => {
  it("suma los días a la vigencia que aún corre, o a hoy si ya venció", () => {
    expect(featuredUntilAfter(null, NOW, 3).toISOString()).toBe("2026-10-03T15:30:00.000Z");
    expect(featuredUntilAfter(new Date("2026-10-02T00:00:00Z"), NOW, 7).toISOString()).toBe(
      "2026-10-09T00:00:00.000Z",
    );
    expect(featuredUntilAfter(new Date("2026-09-01T00:00:00Z"), NOW, 7).toISOString()).toBe(
      "2026-10-07T15:30:00.000Z",
    );
  });

  it("la rotación es estable dentro de la hora y cambia entre horas", () => {
    const items = ["a", "b", "c", "d", "e"].map((id) => ({ id }));
    const first = rotateFeatured(items, NOW).map((item) => item.id);
    expect(rotateFeatured(items, new Date("2026-09-30T15:59:00Z")).map((i) => i.id)).toEqual(first);
    expect(rotationKey(NOW)).toBe("2026-8-30-15");
    const later = rotateFeatured(items, new Date("2026-09-30T16:00:00Z")).map((item) => item.id);
    expect([...later].sort()).toEqual([...first].sort());
    // Con 5 elementos, dos horas seguidas con el mismo orden serían una casualidad enorme.
    const hours = Array.from({ length: 6 }, (_, hour) =>
      rotateFeatured(items, new Date(Date.UTC(2026, 8, 30, hour)))
        .map((i) => i.id)
        .join(""),
    );
    expect(new Set(hours).size).toBeGreaterThan(1);
  });

  it("cuenta los días que quedan hacia arriba y nunca negativos", () => {
    expect(featuredDaysLeft(null, NOW)).toBe(0);
    expect(featuredDaysLeft(new Date("2026-09-30T10:00:00Z"), NOW)).toBe(0);
    expect(featuredDaysLeft(new Date("2026-10-01T10:00:00Z"), NOW)).toBe(1);
    expect(featuredDaysLeft(new Date("2026-10-07T15:30:00Z"), NOW)).toBe(7);
  });
});
