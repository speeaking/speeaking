-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('USER', 'ADMIN');

-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('VISIBLE', 'HIDDEN');

-- CreateEnum
CREATE TYPE "ExperimentStatus" AS ENUM ('DRAFT', 'RUNNING', 'STOPPED', 'CONCLUDED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('RUNNING', 'SUCCEEDED', 'FAILED');

-- CreateEnum
CREATE TYPE "ReportTargetType" AS ENUM ('POST', 'PRODUCT', 'USER', 'COMMENT');

-- CreateEnum
CREATE TYPE "ReportReason" AS ENUM ('COUNTERFEIT', 'SCAM', 'PROHIBITED', 'SPAM', 'OFFENSIVE', 'OTHER');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('OPEN', 'ACTIONED', 'DISMISSED');

-- CreateEnum
CREATE TYPE "AuthenticityStatus" AS ENUM ('AUTO_CLEAR', 'NEEDS_PROOF', 'PROOF_SUBMITTED', 'VERIFIED_BY_ADMIN', 'REJECTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AIFeature" ADD VALUE 'AUTHENTICITY_REVIEW';
ALTER TYPE "AIFeature" ADD VALUE 'MODEL_EVALUATION';

-- AlterEnum
ALTER TYPE "AnalyticsEventType" ADD VALUE 'EXPERIMENT_EXPOSURE';

-- AlterTable
ALTER TABLE "platform_decisions" ADD COLUMN     "approvedById" UUID,
ADD COLUMN     "autoApplied" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "evaluation" JSONB,
ADD COLUMN     "experimentId" UUID,
ADD COLUMN     "guardrails" JSONB,
ADD COLUMN     "reason" TEXT;

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "moderatedAt" TIMESTAMPTZ(3),
ADD COLUMN     "moderationStatus" "ModerationStatus" NOT NULL DEFAULT 'VISIBLE';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "role" "UserRole" NOT NULL DEFAULT 'USER';

-- CreateTable
CREATE TABLE "experiments" (
    "id" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "settingKey" VARCHAR(100) NOT NULL,
    "hypothesis" TEXT NOT NULL,
    "status" "ExperimentStatus" NOT NULL DEFAULT 'DRAFT',
    "variants" JSONB NOT NULL,
    "allocation" DOUBLE PRECISION NOT NULL,
    "minSamplePerVariant" INTEGER NOT NULL,
    "primaryMetric" VARCHAR(100) NOT NULL,
    "guardrails" JSONB NOT NULL,
    "startedAt" TIMESTAMPTZ(3),
    "endedAt" TIMESTAMPTZ(3),
    "result" JSONB,
    "decisionId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "experiments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_metrics" (
    "id" UUID NOT NULL,
    "day" DATE NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "dimension" VARCHAR(200) NOT NULL DEFAULT '',
    "value" DOUBLE PRECISION NOT NULL,
    "sampleSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "daily_metrics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" UUID NOT NULL,
    "job" VARCHAR(60) NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'RUNNING',
    "startedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMPTZ(3),
    "summary" JSONB,
    "error" TEXT,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" UUID NOT NULL,
    "reporterId" UUID,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "reason" "ReportReason" NOT NULL,
    "details" VARCHAR(1000),
    "status" "ReportStatus" NOT NULL DEFAULT 'OPEN',
    "resolvedById" UUID,
    "resolvedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "authenticity_checks" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "riskLevel" "RiskLevel" NOT NULL,
    "score" DOUBLE PRECISION NOT NULL,
    "signals" JSONB NOT NULL,
    "rulesVersion" VARCHAR(40) NOT NULL DEFAULT 'v1',
    "aiSignal" JSONB,
    "status" "AuthenticityStatus" NOT NULL,
    "proofMediaIds" UUID[] DEFAULT ARRAY[]::UUID[],
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "reviewNote" VARCHAR(500),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "authenticity_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_eval_runs" (
    "id" UUID NOT NULL,
    "provider" VARCHAR(60) NOT NULL,
    "model" VARCHAR(128) NOT NULL,
    "promptVersion" VARCHAR(60) NOT NULL,
    "task" VARCHAR(60) NOT NULL,
    "cases" INTEGER NOT NULL,
    "passed" INTEGER NOT NULL,
    "metrics" JSONB NOT NULL,
    "costMicrosUsd" INTEGER NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_eval_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "experiments_key_key" ON "experiments"("key");

-- CreateIndex
CREATE UNIQUE INDEX "experiments_decisionId_key" ON "experiments"("decisionId");

-- CreateIndex
CREATE INDEX "experiments_status_settingKey_idx" ON "experiments"("status", "settingKey");

-- CreateIndex
CREATE INDEX "daily_metrics_key_day_idx" ON "daily_metrics"("key", "day");

-- CreateIndex
CREATE UNIQUE INDEX "daily_metrics_day_key_dimension_key" ON "daily_metrics"("day", "key", "dimension");

-- CreateIndex
CREATE INDEX "job_runs_job_startedAt_idx" ON "job_runs"("job", "startedAt" DESC);

-- CreateIndex
CREATE INDEX "job_runs_status_startedAt_idx" ON "job_runs"("status", "startedAt");

-- CreateIndex
CREATE INDEX "reports_status_createdAt_idx" ON "reports"("status", "createdAt");

-- CreateIndex
CREATE INDEX "reports_targetType_targetId_status_idx" ON "reports"("targetType", "targetId", "status");

-- CreateIndex
CREATE INDEX "reports_resolvedById_idx" ON "reports"("resolvedById");

-- CreateIndex
CREATE UNIQUE INDEX "reports_reporterId_targetType_targetId_key" ON "reports"("reporterId", "targetType", "targetId");

-- CreateIndex
CREATE UNIQUE INDEX "authenticity_checks_productId_key" ON "authenticity_checks"("productId");

-- CreateIndex
CREATE INDEX "authenticity_checks_status_updatedAt_idx" ON "authenticity_checks"("status", "updatedAt");

-- CreateIndex
CREATE INDEX "authenticity_checks_reviewedById_idx" ON "authenticity_checks"("reviewedById");

-- CreateIndex
CREATE INDEX "ai_eval_runs_task_model_createdAt_idx" ON "ai_eval_runs"("task", "model", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "platform_decisions_settingKey_appliedAt_idx" ON "platform_decisions"("settingKey", "appliedAt" DESC);

-- CreateIndex
CREATE INDEX "platform_decisions_experimentId_idx" ON "platform_decisions"("experimentId");

-- CreateIndex
CREATE INDEX "platform_decisions_approvedById_idx" ON "platform_decisions"("approvedById");

-- AddForeignKey
ALTER TABLE "platform_decisions" ADD CONSTRAINT "platform_decisions_experimentId_fkey" FOREIGN KEY ("experimentId") REFERENCES "experiments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_decisions" ADD CONSTRAINT "platform_decisions_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_decisionId_fkey" FOREIGN KEY ("decisionId") REFERENCES "platform_decisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticity_checks" ADD CONSTRAINT "authenticity_checks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticity_checks" ADD CONSTRAINT "authenticity_checks_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ─── Restricciones que Prisma no modela (docs/data-model.md → Administración, automejora y moderación) ───

-- Experimentos: fracción al tratamiento en [0, 1] y muestra mínima positiva.
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_allocation_range"
  CHECK ("allocation" >= 0 AND "allocation" <= 1);
ALTER TABLE "experiments" ADD CONSTRAINT "experiments_min_sample_positive"
  CHECK ("minSamplePerVariant" > 0);

-- A lo más un experimento corriendo por ajuste: dos a la vez sobre el mismo parámetro se contaminan
-- entre sí y ninguno se podría evaluar.
CREATE UNIQUE INDEX "experiments_one_running_per_setting" ON "experiments"("settingKey")
  WHERE "status" = 'RUNNING';

-- Métricas diarias: la muestra nunca es negativa.
ALTER TABLE "daily_metrics" ADD CONSTRAINT "daily_metrics_sample_non_negative"
  CHECK ("sampleSize" >= 0);

-- Autenticidad: puntaje de riesgo normalizado.
ALTER TABLE "authenticity_checks" ADD CONSTRAINT "authenticity_checks_score_range"
  CHECK ("score" >= 0 AND "score" <= 1);

-- Evaluaciones de modelos: aprobados dentro de los casos y costo no negativo.
ALTER TABLE "ai_eval_runs" ADD CONSTRAINT "ai_eval_runs_counts_valid"
  CHECK ("cases" >= 0 AND "passed" >= 0 AND "passed" <= "cases" AND "costMicrosUsd" >= 0);
