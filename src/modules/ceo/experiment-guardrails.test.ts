import { describe, expect, it } from "vitest";
import type { PersonFeedActivity } from "@/modules/analytics/platform-aggregates";
import { assignVariant } from "@/modules/platform/experiments";
import { evaluateExperimentData } from "./experiments";

/**
 * Salvaguardas entre variantes (ADR-037): la persona es la unidad asignada, así que una sola cuenta
 * con muchos «No me interesa» infla la varianza de su variante (sobredispersión entre personas) en
 * lugar de detener el experimento; un empeoramiento de muchas personas sí lo detiene.
 */

const KEY = "commerceSlotEvery.2026-10-01.abc0000001";
const ALLOCATION = 0.5;
const START = new Date("2026-10-01T12:00:00Z");
const NOW = new Date("2026-10-15T12:00:00Z");

function person(index: number): PersonFeedActivity {
  return {
    userId: `00000000-0000-4000-8000-${index.toString(16).padStart(12, "0")}`,
    impressions: 25,
    commerceImpressions: 5,
    productVisitsFromFeed: index % 10 === 0 ? 1 : 0,
    engagements: 1,
    notInterested: index % 20 === 0 ? 1 : 0,
    reports: 0,
  };
}

const people = Array.from({ length: 400 }, (_, index) => person(index));
const variantOf = (activity: PersonFeedActivity) => assignVariant(KEY, activity.userId, ALLOCATION);

function evaluate(activity: readonly PersonFeedActivity[]) {
  return evaluateExperimentData({
    experiment: {
      key: KEY,
      allocation: ALLOCATION,
      primaryMetric: "feed.product_visits.rate",
      minSamplePerVariant: 4_000,
      guardrails: null,
      startedAt: START,
    },
    people: activity,
    end: NOW,
    now: NOW,
  });
}

const notInterestedCheck = (result: ReturnType<typeof evaluate>) =>
  result.guardrails.checks.find((check) => check.metric === "not_interested.per_1k_impressions")!;

describe("salvaguardas de un experimento con la persona como unidad", () => {
  it("ambas variantes tienen suficientes personas para la prueba", () => {
    const treatment = people.filter((activity) => variantOf(activity) === "treatment").length;
    expect(treatment).toBeGreaterThan(150);
    expect(people.length - treatment).toBeGreaterThan(150);
  });

  it("una sola cuenta del tratamiento con 25 «No me interesa» no detiene el experimento", () => {
    const attacker = people.find((activity) => variantOf(activity) === "treatment")!;
    const withAttacker = people.map((activity) =>
      activity === attacker ? { ...activity, notInterested: 25 } : activity,
    );
    const result = evaluate(withAttacker);
    const check = notInterestedCheck(result);
    // El salto relativo es enorme (> +100 %), pero lo explica una persona.
    expect(check.change!).toBeGreaterThan(1);
    expect(check.verdict).toBe("not_significant");
    expect(check.varianceFactor!).toBeGreaterThan(10);
    expect(result.verdict).not.toBe("stopped_guardrail");
  });

  it("si muchas personas del tratamiento lo marcan, sí se detiene", () => {
    const widespread = people.map((activity) =>
      variantOf(activity) === "treatment"
        ? { ...activity, notInterested: activity.notInterested + 1 }
        : activity,
    );
    const result = evaluate(widespread);
    expect(notInterestedCheck(result).verdict).toBe("breach");
    expect(result.verdict).toBe("stopped_guardrail");
  });
});
