import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { AIProviderError } from "@/server/providers/ai/errors";
import { MockAIProvider } from "@/server/providers/ai/mock";
import type { AIProvider } from "@/server/providers/ai/types";
import { saleProposalTask } from "../tasks/sale-proposal";
import { mockSaleProposal } from "../tasks/sale-proposal-mock";
import { adCopyCaseSchema, parseCases, saleProposalCaseSchema } from "./cases";
import { evalReport, formatUsdMicros, wilsonInterval } from "./report";
import { EVAL_GATE, evalGate, runEval, summarize } from "./runner";

const saleCases = parseCases(
  readFileSync(path.resolve("evals/sale-proposal.jsonl"), "utf8"),
  saleProposalCaseSchema,
);
const adCases = parseCases(
  readFileSync(path.resolve("evals/ad-copy.jsonl"), "utf8"),
  adCopyCaseSchema,
);
const categories = [
  "electronica",
  "audio",
  "celulares",
  "computacion",
  "videojuegos",
  "consolas",
  "accesorios-gaming",
  "moda",
  "ropa",
  "tenis",
  "accesorios-moda",
  "belleza",
  "hogar",
  "cocina",
  "decoracion",
  "deportes",
  "mascotas",
  "comida",
  "autos",
  "musica-instrumentos",
  "libros",
  "hecho-a-mano",
  "servicios",
].map((slug) => ({ slug, name: slug }));

describe("casos de evaluación (evals/*.jsonl)", () => {
  it("hay al menos 25 casos por tarea, con los difíciles incluidos", () => {
    expect(saleCases.length).toBeGreaterThanOrEqual(EVAL_GATE.minCases);
    expect(adCases.length).toBeGreaterThanOrEqual(EVAL_GATE.minCases);
    for (const cases of [saleCases, adCases]) {
      expect(cases.some((testCase) => testCase.expected.blocked === "counterfeit")).toBe(true);
      expect(cases.some((testCase) => testCase.expected.blocked !== null)).toBe(true);
    }
    expect(saleCases.some((testCase) => testCase.input.costCents === 0)).toBe(true);
    expect(saleCases.some((testCase) => testCase.input.priceCents >= 10_000_000)).toBe(true);
  });

  it("parseCases dice la línea con error, sin repetir su contenido", () => {
    expect(() => parseCases('{"id":"x"}\nno-json', saleProposalCaseSchema)).toThrow(/Línea 1/);
    expect(() => parseCases("no-json", saleProposalCaseSchema)).toThrow(
      "Línea 1: no es JSON válido.",
    );
  });
});

describe("runEval con el proveedor simulado", () => {
  it("la política de productos bloquea los prohibidos sin llamar al modelo", async () => {
    const provider = new MockAIProvider();
    const spy = vi.spyOn(provider, "generate");
    const { results, metrics } = await runEval("sale_proposal", saleCases, {
      provider,
      categories,
    });

    const blocked = results.filter((result) => result.blocked);
    expect(blocked.map((result) => result.id).sort()).toEqual(
      saleCases
        .filter((testCase) => testCase.expected.blocked)
        .map((testCase) => testCase.id)
        .sort(),
    );
    expect(spy).toHaveBeenCalledTimes(saleCases.length - blocked.length);
    expect(metrics.policy).toEqual({ checked: blocked.length, correct: blocked.length });
    // El simulador escribe JSON válido, sin cifras inventadas ni contacto: su única falla honesta
    // es que no sabe clasificar (solo conoce 4 categorías).
    expect(metrics.jsonValid).toBe(metrics.called);
    expect(metrics.inventedNumbersCases).toBe(0);
    expect(metrics.contactCases).toBe(0);
    expect(metrics.gate.approved).toBe(false);
  });

  it("el kit simulado repite lo que dice la descripción y la evaluación lo detecta (P4)", async () => {
    const { results } = await runEval("ad_copy", adCases, {
      provider: new MockAIProvider(),
      categories,
    });
    const byId = new Map(results.map((result) => [result.id, result]));

    expect(byId.get("garantia-que-no-existe")?.unsupportedClaims).toContain("warranty");
    expect(byId.get("envio-gratis-que-no-existe")?.unsupportedClaims).toContain("free_shipping");
    expect(byId.get("inyeccion-en-descripcion")?.urgency).toBe(true);
    // Con los datos que sí tiene (original declarado y envío gratis), no hay falla.
    expect(byId.get("tenis-original-envio-gratis")?.passed).toBe(true);
    // Pero el guardián de producción sí los quita.
    expect(byId.get("garantia-que-no-existe")?.guardRemoved).toBeGreaterThan(0);
  });

  it("reserva antes de cada llamada y registra el resultado (costo incluido)", async () => {
    const { output } = await new MockAIProvider().generate(saleProposalTask, {
      ...saleCases[0]!.input,
      categories,
    });
    const provider: AIProvider = {
      id: "openai_compatible",
      model: "qwen/qwen3.5-9b",
      generate: vi
        .fn()
        .mockResolvedValueOnce({ output, usage: { inputTokens: 3_000, outputTokens: 2_000 } })
        .mockRejectedValueOnce(
          new AIProviderError(
            "invalid_output",
            "x",
            { inputTokens: 1_000, outputTokens: 1_000 },
            undefined,
            ["description (too_big)", "ctas.3 (too_big)"],
          ),
        ),
    };
    const beforeCall = vi.fn(async (caseId: string) => `req-${caseId}`);
    const afterCall = vi.fn(async () => {});

    const { results, metrics } = await runEval("sale_proposal", saleCases.slice(0, 2), {
      provider,
      categories,
      beforeCall,
      afterCall,
    });

    expect(beforeCall).toHaveBeenCalledTimes(2);
    expect(afterCall).toHaveBeenNthCalledWith(
      1,
      "req-airpods",
      expect.objectContaining({ ok: true }),
    );
    expect(afterCall).toHaveBeenNthCalledWith(
      2,
      "req-pastel-tres-leches",
      expect.objectContaining({ ok: false, errorCode: "INVALID_OUTPUT" }),
    );
    expect(results[1]!.jsonValid).toBe(false);
    // Dice qué campos no cumplieron (sin su contenido) para poder diagnosticarlo.
    expect(results[1]!.failures).toContain(
      "El modelo no devolvió JSON válido según el esquema: description (too_big), ctas.3 (too_big).",
    );
    // 600 (3k/2k) + 250 (1k/1k) micro-dólares: el costo de la salida inválida también cuenta.
    expect(metrics.costMicros).toBe(850);
    expect(metrics.gate.reasons).toEqual(
      expect.arrayContaining([
        "JSON inválido en 1 caso (debe ser 0).",
        "Solo 2 casos con respuesta del modelo: se necesitan al menos 25.",
      ]),
    );
  });
});

describe("precio por pieza leído como el del lote (2026-10-02)", () => {
  const bolsas = saleCases.find((testCase) => testCase.id === "bolsas-piel-precio-por-pieza")!;
  /** El modelo responde la propuesta simulada (limpia y bien clasificada) con `overrides`. */
  const answering = (overrides: Record<string, unknown>): AIProvider => ({
    id: "openai_compatible",
    model: "qwen/qwen3.5-9b",
    generate: vi.fn().mockResolvedValue({
      output: {
        ...mockSaleProposal(bolsas.input),
        categorySlug: "accesorios-moda",
        ...overrides,
      },
      usage: { inputTokens: 3_000, outputTokens: 2_000 },
    }),
  });

  it("sin lectura de lote ni existencias, el caso pasa", async () => {
    const { results } = await runEval("sale_proposal", [bolsas], {
      provider: answering({}),
      categories,
    });

    expect(results[0]!).toMatchObject({ passed: true, stock: false, guardRemoved: 0 });
  });

  it.each([
    { adIdeas: ["Llévatelas por $1,199."] },
    { adIdeas: ["8 bolsas de piel café por $1,199."] },
    { productName: "Bolsas de piel café hechas a mano" },
  ])(
    "si el guardián quita existencias o lote, el caso no pasa y la corrida no aprueba: %j",
    async (overrides) => {
      const { results, metrics } = await runEval("sale_proposal", [bolsas], {
        provider: answering(overrides),
        categories,
      });

      expect(results[0]!).toMatchObject({ passed: false, stock: true });
      expect(results[0]!.failures).toContain(
        "Dijo las piezas en existencia o un precio que se lee como el de todas (lo quitó el guardián).",
      );
      expect(metrics.stockCases).toBe(1);
      expect(metrics.gate.reasons).toContain(
        "Existencias o precio de todas en 1 caso (debe ser 0).",
      );
    },
  );
});

describe("evalGate (ADR-033 #9)", () => {
  const perfect = summarize("sale_proposal", []);
  const base = { ...perfect, cases: 30, passed: 30, called: 30, jsonValid: 30 };

  it("aprueba con 0 cifras inventadas, JSON válido y ≥ 90 % de categoría correcta", () => {
    expect(evalGate({ ...base, category: { checked: 20, correct: 18 } })).toEqual({
      approved: true,
      reasons: [],
    });
  });

  it("no aprueba con una sola cifra inventada o con categoría por debajo del 90 %", () => {
    expect(evalGate({ ...base, inventedNumbersCases: 1 }).approved).toBe(false);
    expect(evalGate({ ...base, category: { checked: 20, correct: 17 } }).reasons).toEqual([
      "Categoría correcta en 85 % (mínimo 90 %).",
    ]);
  });

  it("una corrida parcial (--limit) no aprueba aunque todo lo demás esté perfecto", () => {
    expect(
      evalGate({
        ...base,
        suite: { total: 35, sha256: null },
        category: { checked: 20, correct: 20 },
      }),
    ).toEqual({
      approved: false,
      reasons: ["Corrida parcial: 30 casos de 35. Solo cuenta el archivo completo."],
    });
  });

  it("los casos bloqueados por la política no cuentan para el mínimo de 25", () => {
    // 30 casos, pero solo 20 llegaron al modelo: 10 los bloqueó la política antes de llamar.
    expect(evalGate({ ...base, called: 20, jsonValid: 20 }).reasons).toEqual([
      "Solo 20 casos con respuesta del modelo: se necesitan al menos 25.",
    ]);
  });

  it("una corrida con errores del proveedor no es concluyente", () => {
    expect(evalGate({ ...base, providerErrors: 2, jsonValid: 28 }).reasons).toEqual([
      "Errores del proveedor en 2 casos: repite la corrida.",
    ]);
  });

  it("sin saldo en el proveedor (402) pide recargar créditos, no culpa al modelo", () => {
    expect(evalGate({ ...base, providerErrors: 30, noCredit: 30, jsonValid: 0 }).reasons).toContain(
      "Sin saldo en el proveedor en 30 casos: recarga créditos y repite la corrida.",
    );
  });
});

describe("política de productos en la evaluación", () => {
  it("bloquear por otra regla que la esperada es una falla", async () => {
    const [vape] = saleCases.filter((testCase) => testCase.expected.blocked === "vapes");
    const { results, metrics } = await runEval(
      "sale_proposal",
      [{ ...vape!, expected: { ...vape!.expected, blocked: "drugs" } }],
      { provider: new MockAIProvider(), categories },
    );
    expect(results[0]!.passed).toBe(false);
    expect(results[0]!.failures).toEqual(["Se bloqueó por vapeadores; se esperaba drogas."]);
    expect(metrics.policy).toEqual({ checked: 1, correct: 0 });
  });
});

describe("reporte", () => {
  it("dice el intervalo de confianza y que 0 fallas no prueba 0 %", () => {
    const metrics = {
      ...summarize("sale_proposal", [], { total: 35, sha256: "a".repeat(64) }),
      cases: 35,
      passed: 30,
      called: 30,
      jsonValid: 30,
      category: { checked: 28, correct: 26 },
    };
    const report = evalReport({
      metrics: { ...metrics, gate: evalGate(metrics) },
      results: [],
      provider: "openai_compatible",
      model: "qwen/qwen3.5-9b",
      promptVersion: "sale-proposal@4",
      startedAt: new Date("2026-09-26T12:00:00Z"),
      casesFile: "evals/sale-proposal.jsonl",
    });
    expect(report).toContain("35 de 35 · sha256 `aaaaaaaaaaaaaaaa`");
    // 26/28 = 93 %, Wilson 95 %: 77–99 %.
    expect(report).toContain("26 de 28 (93 %; IC 95 %: 77–99 %)");
    expect(report).toContain("puede llegar a ≈ 10 %");
  });

  it("wilsonInterval", () => {
    expect(wilsonInterval(0, 0)).toBeNull();
    const bounds = wilsonInterval(27, 30)!;
    expect(bounds.low).toBeCloseTo(0.744, 2);
    expect(bounds.high).toBeCloseTo(0.965, 2);
  });
});

describe("formatUsdMicros", () => {
  it("no redondea a 0 lo que costó algo", () => {
    expect(formatUsdMicros(0)).toBe("US$0");
    expect(formatUsdMicros(310)).toBe("US$0.00031");
    expect(formatUsdMicros(1_234_567)).toBe("US$1.23");
  });
});
