import { describe, expect, it } from "vitest";
import { DEFAULT_FEED_POLICY, feedPolicySchema } from "./policy";

describe("feedPolicySchema", () => {
  it("la política por defecto es válida y deja ~1 pieza comercial por cada 3–4 de contenido", () => {
    const policy = feedPolicySchema.parse(DEFAULT_FEED_POLICY);

    expect(policy.commerceSlotEvery).toBeGreaterThanOrEqual(4);
  });

  it("no permite convertir el feed en catálogo (menos de 1 de cada 3)", () => {
    expect(
      feedPolicySchema.safeParse({ ...DEFAULT_FEED_POLICY, commerceSlotEvery: 2 }).success,
    ).toBe(false);
  });

  it("limita la exploración a como máximo la mitad del feed", () => {
    expect(
      feedPolicySchema.safeParse({ ...DEFAULT_FEED_POLICY, explorationShare: 0.8 }).success,
    ).toBe(false);
  });
});
