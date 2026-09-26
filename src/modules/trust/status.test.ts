import { describe, expect, it } from "vitest";
import { buyerAuthenticityView, nextCheckStatus, REVIEWED_LABEL, UNVERIFIED_LABEL } from "./status";

const next = (
  current: Parameters<typeof nextCheckStatus>[0]["current"],
  level: "LOW" | "MEDIUM" | "HIGH",
  score: number,
  authenticity: "DECLARED_ORIGINAL" | "GENERIC" | "NOT_APPLICABLE" = "DECLARED_ORIGINAL",
) => nextCheckStatus({ current, level, score, authenticity });

describe("nextCheckStatus", () => {
  it("riesgo alto pide prueba; bajo o medio no pide nada", () => {
    expect(next(null, "HIGH", 1)).toEqual({ status: "NEEDS_PROOF", frozen: false });
    expect(next(null, "MEDIUM", 0.4)).toEqual({ status: "AUTO_CLEAR", frozen: false });
    expect(next(null, "LOW", 0)).toEqual({ status: "AUTO_CLEAR", frozen: false });
  });

  it("si ya había fotos de prueba, vuelve a la cola como «en revisión»", () => {
    const current = { status: "AUTO_CLEAR" as const, score: 0.2, proofCount: 2 };
    expect(next(current, "HIGH", 0.8).status).toBe("PROOF_SUBMITTED");
  });

  it("al corregir la publicación (riesgo menor) se libera la petición", () => {
    expect(next({ status: "NEEDS_PROOF", score: 1, proofCount: 0 }, "LOW", 0).status).toBe(
      "AUTO_CLEAR",
    );
    expect(next({ status: "PROOF_SUBMITTED", score: 1, proofCount: 1 }, "MEDIUM", 0.4).status).toBe(
      "AUTO_CLEAR",
    );
    expect(next({ status: "PROOF_SUBMITTED", score: 1, proofCount: 1 }, "HIGH", 0.8).status).toBe(
      "PROOF_SUBMITTED",
    );
  });

  it("la verificación del equipo se conserva mientras el riesgo no suba", () => {
    const verified = { status: "VERIFIED_BY_ADMIN" as const, score: 0.8, proofCount: 1 };
    expect(next(verified, "HIGH", 0.8)).toEqual({ status: "VERIFIED_BY_ADMIN", frozen: true });
    expect(next(verified, "LOW", 0)).toEqual({ status: "VERIFIED_BY_ADMIN", frozen: true });
    // Sube el riesgo (p. ej. bajó más el precio): vuelve a la cola con la prueba que había.
    expect(next(verified, "HIGH", 1)).toEqual({ status: "PROOF_SUBMITTED", frozen: false });
    // Deja de declararse original: ya no hay nada que mostrar como revisado.
    expect(next(verified, "LOW", 0, "GENERIC")).toEqual({ status: "AUTO_CLEAR", frozen: false });
  });

  it("el sello no se hereda: si cambia qué se vende, se reevalúa aunque el riesgo no suba", () => {
    const verified = { status: "VERIFIED_BY_ADMIN" as const, score: 0.8, proofCount: 1 };
    const changed = (level: "LOW" | "HIGH", score: number) =>
      nextCheckStatus({
        current: verified,
        level,
        score,
        authenticity: "DECLARED_ORIGINAL",
        listingChanged: true,
      });
    // Otro artículo sin señales: se muestra lo que declara el vendedor, sin «Comprobante revisado».
    expect(changed("LOW", 0)).toEqual({ status: "AUTO_CLEAR", frozen: false });
    // Otro artículo con riesgo alto: vuelve a la cola con el comprobante anterior para revisarlo.
    expect(changed("HIGH", 0.8)).toEqual({ status: "PROOF_SUBMITTED", frozen: false });
  });

  it("un rechazo del equipo no se deshace editando; si vuelve a declarar original, se pide prueba", () => {
    const rejected = { status: "REJECTED" as const, score: 1, proofCount: 1 };
    expect(next(rejected, "LOW", 0, "GENERIC").status).toBe("REJECTED");
    expect(next(rejected, "LOW", 0, "DECLARED_ORIGINAL").status).toBe("NEEDS_PROOF");
  });
});

describe("buyerAuthenticityView", () => {
  const check = (
    status: "AUTO_CLEAR" | "NEEDS_PROOF" | "PROOF_SUBMITTED" | "VERIFIED_BY_ADMIN" | "REJECTED",
    riskLevel: "LOW" | "MEDIUM" | "HIGH",
    signals: { rule: string; weight: number }[] = [],
  ) => ({ status, riskLevel, signals });

  it("sin revisión, o riesgo bajo, se muestra lo que declaró el vendedor", () => {
    expect(buyerAuthenticityView("DECLARED_ORIGINAL", null)).toEqual({
      claim: "declared",
      label: null,
      detail: null,
      note: null,
    });
    expect(buyerAuthenticityView("DECLARED_ORIGINAL", check("AUTO_CLEAR", "LOW")).claim).toBe(
      "declared",
    );
  });

  it("con prueba pedida o en revisión, la declaración «original» se oculta", () => {
    for (const status of ["NEEDS_PROOF", "PROOF_SUBMITTED", "REJECTED"] as const) {
      const view = buyerAuthenticityView("DECLARED_ORIGINAL", check(status, "HIGH"));
      expect(view.claim).toBe("unverified");
      expect(view.label).toBe(UNVERIFIED_LABEL);
      expect(view.detail).not.toMatch(/original/i);
    }
  });

  it("«Comprobante revisado» solo con la verificación del equipo, sin prometer garantía", () => {
    const view = buyerAuthenticityView("DECLARED_ORIGINAL", check("VERIFIED_BY_ADMIN", "HIGH"));
    expect(view.claim).toBe("reviewed");
    expect(view.label).toBe(REVIEWED_LABEL);
    expect(view.detail).toContain("No es una certificación ni una garantía");
    expect(view.note).toBeNull();
    // Si el producto ya no se declara original, no hay nada revisado que mostrar.
    expect(buyerAuthenticityView("GENERIC", check("VERIFIED_BY_ADMIN", "LOW")).claim).toBe(
      "declared",
    );
  });

  it("riesgo medio: nota neutral según la señal (nunca acusa)", () => {
    const strong = buyerAuthenticityView(
      "GENERIC",
      check("AUTO_CLEAR", "MEDIUM", [{ rule: "price_below_comparables", weight: 0.4 }]),
    );
    expect(strong.note).toBe("Revisa: el precio es muy inferior al de productos similares.");
    const mild = buyerAuthenticityView(
      "DECLARED_ORIGINAL",
      check("AUTO_CLEAR", "MEDIUM", [{ rule: "price_below_reference", weight: 0.2 }]),
    );
    expect(mild).toMatchObject({
      claim: "declared",
      note: expect.stringMatching(/^Revisa: el precio es inferior/),
    });
    const other = buyerAuthenticityView(
      "GENERIC",
      check("AUTO_CLEAR", "MEDIUM", [{ rule: "buyer_reports", weight: 0.3 }]),
    );
    expect(other.note).toBe("Revisa bien las fotos y la descripción antes de comprar.");
    for (const view of [strong, mild, other]) {
      expect(`${view.label} ${view.detail} ${view.note}`).not.toMatch(/falso|falsificaci/i);
    }
  });
});
