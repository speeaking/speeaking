import { AIProviderError } from "@/server/providers/ai/errors";
import type { AIProvider, AIUsage } from "@/server/providers/ai/types";
import { factLines, adCopyInput, allowedClaimsFor } from "../ad-kit/facts";
import { guardAdCopy } from "../ad-kit/guard";
import { availableDeliveryMethods, orderShippingCents } from "@/modules/commerce/checkout-math";
import { type PolicyViolation, policyViolation } from "../content-policy";
import { recordedCost } from "../cost";
import { type ClaimKind, guardProposal } from "../output-guard";
import { redactPersonalData } from "../personal-data";
import {
  suggestedDailyBudgetCents,
  suggestedPriceRange,
  withCodeNumbers,
} from "../proposal-numbers";
import { saleProposalSchema, withoutCostMentions } from "../sale-proposal";
import { adCopyTask } from "../tasks/ad-copy";
import { type CategoryOption, saleProposalTask } from "../tasks/sale-proposal";
import { type AdCopyCase, adKitProductOf, type SaleProposalCase } from "./cases";
import {
  allowedNumbers,
  hasContactOrPayment,
  hasDarkPattern,
  inventedNumbers,
  isSpanish,
  pesos,
  unsupportedClaims,
} from "./validators";

export type EvalTask = "sale_proposal" | "ad_copy";

/** Tarea de `ai.routing` → nombre con que se guarda en `AIEvalRun.task` (el de `AIFeature`). */
export const EVAL_TASK_FEATURE = {
  sale_proposal: "SALE_PROPOSAL",
  ad_copy: "CONTENT_GENERATION",
} as const;

export type CaseResult = {
  id: string;
  passed: boolean;
  /** Motivos en español claro (para el reporte). */
  failures: string[];
  /** Regla de productos que lo bloqueó ANTES de llamar al modelo. */
  blocked: PolicyViolation | null;
  expectedBlocked: PolicyViolation | null;
  /** `null` si no se llamó al modelo. */
  jsonValid: boolean | null;
  providerError: string | null;
  inventedNumbers: string[];
  unsupportedClaims: ClaimKind[];
  urgency: boolean;
  contact: boolean;
  spanish: boolean | null;
  /** Categoría (propuesta) o que el anuncio hable del producto (kit). `null` si no aplica. */
  category: { expected: string[]; got: string | null; correct: boolean } | null;
  guardRemoved: number;
  latencyMs: number | null;
  usage: AIUsage | null;
  costMicros: number;
  costKnown: boolean;
};

export type EvalDeps = {
  provider: AIProvider;
  categories: CategoryOption[];
  /** Reserva presupuesto ANTES de cada llamada; devuelve el id de la solicitud (o `null`). */
  beforeCall?: (caseId: string) => Promise<string | null>;
  /** Registra el resultado de la llamada (costo incluido) en la solicitud reservada. */
  afterCall?: (
    requestId: string | null,
    outcome: {
      ok: boolean;
      output?: unknown;
      usage?: AIUsage;
      latencyMs: number;
      errorCode?: "INVALID_OUTPUT" | "PROVIDER_ERROR";
    },
  ) => Promise<void>;
  now?: () => number;
};

function emptyResult(id: string, expectedBlocked: PolicyViolation | null): CaseResult {
  return {
    id,
    passed: false,
    failures: [],
    blocked: null,
    expectedBlocked,
    jsonValid: null,
    providerError: null,
    inventedNumbers: [],
    unsupportedClaims: [],
    urgency: false,
    contact: false,
    spanish: null,
    category: null,
    guardRemoved: 0,
    latencyMs: null,
    usage: null,
    costMicros: 0,
    costKnown: true,
  };
}

const POLICY_LABEL: Record<PolicyViolation, string> = {
  counterfeit: "réplicas",
  weapons: "armas",
  drugs: "drogas",
  prescription: "medicamentos con receta",
  vapes: "vapeadores",
};

/** Política de productos: se decide por código antes de llamar. Devuelve true si ya terminó. */
function checkPolicy(result: CaseResult, violation: PolicyViolation | null) {
  result.blocked = violation;
  if (!violation && !result.expectedBlocked) return false;
  if (violation && !result.expectedBlocked) {
    result.failures.push(`Se bloqueó sin deber (regla: ${POLICY_LABEL[violation]}).`);
  } else if (!violation && result.expectedBlocked) {
    result.failures.push(`Debió bloquearse (${POLICY_LABEL[result.expectedBlocked]}).`);
  } else if (violation && result.expectedBlocked && violation !== result.expectedBlocked) {
    result.failures.push(
      `Se bloqueó por ${POLICY_LABEL[violation]}; se esperaba ${POLICY_LABEL[result.expectedBlocked]}.`,
    );
  }
  result.passed = result.failures.length === 0;
  return true;
}

async function call<T>(
  deps: EvalDeps,
  result: CaseResult,
  generate: () => Promise<{ output: T; usage: AIUsage }>,
): Promise<T | null> {
  const now = deps.now ?? Date.now;
  const requestId = (await deps.beforeCall?.(result.id)) ?? null;
  const started = now();
  try {
    const { output, usage } = await generate();
    result.latencyMs = now() - started;
    result.usage = usage;
    result.jsonValid = true;
    await deps.afterCall?.(requestId, { ok: true, output, usage, latencyMs: result.latencyMs });
    return output;
  } catch (error) {
    result.latencyMs = now() - started;
    const invalid = error instanceof AIProviderError && error.kind === "invalid_output";
    result.usage = error instanceof AIProviderError ? (error.usage ?? null) : null;
    if (invalid) {
      result.jsonValid = false;
      result.failures.push("El modelo no devolvió JSON válido según el esquema.");
    } else {
      result.providerError = error instanceof AIProviderError ? error.kind : "unknown";
      result.failures.push(`Error del proveedor (${result.providerError}).`);
    }
    await deps.afterCall?.(requestId, {
      ok: false,
      usage: result.usage ?? undefined,
      latencyMs: result.latencyMs,
      errorCode: invalid ? "INVALID_OUTPUT" : "PROVIDER_ERROR",
    });
    return null;
  } finally {
    if (result.usage) {
      const cost = recordedCost(deps.provider.model, result.usage);
      result.costMicros = cost.micros;
      result.costKnown = cost.known;
    }
  }
}

function checkText(
  result: CaseResult,
  {
    all,
    publishable,
    prose,
    allowed,
    productName,
    allowedClaims,
  }: {
    all: string;
    publishable: string;
    prose: string;
    allowed: ReadonlySet<string>;
    productName: string;
    allowedClaims: ReadonlySet<ClaimKind>;
  },
) {
  result.inventedNumbers = inventedNumbers(all, allowed, productName);
  if (result.inventedNumbers.length) {
    result.failures.push(
      `Cifras que no están en los datos (P2): ${result.inventedNumbers.join(", ")}.`,
    );
  }
  result.unsupportedClaims = unsupportedClaims(publishable, productName, allowedClaims);
  if (result.unsupportedClaims.length) {
    result.failures.push(`Afirmaciones sin respaldo (P4): ${result.unsupportedClaims.join(", ")}.`);
  }
  result.urgency = hasDarkPattern(publishable);
  if (result.urgency) result.failures.push("Urgencia o escasez inventada.");
  result.contact = hasContactOrPayment(all);
  if (result.contact) result.failures.push("Datos de contacto, ligas o pago por fuera.");
  result.spanish = isSpanish(prose);
  if (!result.spanish) result.failures.push("El texto no está en español.");
}

/** Evalúa «Vende con IA» caso por caso (salida cruda del modelo + la tubería completa). */
export async function evaluateSaleProposal(
  testCase: SaleProposalCase,
  deps: EvalDeps,
): Promise<CaseResult> {
  const { input, expected } = testCase;
  const result = emptyResult(testCase.id, expected.blocked);
  if (checkPolicy(result, policyViolation(input.productName, input.text))) return result;

  const output = await call(deps, result, () =>
    deps.provider.generate(saleProposalTask, { ...input, categories: deps.categories }),
  );
  if (output) {
    const range = suggestedPriceRange(input.priceCents);
    // Lo que el modelo sí vio: el texto sin costo ni contactos, y las cifras del código.
    const seen = redactPersonalData(
      withoutCostMentions(input.text, {
        costCents: input.costCents,
        quantity: input.quantity,
        priceCents: input.priceCents,
      }),
    );
    const allowed = allowedNumbers([
      pesos(input.priceCents),
      pesos(range.minCents),
      pesos(range.maxCents),
      pesos(suggestedDailyBudgetCents(input)),
      input.quantity,
      15,
      seen,
      input.city,
    ]);
    const publishable = [
      output.headline,
      output.description,
      output.valueProposition,
      ...output.tags,
      ...output.contentIdeas,
      ...output.adIdeas,
      output.videoScript,
      ...output.ctas,
    ].join("\n");
    const advice = [
      ...output.targetAudiences.flatMap((audience) => [audience.name, audience.why]),
      ...output.objections.flatMap((item) => [item.objection, item.answer]),
      output.suggestedPriceRange.rationale,
      output.budgetRationale,
      ...output.assumptions,
    ].join("\n");
    checkText(result, {
      all: `${publishable}\n${advice}`,
      publishable,
      prose: [output.description, output.valueProposition, ...output.adIdeas].join("\n"),
      allowed,
      productName: input.productName,
      // Como el guardián de producción: en lo publicable de la propuesta no hay afirmaciones P4,
      // aunque el vendedor las escriba en su texto (van como datos estructurados en el producto).
      allowedClaims: new Set(),
    });

    const known = new Set(deps.categories.map((category) => category.slug));
    const got = output.categorySlug && known.has(output.categorySlug) ? output.categorySlug : null;
    if (expected.categories.length > 0) {
      const correct = got !== null && expected.categories.includes(got);
      result.category = { expected: expected.categories, got, correct };
      if (!correct) {
        result.failures.push(
          `Categoría «${got ?? "ninguna"}»; se esperaba ${expected.categories.join(" o ")}.`,
        );
      }
    }
    // La tubería de producción (cifras del código + esquema + guardián) debe aceptar la salida.
    const full = saleProposalSchema.safeParse(withCodeNumbers(output, input));
    if (full.success) {
      result.guardRemoved = guardProposal({ ...full.data, categorySlug: got }, input).removed;
    } else {
      result.failures.push("La propuesta completa no cumple el esquema.");
    }
  }
  result.passed = result.failures.length === 0;
  return result;
}

function stripAccents(text: string) {
  return text.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
}

/** Evalúa el kit de anuncios caso por caso. */
export async function evaluateAdCopy(testCase: AdCopyCase, deps: EvalDeps): Promise<CaseResult> {
  const product = adKitProductOf(testCase);
  const result = emptyResult(testCase.id, testCase.expected.blocked);
  const violation = policyViolation(product.title, product.description, product.tags.join(" "));
  if (checkPolicy(result, violation)) return result;

  const input = adCopyInput(product);
  const output = await call(deps, result, () => deps.provider.generate(adCopyTask, input));
  if (output) {
    const { facts } = product;
    const shipping = availableDeliveryMethods([facts]).includes("NATIONAL_SHIPPING")
      ? orderShippingCents("NATIONAL_SHIPPING", [facts])
      : null;
    const allowed = allowedNumbers([
      pesos(product.priceCents),
      shipping === null ? null : pesos(shipping),
      facts.deliveryMinDays,
      facts.deliveryMaxDays,
      facts.warrantyDays,
      facts.returnWindowDays,
      input.description,
      input.tags.join(" "),
      input.city,
      input.state,
      factLines(product).join(" "),
    ]);
    const publishable = [
      output.whatsapp,
      output.facebook,
      output.instagram.caption,
      output.headline,
    ].join("\n");
    checkText(result, {
      all: `${publishable}\n${output.instagram.hashtags.join(" ")}`,
      publishable,
      prose: [output.whatsapp, output.facebook, output.instagram.caption].join("\n"),
      allowed,
      productName: product.title,
      allowedClaims: allowedClaimsFor(product),
    });
    const haystack = stripAccents(publishable);
    const mentions = testCase.expected.mentions;
    const hit = mentions.find((word) => haystack.includes(stripAccents(word))) ?? null;
    result.category = { expected: mentions, got: hit, correct: hit !== null };
    if (!hit) result.failures.push(`El anuncio no menciona el producto (${mentions.join(", ")}).`);
    result.guardRemoved = guardAdCopy(output, product).removed;
  }
  result.passed = result.failures.length === 0;
  return result;
}

/** Umbral para aprobar un modelo en una tarea (ADR-033 #9, ADR-034). */
export const EVAL_GATE = {
  minCases: 25,
  minCategoryAccuracy: 0.9,
} as const;

/** Archivo de casos de la corrida: una corrida parcial (`--limit`) no sirve como evidencia. */
export type EvalSuite = {
  /** Casos en el archivo completo. */
  total: number;
  /** Huella SHA-256 del archivo de casos (para auditar con qué casos se aprobó). */
  sha256: string | null;
};

export type EvalMetrics = {
  version: 1;
  task: EvalTask;
  suite: EvalSuite;
  cases: number;
  passed: number;
  called: number;
  jsonValid: number;
  providerErrors: number;
  inventedNumbersCases: number;
  unsupportedClaimsCases: number;
  urgencyCases: number;
  contactCases: number;
  nonSpanishCases: number;
  category: { checked: number; correct: number };
  policy: { checked: number; correct: number };
  guardRemoved: number;
  latencyMs: { p50: number | null; max: number | null };
  tokens: { input: number; output: number; estimated: boolean };
  costMicros: number;
  costKnown: boolean;
  gate: { approved: boolean; reasons: string[] };
  failures: { id: string; reasons: string[] }[];
};

function median(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[middle]!
    : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

/**
 * Métricas y veredicto de una corrida (código, P2): nada lo decide la IA. `suite` describe el
 * archivo completo de casos; sin él, se asume que la corrida lo cubrió entero.
 */
export function summarize(
  task: EvalTask,
  results: CaseResult[],
  suite: EvalSuite = { total: results.length, sha256: null },
): EvalMetrics {
  const called = results.filter((result) => result.jsonValid !== null || result.providerError);
  const count = (predicate: (result: CaseResult) => boolean) => results.filter(predicate).length;
  const categoryChecked = results.filter((result) => result.category);
  const policyChecked = results.filter((result) => result.blocked || result.expectedBlocked);
  const latencies = results.flatMap((result) =>
    result.latencyMs === null ? [] : [result.latencyMs],
  );

  const metrics: Omit<EvalMetrics, "gate"> = {
    version: 1,
    task,
    suite,
    cases: results.length,
    passed: count((result) => result.passed),
    called: called.length,
    jsonValid: count((result) => result.jsonValid === true),
    providerErrors: count((result) => result.providerError !== null),
    inventedNumbersCases: count((result) => result.inventedNumbers.length > 0),
    unsupportedClaimsCases: count((result) => result.unsupportedClaims.length > 0),
    urgencyCases: count((result) => result.urgency),
    contactCases: count((result) => result.contact),
    nonSpanishCases: count((result) => result.spanish === false),
    category: {
      checked: categoryChecked.length,
      correct: categoryChecked.filter((result) => result.category?.correct).length,
    },
    policy: {
      checked: policyChecked.length,
      correct: policyChecked.filter((result) => result.blocked === result.expectedBlocked).length,
    },
    guardRemoved: results.reduce((sum, result) => sum + result.guardRemoved, 0),
    latencyMs: { p50: median(latencies), max: latencies.length ? Math.max(...latencies) : null },
    tokens: {
      input: results.reduce((sum, result) => sum + (result.usage?.inputTokens ?? 0), 0),
      output: results.reduce((sum, result) => sum + (result.usage?.outputTokens ?? 0), 0),
      estimated: results.some((result) => result.usage?.estimated),
    },
    costMicros: results.reduce((sum, result) => sum + result.costMicros, 0),
    costKnown: results.every((result) => result.costKnown),
    failures: results
      .filter((result) => !result.passed)
      .slice(0, 100)
      .map((result) => ({ id: result.id, reasons: result.failures })),
  };
  return { ...metrics, gate: evalGate(metrics) };
}

/**
 * Veredicto: JSON válido en todos los casos, 0 cifras inventadas (P2), 0 afirmaciones sin respaldo
 * (P4), 0 urgencia, 0 contacto o pago por fuera, todo en español, ≥ 90 % de categoría correcta (o
 * de anuncios que hablan del producto), la política de productos acierta en todos, el archivo de
 * casos COMPLETO (una corrida con `--limit` elige qué casos cuentan) y al menos 25 casos que
 * respondió el modelo sin errores del proveedor (los bloqueados por la política no miden al modelo).
 */
export function evalGate(metrics: Omit<EvalMetrics, "gate">): EvalMetrics["gate"] {
  const reasons: string[] = [];
  const cases = (count: number) => (count === 1 ? "1 caso" : `${count} casos`);
  if (metrics.cases < metrics.suite.total) {
    reasons.push(
      `Corrida parcial: ${cases(metrics.cases)} de ${metrics.suite.total}. Solo cuenta el archivo completo.`,
    );
  }
  const answered = metrics.called - metrics.providerErrors;
  if (answered < EVAL_GATE.minCases) {
    reasons.push(
      `Solo ${cases(answered)} con respuesta del modelo: se necesitan al menos ${EVAL_GATE.minCases}.`,
    );
  }
  if (metrics.providerErrors > 0) {
    reasons.push(`Errores del proveedor en ${cases(metrics.providerErrors)}: repite la corrida.`);
  }
  const invalid = metrics.called - metrics.providerErrors - metrics.jsonValid;
  if (invalid > 0) reasons.push(`JSON inválido en ${cases(invalid)} (debe ser 0).`);
  if (metrics.inventedNumbersCases > 0) {
    reasons.push(`Cifras inventadas en ${cases(metrics.inventedNumbersCases)} (debe ser 0).`);
  }
  if (metrics.unsupportedClaimsCases > 0) {
    reasons.push(
      `Afirmaciones sin respaldo en ${cases(metrics.unsupportedClaimsCases)} (debe ser 0).`,
    );
  }
  if (metrics.urgencyCases > 0) {
    reasons.push(`Urgencia inventada en ${cases(metrics.urgencyCases)} (debe ser 0).`);
  }
  if (metrics.contactCases > 0) {
    reasons.push(`Contacto o pago por fuera en ${cases(metrics.contactCases)} (debe ser 0).`);
  }
  if (metrics.nonSpanishCases > 0) {
    reasons.push(`Texto que no está en español en ${cases(metrics.nonSpanishCases)}.`);
  }
  if (metrics.category.checked > 0) {
    const accuracy = metrics.category.correct / metrics.category.checked;
    if (accuracy < EVAL_GATE.minCategoryAccuracy) {
      reasons.push(
        `Categoría correcta en ${Math.floor(accuracy * 100)} % (mínimo ${EVAL_GATE.minCategoryAccuracy * 100} %).`,
      );
    }
  }
  if (metrics.policy.correct < metrics.policy.checked) {
    reasons.push(
      `La política de productos falló en ${cases(metrics.policy.checked - metrics.policy.correct)}.`,
    );
  }
  return { approved: reasons.length === 0, reasons };
}

/** Corre todos los casos EN SERIE (una reserva de presupuesto a la vez). */
export async function runEval(
  task: EvalTask,
  cases: SaleProposalCase[] | AdCopyCase[],
  deps: EvalDeps,
  suite?: EvalSuite,
): Promise<{ results: CaseResult[]; metrics: EvalMetrics }> {
  const results: CaseResult[] = [];
  for (const testCase of cases) {
    results.push(
      task === "sale_proposal"
        ? await evaluateSaleProposal(testCase as SaleProposalCase, deps)
        : await evaluateAdCopy(testCase as AdCopyCase, deps),
    );
  }
  return { results, metrics: summarize(task, results, suite) };
}
