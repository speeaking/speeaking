import { describe, expect, it } from "vitest";
import { tagDecision, type TaggableProduct } from "./rules";

const ME = "0199a000-0000-7000-8000-00000000000a";
const STORE = "0199a000-0000-7000-8000-00000000000b";

const product = (overrides: Partial<TaggableProduct> = {}): TaggableProduct => ({
  status: "ACTIVE",
  moderationStatus: "VISIBLE",
  seller: { userId: STORE, status: "ACTIVE", acceptsCollaborations: true },
  ...overrides,
});

describe("tagDecision (ADR-063)", () => {
  it("lo propio se etiqueta siempre, aunque esté pausado; lo oculto por moderación no", () => {
    const mine = { userId: ME, status: "ACTIVE", acceptsCollaborations: false } as const;
    expect(tagDecision(ME, product({ seller: mine, status: "PAUSED" }))).toEqual({
      ok: true,
      kind: "own",
    });
    expect(tagDecision(ME, product({ seller: mine, moderationStatus: "HIDDEN" }))).toEqual({
      ok: false,
      reason: "hidden",
    });
  });

  it("el producto de otra tienda solo si esa tienda aceptó colaboraciones", () => {
    expect(tagDecision(ME, product())).toEqual({ ok: true, kind: "collaboration" });
    expect(
      tagDecision(
        ME,
        product({ seller: { userId: STORE, status: "ACTIVE", acceptsCollaborations: false } }),
      ),
    ).toEqual({ ok: false, reason: "not_accepting" });
  });

  it("de una tienda ajena, solo lo que está a la venta y visible", () => {
    for (const status of ["DRAFT", "PAUSED", "SOLD_OUT", "ARCHIVED"] as const) {
      expect(tagDecision(ME, product({ status }))).toEqual({ ok: false, reason: "unavailable" });
    }
    // Oculto por moderación o tienda suspendida: mismo motivo neutro (no se revela cuál).
    expect(tagDecision(ME, product({ moderationStatus: "HIDDEN" }))).toEqual({
      ok: false,
      reason: "unavailable",
    });
    expect(
      tagDecision(
        ME,
        product({ seller: { userId: STORE, status: "SUSPENDED", acceptsCollaborations: true } }),
      ),
    ).toEqual({ ok: false, reason: "unavailable" });
  });
});
