import { describe, expect, it } from "vitest";
import {
  breachReason,
  DEFAULT_GUARDRAILS,
  evaluateGuardrails,
  type GuardrailEvaluation,
  guardrailsSchema,
  noEvidenceNote,
  unresolvedChecks,
  watchOutcome,
} from "./guardrails";
import type { WindowValue } from "./windows";

function windowOf(value: number | null, sample: number): WindowValue {
  return { value, sample, numerator: (value ?? 0) * sample, days: 7 };
}

/** Línea base sana con mucha muestra en todas las métricas que se registran. */
function healthy(overrides: Record<string, WindowValue> = {}) {
  return new Map<string, WindowValue>(
    Object.entries({
      "reports.per_1k_impressions": windowOf(1, 50_000),
      "not_interested.per_1k_impressions": windowOf(5, 50_000),
      "feed.commerce.share": windowOf(0.24, 50_000),
      "feed.commerce.ctr": windowOf(0.02, 50_000),
      "product.visits.per_active_seller": windowOf(10, 70),
      ...overrides,
    }),
  );
}

function evaluate(observed: Map<string, WindowValue>, exposure = 50_000) {
  return evaluateGuardrails(DEFAULT_GUARDRAILS, {
    baseline: healthy(),
    comparable: observed,
    exposure,
  });
}

function checkOf(result: GuardrailEvaluation, metric: string) {
  return result.checks.find((check) => check.metric === metric);
}

describe("salvaguardas del plan (§2.4) con significancia (ADR-037)", () => {
  it("las salvaguardas por omisión son válidas y tienen ventana máxima", () => {
    expect(guardrailsSchema.safeParse(DEFAULT_GUARDRAILS).success).toBe(true);
    expect(DEFAULT_GUARDRAILS.maxWatchDays).toBe(28);
  });

  it("sin cambios: todo bien (y 5xx sin datos, nunca un 0 inventado)", () => {
    const result = evaluate(healthy());
    expect(result.status).toBe("ok");
    expect(checkOf(result, "errors.5xx.rate")?.verdict).toBe("no_data");
  });

  it.each([
    ["reports.per_1k_impressions", windowOf(2, 50_000)],
    ["not_interested.per_1k_impressions", windowOf(7, 50_000)],
    ["feed.commerce.share", windowOf(0.33, 10_000)],
    ["feed.commerce.ctr", windowOf(0.016, 50_000)],
    ["product.visits.per_active_seller", windowOf(8, 70)],
  ])("revierte si %s cruza su límite y el empeoramiento es significativo", (metric, observed) => {
    const result = evaluate(healthy({ [metric]: observed }));
    expect(result.status).toBe("breached");
    const check = checkOf(result, metric)!;
    expect(check.verdict).toBe("breach");
    expect(check.pValue).toBeLessThan(0.05);
    expect(breachReason(result)).toMatch(/^Salvaguarda rota\./);
    expect(check.summary).toMatch(/p = 0\.\d{4}/);
  });

  it("no revierte por ruido: +40 % con pocos reportes no es significativo y se sigue vigilando", () => {
    const result = evaluateGuardrails(DEFAULT_GUARDRAILS, {
      baseline: healthy({ "reports.per_1k_impressions": windowOf(1, 3_000) }),
      comparable: healthy({ "reports.per_1k_impressions": windowOf(1.4, 3_000) }),
      exposure: 50_000,
    });
    const check = checkOf(result, "reports.per_1k_impressions")!;
    expect(check.change).toBeCloseTo(0.4);
    expect(check.verdict).toBe("not_significant");
    expect(check.pValue).toBeGreaterThan(0.05);
    expect(check.summary).toMatch(/sin significancia estadística .*se sigue vigilando/);
    expect(result.status).toBe("ok");
    expect(unresolvedChecks(result).map((item) => item.metric)).toEqual([
      "reports.per_1k_impressions",
    ]);
  });

  it("usa el efecto de diseño por persona: lo que con impresiones independientes sería significativo, no lo es con clústeres grandes", () => {
    const windows = {
      baseline: healthy({ "reports.per_1k_impressions": windowOf(1, 40_000) }),
      comparable: healthy({ "reports.per_1k_impressions": windowOf(1.5, 40_000) }),
      exposure: 50_000,
    };
    const independent = evaluateGuardrails(DEFAULT_GUARDRAILS, {
      ...windows,
      designEffect: { baseline: 1, comparable: 1 },
    });
    const clustered = evaluateGuardrails(DEFAULT_GUARDRAILS, {
      ...windows,
      designEffect: { baseline: 4, comparable: 4 },
    });
    expect(checkOf(independent, "reports.per_1k_impressions")?.verdict).toBe("breach");
    expect(checkOf(clustered, "reports.per_1k_impressions")?.verdict).toBe("not_significant");
  });

  it("antes contra después: si los días varían mucho entre sí, el mismo salto deja de ser significativo", () => {
    // +50 % de reportes con 200 mil impresiones por lado: significativo con solo el efecto de diseño…
    const baseline = healthy({ "reports.per_1k_impressions": windowOf(1, 200_000) });
    const comparable = healthy({ "reports.per_1k_impressions": windowOf(1.5, 200_000) });
    const plain = evaluateGuardrails(DEFAULT_GUARDRAILS, {
      baseline,
      comparable,
      exposure: 50_000,
    });
    const plainCheck = checkOf(plain, "reports.per_1k_impressions")!;
    expect(plainCheck.verdict).toBe("breach");
    expect(plainCheck.varianceFactor).toBeCloseTo(1.95);

    // …pero no si los días de la línea base varían mucho más de lo que explica el azar (χ²/gl = 12,
    // p. ej. de 10 a 60 reportes al día con ~28 esperados): se prueba como cuasi-binomial.
    const noisyDays = { chi2: 72, df: 6 };
    const noisy = evaluateGuardrails(DEFAULT_GUARDRAILS, {
      baseline: healthy({
        "reports.per_1k_impressions": { ...windowOf(1, 200_000), dispersion: noisyDays },
      }),
      // Solo 2 días observados: sin grados de libertad propios, usa la variación de la línea base.
      comparable: healthy({
        "reports.per_1k_impressions": {
          ...windowOf(1.5, 200_000),
          days: 2,
          dispersion: { chi2: 0.5, df: 1 },
        },
      }),
      exposure: 50_000,
    });
    const noisyCheck = checkOf(noisy, "reports.per_1k_impressions")!;
    expect(noisyCheck.verdict).toBe("not_significant");
    expect(noisyCheck.varianceFactor).toBeCloseTo(12);
    expect(noisy.status).toBe("ok");
  });

  it("la sobredispersión nunca hace la prueba MENOS conservadora que el efecto de diseño", () => {
    const calm = { chi2: 1, df: 6 };
    const result = evaluateGuardrails(DEFAULT_GUARDRAILS, {
      baseline: healthy({
        "reports.per_1k_impressions": { ...windowOf(1, 3_000), dispersion: calm },
      }),
      comparable: healthy({
        "reports.per_1k_impressions": { ...windowOf(1.4, 3_000), dispersion: calm },
      }),
      exposure: 50_000,
    });
    const check = checkOf(result, "reports.per_1k_impressions")!;
    expect(check.varianceFactor).toBeCloseTo(1.95);
    expect(check.verdict).toBe("not_significant");
  });

  it("no revierte por cambios dentro del límite (ni por mejoras)", () => {
    const result = evaluate(
      healthy({
        "reports.per_1k_impressions": windowOf(1.2, 50_000),
        "feed.commerce.ctr": windowOf(0.03, 50_000),
      }),
    );
    expect(result.status).toBe("ok");
    expect(checkOf(result, "feed.commerce.ctr")?.pValue).toBeNull();
  });

  it("antes de la exposición mínima no hay veredicto (aunque algo se vea mal)", () => {
    const result = evaluate(healthy({ "feed.commerce.share": windowOf(0.4, 50_000) }), 1_000);
    expect(result.status).toBe("pending");
  });

  it("con línea base en 0 usa un límite absoluto (y lo que debe bajar no puede empeorar desde 0)", () => {
    const zero = healthy({
      "reports.per_1k_impressions": windowOf(0, 10_000),
      "feed.commerce.ctr": windowOf(0, 10_000),
    });
    const run = (reports: number) =>
      evaluateGuardrails(DEFAULT_GUARDRAILS, {
        baseline: zero,
        comparable: healthy({
          "reports.per_1k_impressions": windowOf(reports, 10_000),
          "feed.commerce.ctr": windowOf(0, 10_000),
        }),
        exposure: 50_000,
      });
    const high = checkOf(run(3), "reports.per_1k_impressions")!;
    expect(high).toMatchObject({ verdict: "breach", limit: 1, change: null });
    expect(high.summary).toMatch(/línea base en 0/);
    expect(checkOf(run(1.2), "reports.per_1k_impressions")?.verdict).toBe("not_significant");
    expect(checkOf(run(0.5), "reports.per_1k_impressions")?.verdict).toBe("ok");
    expect(checkOf(run(0.5), "feed.commerce.ctr")?.verdict).toBe("ok");
  });

  it("una regla sin límite para línea base en 0 no decide; sin muestra suficiente, tampoco", () => {
    const guardrails = {
      ...DEFAULT_GUARDRAILS,
      rules: [
        {
          type: "relative" as const,
          metric: "feed.engagement.rate",
          direction: "increase" as const,
          maxRelativeChange: 0.2,
          minSample: 100,
        },
        DEFAULT_GUARDRAILS.rules[1]!,
      ],
    };
    const result = evaluateGuardrails(guardrails, {
      baseline: healthy({ "feed.engagement.rate": windowOf(0, 10_000) }),
      comparable: healthy({
        "feed.engagement.rate": windowOf(0.5, 10_000),
        "not_interested.per_1k_impressions": windowOf(50, 100),
      }),
      exposure: 50_000,
    });
    expect(checkOf(result, "feed.engagement.rate")?.verdict).toBe("no_baseline");
    expect(checkOf(result, "not_interested.per_1k_impressions")?.verdict).toBe("no_data");
    expect(result.status).toBe("ok");
  });

  it("los límites absolutos usan todos los días observados (también los congelados)", () => {
    const result = evaluateGuardrails(DEFAULT_GUARDRAILS, {
      baseline: healthy(),
      comparable: healthy(),
      absolute: healthy({ "feed.commerce.share": windowOf(0.35, 20_000) }),
      exposure: 50_000,
    });
    expect(checkOf(result, "feed.commerce.share")?.verdict).toBe("breach");
  });
});

describe("cuánto se vigila (ADR-037: nada se vigila para siempre)", () => {
  const settled = evaluate(healthy());
  const noisy = evaluateGuardrails(DEFAULT_GUARDRAILS, {
    baseline: healthy({ "reports.per_1k_impressions": windowOf(1, 3_000) }),
    comparable: healthy({ "reports.per_1k_impressions": windowOf(1.4, 3_000) }),
    exposure: 50_000,
  });
  const lowExposure = evaluate(healthy(), 1_000);
  const breached = evaluate(healthy({ "reports.per_1k_impressions": windowOf(2, 50_000) }));

  it("revierte en cuanto se rompe una salvaguarda, sin esperar", () => {
    expect(watchOutcome(breached, 2, DEFAULT_GUARDRAILS)).toBe("revert");
  });

  it("con todo evaluado y sin daño, termina a los días de vigilancia (los 5xx sin registrar no la alargan)", () => {
    expect(watchOutcome(settled, 13, DEFAULT_GUARDRAILS)).toBe("watching");
    expect(watchOutcome(settled, 14, DEFAULT_GUARDRAILS)).toBe("no_harm");
  });

  it("sin datos suficientes o sin significancia sigue vigilando hasta la ventana máxima y ahí se cierra", () => {
    for (const evaluation of [noisy, lowExposure]) {
      expect(watchOutcome(evaluation, 14, DEFAULT_GUARDRAILS)).toBe("watching");
      expect(watchOutcome(evaluation, 27, DEFAULT_GUARDRAILS)).toBe("watching");
      expect(watchOutcome(evaluation, 28, DEFAULT_GUARDRAILS)).toBe("no_evidence");
    }
    // Decisiones viejas sin `maxWatchDays`: también se cierran (28 días por omisión).
    const { maxWatchDays: _omit, ...legacy } = DEFAULT_GUARDRAILS;
    expect(watchOutcome(lowExposure, 28, legacy)).toBe("no_evidence");
  });

  it("la nota de cierre dice que no hay evidencia de daño, no que el cambio sea seguro", () => {
    const note = noEvidenceNote(lowExposure, 28);
    expect(note).toMatch(/sin evidencia de daño con esta muestra/);
    expect(note).toMatch(/no quiere decir que el cambio sea seguro/);
    expect(note).toMatch(/1,000 de 5,000 impresiones/);
    expect(noEvidenceNote(noisy, 28)).toMatch(/Reportes por mil impresiones/);
  });
});
