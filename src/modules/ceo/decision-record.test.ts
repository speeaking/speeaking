import { describe, expect, it } from "vitest";
import { parseEvaluation, trailEntry, updateEvaluation } from "./decision-record";

const NOW = new Date("2026-09-26T16:00:00.000Z");

describe("bitácora de una decisión (evaluation)", () => {
  it("agrega entradas sin borrar las anteriores", () => {
    const first = updateEvaluation(null, { trail: [trailEntry("proposed", "AI", NOW)] });
    const second = updateEvaluation(first, {
      trail: [trailEntry("approved", "HUMAN", NOW, { userId: "u1", note: "ok" })],
    });
    expect(parseEvaluation(second).trail.map((entry) => entry.action)).toEqual([
      "proposed",
      "approved",
    ]);
  });

  it("conserva lo escrito por otro módulo aunque no tenga la forma esperada", () => {
    // P. ej. la evidencia de `ai.routing` o una entrada de bitácora con otra forma.
    const foreign = {
      evalRunId: "run-1",
      analysis: { detector: 3 },
      trail: [{ legacy: true }, trailEntry("proposed", "AI", NOW)],
    };
    const updated = updateEvaluation(foreign, { trail: [trailEntry("rejected", "HUMAN", NOW)] });
    expect(updated).toMatchObject({
      evalRunId: "run-1",
      analysis: { detector: 3 },
      trail: [{ legacy: true }, { action: "proposed" }, { action: "rejected" }],
    });
    // La lectura tolerante omite solo lo inválido.
    const read = parseEvaluation(updated);
    expect(read.analysis).toBeUndefined();
    expect(read.trail.map((entry) => entry.action)).toEqual(["proposed", "rejected"]);
  });

  it("un valor que no es objeto se guarda aparte, no se pierde", () => {
    expect(updateEvaluation("texto viejo", {})).toEqual({ previous: "texto viejo", trail: [] });
    expect(updateEvaluation({ trail: "roto" }, {})).toEqual({ previousTrail: "roto", trail: [] });
  });
});
