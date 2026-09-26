import { describe, expect, it } from "vitest";
import { parseDecisionFilters } from "./decision-filters";

describe("filtros de /admin/decisiones", () => {
  it("lee estado y riesgo válidos", () => {
    expect(parseDecisionFilters({ estado: "aplicadas", riesgo: "medio" })).toEqual({
      status: "aplicadas",
      risk: "medio",
    });
  });

  it("sin filtros o con valores desconocidos: pendientes y cualquier riesgo", () => {
    expect(parseDecisionFilters({})).toEqual({ status: "pendientes", risk: null });
    expect(parseDecisionFilters({ estado: "borradas", riesgo: "extremo" })).toEqual({
      status: "pendientes",
      risk: null,
    });
    expect(parseDecisionFilters({ estado: ["aplicadas", "todas"] })).toEqual({
      status: "pendientes",
      risk: null,
    });
  });

  it("no acepta llaves heredadas del prototipo", () => {
    for (const value of ["toString", "__proto__", "constructor", "hasOwnProperty"]) {
      expect(parseDecisionFilters({ estado: value, riesgo: value })).toEqual({
        status: "pendientes",
        risk: null,
      });
    }
  });
});
