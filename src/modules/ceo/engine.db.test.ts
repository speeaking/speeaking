import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it, vi } from "vitest";
import type { Prisma } from "@/generated/prisma/client";
import type * as PlatformAggregates from "@/modules/analytics/platform-aggregates";
import { DEFAULT_FEED_POLICY, FEED_POLICY_KEY } from "@/modules/feed/policy";
import { applySettingChange, readFeedPolicySetting } from "@/modules/platform/apply";
import { AUTONOMY_KEY } from "@/modules/platform/autonomy";
import { addDays, type Day, dayRange, dayStart, dayToDbDate } from "@/modules/platform/calendar";
import { assignVariant } from "@/modules/platform/experiments";
import { createPrismaClient } from "@/server/db-client";
import { runAnalyst } from "./analyst";
import { INSUFFICIENT_TRAFFIC_REASON, NOT_VISIBLE_HOLD_REASON } from "./autonomy-policy";
import { parseEvaluation, trailEntry, updateEvaluation } from "./decision-record";
import { evaluateRunningExperiments } from "./experiments";
import { aggregateDailyMetrics } from "./metrics";
import { runGuardrailMonitor } from "./monitor";
import { runDailyPipeline } from "./pipeline";

/**
 * Integración contra la base de desarrollo (`pnpm db:start`). CADA prueba corre dentro de una
 * transacción que se deshace al final: la base compartida (y el feed del servidor de desarrollo)
 * nunca ve estos cambios. Los días son de 2031 para no mezclarse con datos reales.
 */
const { databaseUrl } = await vi.hoisted(async () => {
  const { config } = await import("dotenv");
  const local: Record<string, string | undefined> = {};
  config({ quiet: true, processEnv: local });
  return { databaseUrl: process.env.DATABASE_URL ?? local.DATABASE_URL };
});

// Desde T5 las impresiones del motor son VISIBLES (`FEED_IMPRESSIONS_ARE_VISIBLE` = true). Una prueba
// lo apaga para comprobar que, si volvieran a ser piezas servidas, el umbral nunca se cumpliría.
const visibility = vi.hoisted(() => ({ visible: true }));
vi.mock("@/modules/analytics/platform-aggregates", async (importOriginal) => {
  const original = await importOriginal<typeof PlatformAggregates>();
  return {
    ...original,
    get FEED_IMPRESSIONS_ARE_VISIBLE() {
      return visibility.visible;
    },
  };
});

const db = createPrismaClient(databaseUrl ?? "postgresql://localhost:1/sin-base");

afterAll(async () => {
  await db.$disconnect();
});

class Rollback extends Error {}

/** Corre `fn` en una transacción y la deshace siempre. */
async function inRollback(fn: (tx: Prisma.TransactionClient) => Promise<void>) {
  await expect(
    db.$transaction(
      async (tx) => {
        await fn(tx);
        throw new Rollback("rollback");
      },
      { timeout: 120_000, maxWait: 20_000 },
    ),
  ).rejects.toBeInstanceOf(Rollback);
}

/** Estado limpio dentro de la transacción: política por omisión, sin propuestas ni experimentos. */
async function cleanSlate(tx: Prisma.TransactionClient, mode: "observer" | "low_risk") {
  await tx.platformSetting.upsert({
    where: { key: FEED_POLICY_KEY },
    create: { key: FEED_POLICY_KEY, value: DEFAULT_FEED_POLICY },
    update: { value: DEFAULT_FEED_POLICY },
  });
  await tx.platformSetting.upsert({
    where: { key: AUTONOMY_KEY },
    create: { key: AUTONOMY_KEY, value: { version: 1, mode } },
    update: { value: { version: 1, mode } },
  });
  await tx.experiment.updateMany({
    where: { status: "RUNNING" },
    data: { status: "STOPPED", endedAt: new Date() },
  });
  await tx.platformDecision.updateMany({
    where: { status: { in: ["PROPOSED", "APPLIED", "APPROVED"] } },
    data: { status: "REJECTED" },
  });
}

/** Siembra filas de DailyMetric para días de 2031. */
async function seedMetrics(
  tx: Prisma.TransactionClient,
  days: Day[],
  values: (day: Day) => Record<string, { value: number; sampleSize: number }>,
) {
  const data = days.flatMap((day) =>
    Object.entries(values(day)).map(([key, row]) => ({
      day: dayToDbDate(day),
      key,
      dimension: "",
      value: row.value,
      sampleSize: row.sampleSize,
    })),
  );
  await tx.dailyMetric.deleteMany({
    where: { day: { in: [...new Set(days)].map(dayToDbDate) }, dimension: "" },
  });
  await tx.dailyMetric.createMany({ data });
}

const DAY: Day = "2031-03-10";
/** Mediodía del día siguiente en la Ciudad de México. */
const NOW = new Date(dayStart(addDays(DAY, 1)).getTime() + 12 * 60 * 60 * 1000);

/** Impresiones diarias, todas de personas con sesión (20 por persona): las que cuenta el umbral. */
function traffic(perDay: number) {
  return {
    "feed.impressions.visible": { value: perDay, sampleSize: perDay },
    "feed.impressions.per_viewer": { value: 20, sampleSize: perDay / 20 },
  };
}

/** Interacción: 8 % en la línea base y 6 % la última semana, con `perDay` impresiones diarias. */
function engagementDrop(perDay: number) {
  return (day: Day) => ({
    ...traffic(perDay),
    "feed.engagement.rate": {
      value: day > addDays(DAY, -7) ? 0.06 : 0.08,
      sampleSize: perDay,
    },
  });
}

const HISTORY = dayRange(addDays(DAY, -34), DAY);

describe("métricas diarias", { timeout: 90_000 }, () => {
  it("calcula e idempotente; lo anónimo no entra en las métricas con las que se decide", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "observer");
      const viewer = randomUUID();
      const other = randomUUID();
      const at = new Date(dayStart(DAY).getTime() + 3 * 60 * 60 * 1000);
      const impressions = [
        ...Array.from({ length: 6 }, () => ({ userId: viewer, slot: "content" })),
        ...Array.from({ length: 3 }, () => ({ userId: other, slot: "commerce" })),
        // Un robot sin cuenta inunda impresiones comerciales: solo la métrica descriptiva lo ve.
        ...Array.from({ length: 40 }, () => ({ userId: null, slot: "commerce" })),
      ];
      await tx.analyticsEvent.createMany({
        data: [
          ...impressions.map((item) => ({
            type: "VISIBLE_IMPRESSION" as const,
            userId: item.userId,
            entityType: "POST" as const,
            entityId: randomUUID(),
            surface: "FEED" as const,
            metadata: { slot: item.slot },
            createdAt: at,
          })),
          // Piezas SERVIDAS (se vieron o no): 25, una métrica aparte que no entra en las tasas.
          ...Array.from({ length: 25 }, (_, index) => ({
            type: "IMPRESSION" as const,
            userId: index % 2 === 0 ? viewer : null,
            entityType: "POST" as const,
            entityId: randomUUID(),
            surface: "FEED" as const,
            metadata: { slot: index % 4 === 0 ? "commerce" : "content" },
            createdAt: at,
          })),
          {
            type: "NOT_INTERESTED" as const,
            userId: viewer,
            entityType: "POST" as const,
            entityId: randomUUID(),
            surface: "FEED" as const,
            createdAt: at,
          },
          // Anónimos (sin sesión o sin personalización): no entran en las tasas.
          ...Array.from({ length: 5 }, () => ({
            type: "NOT_INTERESTED" as const,
            userId: null,
            entityType: "POST" as const,
            entityId: randomUUID(),
            surface: "FEED" as const,
            createdAt: at,
          })),
          ...Array.from({ length: 7 }, () => ({
            type: "PRODUCT_VIEW" as const,
            userId: null,
            entityType: "PRODUCT" as const,
            entityId: randomUUID(),
            sourcePostId: randomUUID(),
            surface: "FEED" as const,
            createdAt: at,
          })),
          // Una visita con sesión desde una liga compartida: cuenta para las visitas por vendedor
          // activo (cualquier origen), no para las visitas desde el feed.
          {
            type: "PRODUCT_VIEW" as const,
            userId: viewer,
            entityType: "PRODUCT" as const,
            entityId: randomUUID(),
            surface: "SHARE_LINK" as const,
            createdAt: at,
          },
          // Del día siguiente: no cuenta.
          {
            type: "VISIBLE_IMPRESSION" as const,
            userId: viewer,
            entityType: "POST" as const,
            entityId: randomUUID(),
            surface: "FEED" as const,
            metadata: { slot: "content" },
            createdAt: dayStart(addDays(DAY, 1)),
          },
        ],
      });

      const first = await aggregateDailyMetrics(tx, DAY, NOW);
      const second = await aggregateDailyMetrics(tx, DAY, NOW);
      expect(second.rows).toBe(first.rows);
      const rows = await tx.dailyMetric.findMany({
        where: { day: dayToDbDate(DAY), dimension: "" },
        select: { key: true, value: true, sampleSize: true },
      });
      const byKey = new Map(rows.map((row) => [row.key, row]));
      expect(rows).toHaveLength(first.rows);
      // Solo personas con sesión: las 40 anónimas quedan en su métrica descriptiva.
      expect(byKey.get("feed.impressions.visible")).toMatchObject({ value: 9, sampleSize: 9 });
      expect(byKey.get("feed.impressions.visible.anonymous")).toMatchObject({
        value: 40,
        sampleSize: 40,
      });
      expect(byKey.get("feed.impressions.served")).toMatchObject({ value: 25, sampleSize: 25 });
      expect(byKey.get("feed.impressions.commerce")?.value).toBe(3);
      // Comercio visto y tasas: sobre las VISIBLES con sesión, nunca sobre las servidas ni las
      // anónimas (con ellas, el robot habría llevado el comercio visto a 43 ÷ 49 ≈ 88 % y forzado una
      // reversión).
      expect(byKey.get("feed.commerce.share")).toMatchObject({ value: 3 / 9, sampleSize: 9 });
      expect(byKey.get("feed.viewers")?.value).toBe(2);
      // Umbral de tráfico: impresiones visibles con persona (9) ÷ personas (2).
      expect(byKey.get("feed.impressions.per_viewer")).toMatchObject({ value: 4.5, sampleSize: 2 });
      // Numeradores también solo de esas personas: 1 «No me interesa» (no 6) y 0 visitas (no 7).
      expect(byKey.get("not_interested.per_1k_impressions")?.value).toBeCloseTo(1000 / 9);
      expect(byKey.get("feed.product_visits")?.value).toBe(0);
      expect(byKey.get("feed.commerce.ctr")?.value).toBe(0);
      // Visitas por vendedor activo: solo la visita con sesión (1), nunca las 7 anónimas.
      const sellers = byKey.get("sellers.active")?.value ?? 0;
      expect(byKey.get("product.visits.per_active_seller")).toMatchObject({
        value: sellers > 0 ? 1 / sellers : 0,
        sampleSize: sellers,
      });
      // Las descriptivas sí cuentan todo.
      expect(byKey.get("not_interested.count")?.value).toBe(6);
      expect(byKey.get("product.visits")?.value).toBe(8);
      expect(byKey.has("errors.5xx.rate")).toBe(false);
    });
  });

  it("no calcula días que aún no empiezan", async () => {
    await expect(aggregateDailyMetrics(db, "2099-01-01", NOW)).rejects.toThrow(RangeError);
  });
});

describe("analista y autonomía", { timeout: 90_000 }, () => {
  it("modo riesgo bajo con umbral cumplido: aplica solo el cambio de riesgo bajo", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      await seedMetrics(tx, HISTORY, engagementDrop(8_000));

      const summary = await runAnalyst(tx, DAY, { now: NOW });
      expect(summary).toMatchObject({ proposed: 1, applied: 1, held: 0 });

      const decision = await tx.platformDecision.findFirstOrThrow({
        where: {
          kind: "analyst.engagement_drop",
          evaluation: { path: ["analysis", "day"], equals: DAY },
        },
      });
      expect(decision).toMatchObject({
        actor: "AI",
        status: "APPLIED",
        autoApplied: true,
        riskLevel: "LOW",
        settingKey: "feed.policy.recencyHalfLifeHours",
        previousValue: 36,
        newValue: 28.8,
        approvedById: null,
      });
      expect(parseEvaluation(decision.evaluation).trail.map((entry) => entry.action)).toEqual([
        "proposed",
        "auto_applied",
      ]);
      const { policy } = await readFeedPolicySetting(tx);
      expect(policy.recencyHalfLifeHours).toBe(28.8);
      const setting = await tx.platformSetting.findUniqueOrThrow({
        where: { key: FEED_POLICY_KEY },
      });
      expect(setting.updatedBy).toBe("SYSTEM");

      // Idempotente: correrlo otra vez el mismo día no duplica.
      const again = await runAnalyst(tx, DAY, { now: NOW });
      expect(again).toMatchObject({ proposed: 0, applied: 0 });
    });
  });

  it("sin tráfico suficiente se queda propuesta con el motivo exacto", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      await seedMetrics(tx, HISTORY, engagementDrop(500));
      const summary = await runAnalyst(tx, DAY, { now: NOW });
      expect(summary).toMatchObject({ proposed: 1, applied: 0, held: 1 });
      const decision = await tx.platformDecision.findFirstOrThrow({
        where: {
          kind: "analyst.engagement_drop",
          evaluation: { path: ["analysis", "day"], equals: DAY },
        },
      });
      expect(decision.status).toBe("PROPOSED");
      expect(decision.reason).toBe(INSUFFICIENT_TRAFFIC_REASON);
      expect((await readFeedPolicySetting(tx)).policy.recencyHalfLifeHours).toBe(36);
    });
  });

  it("si las impresiones no fueran visibles, nada se aplicaría solo aunque sobre tráfico", async () => {
    visibility.visible = false;
    try {
      await inRollback(async (tx) => {
        await cleanSlate(tx, "low_risk");
        await seedMetrics(tx, HISTORY, engagementDrop(8_000));
        const summary = await runAnalyst(tx, DAY, { now: NOW });
        expect(summary).toMatchObject({ proposed: 1, applied: 0, held: 1 });
        const decision = await tx.platformDecision.findFirstOrThrow({
          where: {
            kind: "analyst.engagement_drop",
            evaluation: { path: ["analysis", "day"], equals: DAY },
          },
        });
        expect(decision.status).toBe("PROPOSED");
        expect(decision.reason).toBe(NOT_VISIBLE_HOLD_REASON);
        const threshold = parseEvaluation(decision.evaluation).threshold as { reason: string };
        expect(threshold.reason).toMatch(/impresiones visibles/);
        expect((await readFeedPolicySetting(tx)).policy.recencyHalfLifeHours).toBe(36);
      });
    } finally {
      visibility.visible = true;
    }
  });

  it("el tráfico anónimo no cuenta para el umbral", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      // 8,000 impresiones visibles al día, pero solo 500 de personas con sesión: las otras 7,500
      // (anónimas, p. ej. un robot) quedan en su métrica descriptiva y no cumplen el umbral.
      await seedMetrics(tx, HISTORY, (day) => ({
        ...engagementDrop(500)(day),
        "feed.impressions.visible.anonymous": { value: 7_500, sampleSize: 7_500 },
      }));
      const summary = await runAnalyst(tx, DAY, { now: NOW });
      expect(summary).toMatchObject({ proposed: 1, applied: 0, held: 1 });
      expect((await readFeedPolicySetting(tx)).policy.recencyHalfLifeHours).toBe(36);
    });
  });

  it("no vuelve a proponer al día siguiente lo que el equipo acaba de rechazar", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "observer");
      const nextDay = addDays(DAY, 1);
      await seedMetrics(tx, [...HISTORY, nextDay], engagementDrop(8_000));
      expect(await runAnalyst(tx, DAY, { now: NOW })).toMatchObject({ proposed: 1 });
      await tx.platformDecision.updateMany({
        where: { kind: "analyst.engagement_drop", status: "PROPOSED" },
        data: { status: "REJECTED", decidedAt: NOW },
      });
      const tomorrow = new Date(NOW.getTime() + 86_400_000);
      expect(await runAnalyst(tx, nextDay, { now: tomorrow })).toMatchObject({
        candidates: 1,
        proposed: 0,
        skipped: 1,
      });
    });
  });

  it("en modo observador solo propone", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "observer");
      await seedMetrics(tx, HISTORY, engagementDrop(8_000));
      const summary = await runAnalyst(tx, DAY, { now: NOW });
      expect(summary).toMatchObject({ proposed: 1, applied: 0, held: 1 });
      expect((await readFeedPolicySetting(tx)).policy.recencyHalfLifeHours).toBe(36);
    });
  });

  it("un cambio de riesgo medio nunca se aplica directo: se prueba al 10 %", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      await seedMetrics(tx, HISTORY, (day) => ({
        ...traffic(40_000),
        "feed.commerce.ctr": { value: day > addDays(DAY, -7) ? 0.015 : 0.02, sampleSize: 10_000 },
      }));
      const summary = await runAnalyst(tx, DAY, { now: NOW });
      expect(summary).toMatchObject({ proposed: 1, experiments: 1, applied: 0 });
      const experiment = await tx.experiment.findFirstOrThrow({
        where: { settingKey: "feed.policy.commerceSlotEvery", status: "RUNNING" },
        include: { decision: true },
      });
      expect(experiment.allocation).toBe(0.1);
      expect(experiment.variants).toEqual({ control: 4, treatment: 5 });
      expect(experiment.decision?.status).toBe("APPROVED");
      // La política global no cambió: solo el 10 % ve el tratamiento.
      expect((await readFeedPolicySetting(tx)).policy.commerceSlotEvery).toBe(4);
      // Adoptarlo sin la evidencia de un experimento concluido está prohibido, incluso para el sistema.
      const direct = await tx.platformDecision.create({
        data: {
          actor: "AI",
          kind: "test.direct",
          title: "Directo",
          hypothesis: "Prueba",
          settingKey: "feed.policy.commerceSlotEvery",
          previousValue: 4,
          newValue: 5,
          riskLevel: "MEDIUM",
        },
      });
      const result = await applySettingChange(tx, {
        decisionId: direct.id,
        actor: "SYSTEM",
        auto: true,
        reason: "prueba",
        now: NOW,
        trail: (current) => updateEvaluation(current, {}),
      });
      expect(result).toMatchObject({ ok: false, code: "NEEDS_HUMAN" });
    });
  });

  it("pagos y gasto no se aplican ni con aprobación humana", async () => {
    await inRollback(async (tx) => {
      const decision = await tx.platformDecision.create({
        data: {
          actor: "HUMAN",
          kind: "test.fees",
          title: "Comisión",
          hypothesis: "Prueba",
          settingKey: "commerce.fees.platformFeeBps",
          previousValue: 0,
          newValue: 500,
          riskLevel: "HIGH",
        },
      });
      const result = await applySettingChange(tx, {
        decisionId: decision.id,
        actor: "HUMAN",
        userId: randomUUID(),
        reason: "prueba",
        now: NOW,
        trail: (current) => updateEvaluation(current, {}),
      });
      expect(result).toMatchObject({ ok: false, code: "FORBIDDEN" });
    });
  });
});

describe("monitor de salvaguardas", { timeout: 90_000 }, () => {
  it("revierte solo cuando una salvaguarda se rompe tras la exposición mínima", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      await seedMetrics(tx, HISTORY, engagementDrop(8_000));
      await runAnalyst(tx, DAY, { now: NOW });
      const applied = await tx.platformDecision.findFirstOrThrow({
        where: { kind: "analyst.engagement_drop", status: "APPLIED" },
      });
      const appliedDay = addDays(DAY, 1);
      // Línea base (7 días antes del cambio) sana; después, los reportes se duplican (significativo).
      const days = dayRange(addDays(appliedDay, -7), addDays(appliedDay, 3));
      await seedMetrics(tx, days, (day) => ({
        "feed.impressions.visible": { value: 8_000, sampleSize: 8_000 },
        "reports.per_1k_impressions": { value: day > appliedDay ? 2 : 1, sampleSize: 8_000 },
      }));

      const later = new Date(dayStart(addDays(appliedDay, 4)).getTime() + 12 * 60 * 60 * 1000);
      const summary = await runGuardrailMonitor(tx, later);
      expect(summary.reverted).toBe(1);
      const reverted = await tx.platformDecision.findUniqueOrThrow({ where: { id: applied.id } });
      expect(reverted.status).toBe("REVERTED");
      expect(reverted.reason).toMatch(
        /^Salvaguarda rota\. Reportes por mil impresiones: subió 100 % \(rebasa el límite de 25 %; p = 0\.0\d{3}\)/,
      );
      expect(parseEvaluation(reverted.evaluation).trail.at(-1)?.action).toBe("auto_reverted");
      expect((await readFeedPolicySetting(tx)).policy.recencyHalfLifeHours).toBe(36);
      // Ya no se vigila: una segunda pasada no hace nada.
      expect((await runGuardrailMonitor(tx, later)).reverted).toBe(0);
    });
  });

  it("no revierte por ruido: +30 % con pocos reportes no es significativo", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      await seedMetrics(tx, HISTORY, engagementDrop(8_000));
      await runAnalyst(tx, DAY, { now: NOW });
      const appliedDay = addDays(DAY, 1);
      const days = dayRange(addDays(appliedDay, -7), addDays(appliedDay, 3));
      await seedMetrics(tx, days, (day) => ({
        "feed.impressions.visible": { value: 2_000, sampleSize: 2_000 },
        "reports.per_1k_impressions": { value: day > appliedDay ? 1.3 : 1, sampleSize: 2_000 },
      }));
      const later = new Date(dayStart(addDays(appliedDay, 4)).getTime() + 12 * 60 * 60 * 1000);
      const summary = await runGuardrailMonitor(tx, later);
      expect(summary).toMatchObject({ watched: 1, reverted: 0, pending: 0 });
      const decision = await tx.platformDecision.findFirstOrThrow({
        where: { kind: "analyst.engagement_drop", status: "APPLIED" },
      });
      const guardrails = parseEvaluation(decision.evaluation).guardrails as {
        final?: boolean;
        checks: { metric: string; verdict: string }[];
      };
      expect(guardrails.final).not.toBe(true);
      expect(
        guardrails.checks.find((check) => check.metric === "reports.per_1k_impressions")?.verdict,
      ).toBe("not_significant");
    });
  });

  it("sin datos suficientes deja de vigilar al cumplirse la ventana máxima (sin evidencia de daño)", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      await seedMetrics(tx, HISTORY, engagementDrop(8_000));
      await runAnalyst(tx, DAY, { now: NOW });
      const appliedDay = addDays(DAY, 1);
      // 28 días con 100 impresiones visibles: nunca se junta la exposición mínima (5,000).
      await seedMetrics(tx, dayRange(addDays(appliedDay, 1), addDays(appliedDay, 28)), () => ({
        "feed.impressions.visible": { value: 100, sampleSize: 100 },
        "reports.per_1k_impressions": { value: 10, sampleSize: 100 },
      }));
      const atDay = (offset: number) =>
        new Date(dayStart(addDays(appliedDay, offset)).getTime() + 12 * 60 * 60 * 1000);

      expect(await runGuardrailMonitor(tx, atDay(20))).toMatchObject({
        watched: 1,
        pending: 1,
        closedWithoutEvidence: 0,
      });
      expect(await runGuardrailMonitor(tx, atDay(29))).toMatchObject({
        watched: 1,
        reverted: 0,
        closedWithoutEvidence: 1,
      });
      const decision = await tx.platformDecision.findFirstOrThrow({
        where: { kind: "analyst.engagement_drop" },
      });
      expect(decision.status).toBe("APPLIED");
      const evaluation = parseEvaluation(decision.evaluation);
      expect(evaluation.guardrails).toMatchObject({ final: true, conclusion: "no_evidence" });
      expect(evaluation.trail.at(-1)).toMatchObject({ action: "monitor_closed", actor: "SYSTEM" });
      expect(evaluation.trail.at(-1)?.note).toMatch(/sin evidencia de daño con esta muestra/);
      // Ya no se vigila.
      expect((await runGuardrailMonitor(tx, atDay(30))).watched).toBe(0);
    });
  });

  it("sin la exposición mínima no decide todavía", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "low_risk");
      await seedMetrics(tx, HISTORY, engagementDrop(8_000));
      await runAnalyst(tx, DAY, { now: NOW });
      const appliedDay = addDays(DAY, 1);
      await seedMetrics(tx, [addDays(appliedDay, 1)], () => ({
        "feed.impressions.visible": { value: 1_000, sampleSize: 1_000 },
        "reports.per_1k_impressions": { value: 5, sampleSize: 1_000 },
      }));
      const later = new Date(dayStart(addDays(appliedDay, 2)).getTime() + 60 * 60 * 1000);
      const summary = await runGuardrailMonitor(tx, later);
      expect(summary).toMatchObject({ reverted: 0, pending: 1 });
    });
  });
});

/**
 * Personas con actividad del feed durante un experimento: exactamente 60 en el tratamiento y 240 en
 * control (se eligen con la misma asignación por hash), 40 impresiones cada una (1 de cada 5
 * comercial) y las visitas y «No me interesa» indicados por persona.
 */
async function seedExperimentActivity(
  tx: Prisma.TransactionClient,
  experimentKey: string,
  since: Date,
  perPerson: {
    treatmentVisits: number;
    controlVisits: number;
    treatmentNotInterested?: number;
    controlNotInterested?: number;
  },
) {
  const people: { userId: string; treatment: boolean }[] = [];
  let treatments = 0;
  let controls = 0;
  while (treatments < 60 || controls < 240) {
    const userId = randomUUID();
    const treatment = assignVariant(experimentKey, userId, 0.1) === "treatment";
    if (treatment && treatments < 60) {
      treatments++;
      people.push({ userId, treatment });
    } else if (!treatment && controls < 240) {
      controls++;
      people.push({ userId, treatment });
    }
  }
  const at = new Date(since.getTime() + 60 * 60 * 1000);
  const data: Prisma.AnalyticsEventCreateManyInput[] = [];
  const add = (count: number, event: Omit<Prisma.AnalyticsEventCreateManyInput, "createdAt">) => {
    for (let i = 0; i < count; i++) data.push({ ...event, entityId: randomUUID(), createdAt: at });
  };
  for (const { userId, treatment } of people) {
    for (let i = 0; i < 40; i++) {
      data.push({
        type: "VISIBLE_IMPRESSION",
        userId,
        entityType: "POST",
        entityId: randomUUID(),
        surface: "FEED",
        metadata: { slot: i % 5 === 0 ? "commerce" : "content" },
        createdAt: at,
      });
    }
    add(treatment ? perPerson.treatmentVisits : perPerson.controlVisits, {
      type: "PRODUCT_VIEW",
      userId,
      entityType: "PRODUCT",
      sourcePostId: randomUUID(),
      surface: "FEED",
    });
    add(
      treatment ? (perPerson.treatmentNotInterested ?? 0) : (perPerson.controlNotInterested ?? 0),
      { type: "NOT_INTERESTED", userId, entityType: "POST", surface: "FEED" },
    );
  }
  await tx.analyticsEvent.createMany({ data });
}

async function startCommerceExperiment(tx: Prisma.TransactionClient) {
  await cleanSlate(tx, "low_risk");
  await seedMetrics(tx, HISTORY, (day) => ({
    ...traffic(40_000),
    "feed.commerce.ctr": { value: day > addDays(DAY, -7) ? 0.015 : 0.02, sampleSize: 10_000 },
  }));
  await runAnalyst(tx, DAY, { now: NOW });
  const experiment = await tx.experiment.findFirstOrThrow({
    where: { settingKey: "feed.policy.commerceSlotEvery", status: "RUNNING" },
  });
  // Muestra mínima chica para poder concluir en la prueba.
  await tx.experiment.update({ where: { id: experiment.id }, data: { minSamplePerVariant: 500 } });
  return experiment;
}

describe("experimentos", { timeout: 90_000 }, () => {
  it("concluye con evidencia y PROPONE adoptar; adoptarlo requiere a una persona", async () => {
    await inRollback(async (tx) => {
      const experiment = await startCommerceExperiment(tx);
      await seedExperimentActivity(tx, experiment.key, NOW, {
        treatmentVisits: 4,
        controlVisits: 1,
      });
      const later = new Date(NOW.getTime() + 2 * 86_400_000);
      const summary = await evaluateRunningExperiments(tx, later);
      expect(summary).toMatchObject({ concluded: 1, adoptionsProposed: 1 });

      const concluded = await tx.experiment.findUniqueOrThrow({ where: { id: experiment.id } });
      expect(concluded.status).toBe("CONCLUDED");
      expect((concluded.result as { verdict: string }).verdict).toBe("adopt");
      const adoption = await tx.platformDecision.findFirstOrThrow({
        where: { experimentId: experiment.id, kind: "experiment.adopt" },
      });
      expect(adoption).toMatchObject({ status: "PROPOSED", riskLevel: "MEDIUM", newValue: 5 });

      const bySystem = await applySettingChange(tx, {
        decisionId: adoption.id,
        actor: "SYSTEM",
        auto: true,
        reason: "prueba",
        now: later,
        trail: (current) => updateEvaluation(current, {}),
      });
      expect(bySystem).toMatchObject({ ok: false, code: "NEEDS_HUMAN" });

      const admin = randomUUID();
      const byHuman = await applySettingChange(tx, {
        decisionId: adoption.id,
        actor: "HUMAN",
        userId: null,
        reason: "Adoptada por el equipo",
        now: later,
        trail: (current) =>
          updateEvaluation(current, {
            trail: [trailEntry("applied", "HUMAN", later, { userId: admin })],
          }),
      });
      expect(byHuman.ok).toBe(true);
      expect((await readFeedPolicySetting(tx)).policy.commerceSlotEvery).toBe(5);
    });
  });

  it("se detiene solo si el tratamiento rompe una salvaguarda", async () => {
    await inRollback(async (tx) => {
      const experiment = await startCommerceExperiment(tx);
      await seedExperimentActivity(tx, experiment.key, NOW, {
        treatmentVisits: 1,
        controlVisits: 1,
        treatmentNotInterested: 3,
        controlNotInterested: 1,
      });
      const summary = await evaluateRunningExperiments(tx, new Date(NOW.getTime() + 86_400_000));
      expect(summary.stopped).toBe(1);
      const stopped = await tx.experiment.findUniqueOrThrow({
        where: { id: experiment.id },
        include: { decision: true },
      });
      expect(stopped.status).toBe("STOPPED");
      expect(stopped.decision?.status).toBe("REVERTED");
      expect((await readFeedPolicySetting(tx)).policy.commerceSlotEvery).toBe(4);
    });
  });

  it("si el ajuste cambia mientras corre (p. ej. una reversión), se detiene: su control ya no es el vigente", async () => {
    await inRollback(async (tx) => {
      const experiment = await startCommerceExperiment(tx);
      // El valor vigente vuelve a 3 (como al revertir una adopción anterior): control 4 ya no aplica.
      await tx.platformSetting.update({
        where: { key: FEED_POLICY_KEY },
        data: { value: { ...DEFAULT_FEED_POLICY, commerceSlotEvery: 3 } },
      });
      const summary = await evaluateRunningExperiments(tx, new Date(NOW.getTime() + 86_400_000));
      expect(summary.stopped).toBe(1);
      const stopped = await tx.experiment.findUniqueOrThrow({
        where: { id: experiment.id },
        include: { decision: true },
      });
      expect(stopped.status).toBe("STOPPED");
      expect((stopped.result as { verdict: string }).verdict).toBe("stopped_stale");
      expect(stopped.decision?.status).toBe("REVERTED");
    });
  });
});

describe("operación diaria", { timeout: 90_000 }, () => {
  it("registra cada paso en JobRun y omite una ejecución encimada", async () => {
    await inRollback(async (tx) => {
      await cleanSlate(tx, "observer");
      const expire = vi.fn(async () => undefined);
      const cleanup = vi.fn(async () => ({ deleted: 0, failedFiles: [] }));
      const redact = vi.fn(async () => 0);
      const oldNotifications = vi.fn(async () => 3);
      const editorial = vi.fn(async () => ({ created: 2 }));
      const summary = await runDailyPipeline({
        client: tx,
        now: NOW,
        expireStaleCheckouts: expire,
        deleteOrphanMedia: cleanup,
        redactExpiredAiInputs: redact,
        deleteOldNotifications: oldNotifications,
        draftEditorialPosts: editorial,
      });
      expect(summary.skipped).toBe(false);
      expect(summary.day).toBe(DAY);
      for (const step of [
        "daily-metrics",
        "experiments",
        "guardrails",
        "analyst",
        "expire-checkouts",
        "orphan-media",
        "ai-input-redaction",
        "notifications-retention",
        "editorial-drafts",
      ] as const) {
        expect(summary.steps[step]?.ok).toBe(true);
      }
      const runs = await tx.jobRun.findMany({
        where: { startedAt: { gte: new Date(Date.now() - 5 * 60_000) } },
        select: { job: true, status: true },
      });
      expect(
        runs.filter((run) => run.job === "daily-metrics" && run.status === "SUCCEEDED"),
      ).not.toHaveLength(0);
      expect(runs.find((run) => run.job === "ops-daily")?.status).toBe("SUCCEEDED");
      expect(redact).toHaveBeenCalledWith(NOW, 500);
      // Avisos de más de 90 días (ADR-059).
      expect(oldNotifications).toHaveBeenCalledWith(NOW);
      expect(summary.steps["notifications-retention"]).toEqual({
        ok: true,
        summary: { deleted: 3 },
      });

      // Borradores de la redacción (ADR-066): al final y con el resumen del servicio.
      expect(editorial).toHaveBeenCalledWith(NOW);
      expect(summary.steps["editorial-drafts"]).toEqual({ ok: true, summary: { created: 2 } });

      // Otra ejecución mientras una sigue RUNNING se registra como omitida.
      await tx.jobRun.create({ data: { job: "ops-daily", startedAt: NOW } });
      const overlapping = await runDailyPipeline({ client: tx, now: NOW });
      expect(overlapping.skipped).toBe(true);
    });
  });
});
