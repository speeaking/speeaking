import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_POLICY } from "@/modules/feed/policy";
import {
  assignmentBucket,
  assignVariant,
  feedExperimentAssignments,
  resolveFeedPolicy,
} from "./experiments";

const USER = "0199a000-0000-7000-8000-00000000000a";

describe("asignación estable por persona", () => {
  it("la misma persona cae siempre en la misma variante", () => {
    const first = assignVariant("commerceSlotEvery.2026-09-26.abc", USER, 0.1);
    for (let i = 0; i < 20; i++) {
      expect(assignVariant("commerceSlotEvery.2026-09-26.abc", USER, 0.1)).toBe(first);
    }
    expect(assignmentBucket("exp", USER)).toBe(assignmentBucket("exp", USER.toUpperCase()));
  });

  it("sin sesión siempre es control", () => {
    expect(assignVariant("exp", null, 1)).toBe("control");
    expect(assignVariant("exp", undefined, 0.99)).toBe("control");
  });

  it("reparte según la fracción y de forma independiente entre experimentos", () => {
    const users = Array.from({ length: 20_000 }, () => randomUUID());
    const inA = users.filter((user) => assignVariant("exp-a", user, 0.1) === "treatment");
    expect(inA.length / users.length).toBeGreaterThan(0.09);
    expect(inA.length / users.length).toBeLessThan(0.11);
    // Entre quienes están en A, la fracción en B sigue siendo ≈ 10 % (hashes independientes).
    const inBoth = inA.filter((user) => assignVariant("exp-b", user, 0.1) === "treatment");
    expect(inBoth.length / inA.length).toBeGreaterThan(0.07);
    expect(inBoth.length / inA.length).toBeLessThan(0.13);
  });

  it("con fracción 0 nadie recibe el tratamiento", () => {
    expect(assignVariant("exp", USER, 0)).toBe("control");
  });
});

describe("política del feed por persona", () => {
  const running = {
    key: "exp-slot",
    settingKey: "feed.policy.commerceSlotEvery",
    variants: { control: 4, treatment: 5 },
    allocation: 1,
  };

  it("quien está en el tratamiento ve el valor de tratamiento; sin sesión, la base", () => {
    expect(resolveFeedPolicy(DEFAULT_FEED_POLICY, [running], USER).commerceSlotEvery).toBe(5);
    expect(resolveFeedPolicy(DEFAULT_FEED_POLICY, [running], null)).toBe(DEFAULT_FEED_POLICY);
    expect(resolveFeedPolicy(DEFAULT_FEED_POLICY, [{ ...running, allocation: 0 }], USER)).toEqual(
      DEFAULT_FEED_POLICY,
    );
  });

  it("ignora un experimento cuyo control ya no es el valor vigente (p. ej. se revirtió el ajuste)", () => {
    const reverted = { ...DEFAULT_FEED_POLICY, commerceSlotEvery: 3 };
    // Control 4 y tratamiento 5, pero el valor vigente volvió a 3: el tratamiento quedaría a 2 pasos.
    expect(resolveFeedPolicy(reverted, [running], USER)).toBe(reverted);
  });

  it("ignora experimentos fuera del catálogo o con valores fuera de límites", () => {
    const outOfBounds = { ...running, variants: { control: 4, treatment: 2 } };
    const unknown = { ...running, settingKey: "commerce.fees.platformFeeBps" };
    const broken = { ...running, variants: { treatment: "mucho" } };
    for (const experiment of [outOfBounds, unknown, broken]) {
      expect(resolveFeedPolicy(DEFAULT_FEED_POLICY, [experiment], USER)).toEqual(
        DEFAULT_FEED_POLICY,
      );
    }
  });

  it("la variante que se registra con la impresión visible es la misma que se sirvió", () => {
    const control = { ...running, key: "exp-control", allocation: 0 };
    const stale = { ...running, key: "exp-stale", variants: { control: 3, treatment: 4 } };
    expect(feedExperimentAssignments(DEFAULT_FEED_POLICY, [running, control, stale], USER)).toEqual(
      [
        { key: "exp-slot", variant: "treatment" },
        { key: "exp-control", variant: "control" },
      ],
    );
    expect(feedExperimentAssignments(DEFAULT_FEED_POLICY, [running], null)).toEqual([]);
  });
});
