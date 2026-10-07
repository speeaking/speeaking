import { describe, expect, it } from "vitest";
import {
  isUrgentReportReason,
  REPORT_REASON_LABELS,
  REPORT_REASONS,
  reportReasonsFor,
} from "./labels";
import { moderationActionSchema, reportInputSchema } from "./schemas";

const ID = "0199a000-0000-7000-8000-000000000001";

describe("motivos de reporte", () => {
  it("incluye los daños urgentes y la cuenta de un menor; «Otro motivo» sigue al final", () => {
    expect(REPORT_REASONS).toEqual(
      expect.arrayContaining(["INTIMATE_WITHOUT_CONSENT", "CHILD_SAFETY", "MINOR_ACCOUNT"]),
    );
    expect(REPORT_REASONS.at(-1)).toBe("OTHER");
    expect(new Set(REPORT_REASONS).size).toBe(Object.keys(REPORT_REASON_LABELS).length);
  });

  it("«Cuenta de un menor de edad» solo aparece al reportar a una persona", () => {
    expect(reportReasonsFor("USER")).toContain("MINOR_ACCOUNT");
    for (const target of ["POST", "PRODUCT", "COMMENT"] as const) {
      expect(reportReasonsFor(target)).not.toContain("MINOR_ACCOUNT");
      expect(reportReasonsFor(target)).toContain("CHILD_SAFETY");
    }
  });

  it("contenido íntimo sin consentimiento y riesgo para menores son urgentes", () => {
    expect(isUrgentReportReason("INTIMATE_WITHOUT_CONSENT")).toBe(true);
    expect(isUrgentReportReason("CHILD_SAFETY")).toBe(true);
    expect(isUrgentReportReason("MINOR_ACCOUNT")).toBe(false);
    expect(isUrgentReportReason("SPAM")).toBe(false);
  });
});

describe("reportInputSchema", () => {
  it("acepta comentarios y los motivos nuevos", () => {
    const parsed = reportInputSchema.safeParse({
      targetType: "COMMENT",
      targetId: ID,
      reason: "INTIMATE_WITHOUT_CONSENT",
      details: "  ",
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.details).toBeUndefined();
  });

  it("«Cuenta de un menor de edad» solo vale para una persona", () => {
    expect(
      reportInputSchema.safeParse({ targetType: "USER", targetId: ID, reason: "MINOR_ACCOUNT" })
        .success,
    ).toBe(true);
    const onPost = reportInputSchema.safeParse({
      targetType: "POST",
      targetId: ID,
      reason: "MINOR_ACCOUNT",
    });
    expect(onPost.success).toBe(false);
    if (!onPost.success) expect(onPost.error.issues[0]?.path).toEqual(["reason"]);
  });

  it("un aviso de derechos de autor no es un motivo de reporte (va al aviso formal)", () => {
    expect(
      reportInputSchema.safeParse({ targetType: "POST", targetId: ID, reason: "RIGHTS" }).success,
    ).toBe(false);
  });
});

describe("moderationActionSchema", () => {
  it("el equipo puede ocultar, restaurar o descartar un comentario", () => {
    for (const action of ["hide", "restore", "dismiss"]) {
      expect(
        moderationActionSchema.safeParse({ action, targetType: "COMMENT", targetId: ID }).success,
      ).toBe(true);
    }
  });
});
