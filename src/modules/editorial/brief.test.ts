import { describe, expect, it } from "vitest";
import { addDays } from "@/modules/platform/calendar";
import { planDraft, planTopic, QUESTION_ANGLES, TIP_ANGLES } from "./brief";

const NONE: ReadonlySet<string> = new Set();

function plan(day: string, communityIndex: number, communitySlug = "comida", used = NONE) {
  return planDraft({ day, communityIndex, communitySlug, usedOccasions: used });
}

describe("encargo del día", () => {
  it("es determinista: mismo día y comunidad, mismo encargo", () => {
    expect(plan("2026-10-05", 3)).toEqual(plan("2026-10-05", 3));
  });

  it("sin fechas cerca alterna dos preguntas por cada consejo", () => {
    const kinds = Array.from(
      { length: 9 },
      (_, offset) => plan(addDays("2026-10-01", offset), 0).kind,
    );
    expect(kinds.filter((kind) => kind === "TIP")).toHaveLength(3);
    expect(kinds.filter((kind) => kind === "QUESTION")).toHaveLength(6);
    // Nunca dos consejos seguidos.
    expect(kinds.join(",")).not.toContain("TIP,TIP");
  });

  it("el enfoque cambia de un día a otro y sale de la lista de su tipo", () => {
    const first = plan("2026-10-01", 0);
    const second = plan("2026-10-02", 0);
    expect(first.angle).not.toBe(second.angle);
    for (const offset of [0, 1, 2, 3, 4, 5]) {
      const draft = plan(addDays("2026-10-01", offset), 2);
      const angles: readonly string[] = draft.kind === "TIP" ? TIP_ANGLES : QUESTION_ANGLES;
      expect(angles).toContain(draft.angle);
    }
  });

  it("dos comunidades no reciben el mismo encargo el mismo día", () => {
    const today = [0, 1, 2].map((index) => plan("2026-10-06", index));
    expect(new Set(today.map((draft) => `${draft.kind}:${draft.angle}`)).size).toBe(3);
  });

  it("Humor solo recibe preguntas", () => {
    const kinds = Array.from(
      { length: 12 },
      (_, offset) => plan(addDays("2026-10-01", offset), 0, "humor").kind,
    );
    expect(new Set(kinds)).toEqual(new Set(["QUESTION"]));
  });

  it("propone una fecha cercana y la escalona entre comunidades", () => {
    // Siete días antes de Día de Muertos (2 de noviembre) solo le toca a la primera comunidad.
    expect(plan("2026-10-26", 0, "comida", new Set(["halloween-2026"]))).toMatchObject({
      kind: "DATE",
      occasion: { key: "dia-de-muertos-2026" },
    });
    expect(plan("2026-10-26", 6, "moda", new Set(["halloween-2026"])).kind).not.toBe("DATE");
    // La séptima espera a que falte un día.
    expect(plan("2026-11-01", 6, "moda", new Set(["halloween-2026"]))).toMatchObject({
      kind: "DATE",
      occasion: { key: "dia-de-muertos-2026" },
    });
  });

  it("no repite una fecha que la comunidad ya trató", () => {
    const used = new Set(["halloween-2026", "dia-de-muertos-2026"]);
    expect(plan("2026-10-30", 0, "comida", used).kind).not.toBe("DATE");
  });

  it("el día de la fecha, cualquier comunidad que falte la recibe", () => {
    for (const index of [0, 3, 6, 11]) {
      expect(plan("2026-10-31", index, "moda").kind).toBe("DATE");
    }
  });

  it("un tema del equipo se encarga tal cual", () => {
    expect(planTopic("Empezó el frío")).toMatchObject({ kind: "TOPIC", topic: "Empezó el frío" });
  });
});
