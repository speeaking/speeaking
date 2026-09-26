import { describe, expect, it } from "vitest";
import {
  addDays,
  buenFin,
  dayEnd,
  dayRange,
  dayStart,
  daysBetween,
  freezePeriodFor,
  isDay,
  isFrozenDay,
  mexicoDay,
  nextFreezePeriod,
} from "./calendar";

describe("días de la Ciudad de México", () => {
  it("el día empieza a las 06:00Z (sin horario de verano desde 2022)", () => {
    expect(dayStart("2026-09-26").toISOString()).toBe("2026-09-26T06:00:00.000Z");
    expect(dayEnd("2026-09-26").toISOString()).toBe("2026-09-27T06:00:00.000Z");
  });

  it("asigna cada instante a su día local, no al de UTC", () => {
    expect(mexicoDay(new Date("2026-09-27T05:59:59Z"))).toBe("2026-09-26");
    expect(mexicoDay(new Date("2026-09-27T06:00:00Z"))).toBe("2026-09-27");
  });

  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(daysBetween("2026-09-20", "2026-09-26")).toBe(6);
    expect(dayRange("2026-09-29", "2026-10-02")).toEqual([
      "2026-09-29",
      "2026-09-30",
      "2026-10-01",
      "2026-10-02",
    ]);
  });

  it("rechaza fechas inválidas", () => {
    expect(isDay("2026-02-30")).toBe(false);
    expect(isDay("2026-9-1")).toBe(false);
    expect(() => dayStart("ayer")).toThrow(RangeError);
  });
});

describe("congelamientos (plan §2.4)", () => {
  it("Buen Fin 2026: del 13 al 17 de noviembre, ambos incluidos", () => {
    expect(isFrozenDay("2026-11-12")).toBe(false);
    for (const day of dayRange("2026-11-13", "2026-11-17")) {
      expect(freezePeriodFor(day)?.name).toBe("Buen Fin");
    }
    expect(isFrozenDay("2026-11-18")).toBe(false);
  });

  it("del 12 al 25 de diciembre de cada año", () => {
    expect(isFrozenDay("2026-12-11")).toBe(false);
    expect(isFrozenDay("2026-12-12")).toBe(true);
    expect(isFrozenDay("2027-12-25")).toBe(true);
    expect(isFrozenDay("2026-12-26")).toBe(false);
  });

  it("la regla de respaldo reproduce 2026 y cubre el Buen Fin de años sin fecha confirmada", () => {
    // 2025 fue del 14 al 17 de noviembre: la regla (viernes a martes del tercer lunes) lo cubre.
    const period = buenFin(2025);
    expect(period.from).toBe("2025-11-14");
    expect(period.to).toBe("2025-11-18");
  });

  it("anuncia el siguiente congelamiento", () => {
    expect(nextFreezePeriod("2026-09-26")).toMatchObject({ from: "2026-11-13" });
    expect(nextFreezePeriod("2026-11-20")).toMatchObject({ from: "2026-12-12" });
    expect(nextFreezePeriod("2026-12-30").from.startsWith("2027-11")).toBe(true);
  });
});
