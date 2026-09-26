import { describe, expect, it } from "vitest";
import {
  formatCompactNumber,
  formatCount,
  formatMembers,
  formatMoney,
  formatRelativeTime,
} from "./format";

describe("formatMoney", () => {
  it("formatea centavos como pesos mexicanos sin decimales cuando son enteros", () => {
    expect(formatMoney(349_900)).toBe("$3,499");
  });

  it("muestra centavos cuando existen", () => {
    expect(formatMoney(17_495)).toBe("$174.95");
  });

  it("maneja cero y montos negativos (reembolsos)", () => {
    expect(formatMoney(0)).toBe("$0");
    expect(formatMoney(-10_000)).toBe("-$100");
  });
});

describe("formatRelativeTime", () => {
  const now = new Date("2026-09-25T12:00:00Z");

  it("usa expresiones cortas en español", () => {
    expect(formatRelativeTime(new Date("2026-09-25T11:59:40Z"), now)).toBe("ahora");
    expect(formatRelativeTime(new Date("2026-09-25T11:45:00Z"), now)).toBe("hace 15 min");
    expect(formatRelativeTime(new Date("2026-09-25T09:00:00Z"), now)).toBe("hace 3 h");
    expect(formatRelativeTime(new Date("2026-09-22T12:00:00Z"), now)).toBe("hace 3 días");
  });
});

describe("formatCompactNumber", () => {
  it("abrevia miles como en redes sociales", () => {
    expect(formatCompactNumber(999)).toBe("999");
    expect(formatCompactNumber(2_400)).toBe("2.4 k");
  });
});

describe("formatMembers", () => {
  it("usa singular solo para una persona", () => {
    expect(formatMembers(1)).toBe("1 miembro");
    expect(formatMembers(0)).toBe("0 miembros");
    expect(formatMembers(12)).toBe("12 miembros");
  });

  it("separa miles como en México y no abrevia", () => {
    expect(formatMembers(1_250)).toBe("1,250 miembros");
    expect(formatMembers(2_400_000)).toBe("2,400,000 miembros");
  });
});

describe("formatCount", () => {
  it("elige singular o plural según la cantidad", () => {
    expect(formatCount(1, "publicación", "publicaciones")).toBe("1 publicación");
    expect(formatCount(24, "publicación", "publicaciones")).toBe("24 publicaciones");
  });
});
