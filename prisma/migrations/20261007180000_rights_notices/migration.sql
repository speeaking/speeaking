-- Avisos de derechos (ADR-076): aviso y contra-aviso de la LFDA (art. 114 Octies), archivos
-- bloqueados contra la nueva subida, motivos de reporte prioritarios, mayoría de edad y avisos al
-- autor cuando se retira o restaura su contenido. Solo agrega: no cambia ni borra datos.

-- CreateEnum
CREATE TYPE "RightsNoticeKind" AS ENUM ('COPYRIGHT', 'TRADEMARK', 'PERFORMER_IMAGE');

-- CreateEnum
CREATE TYPE "RightsClaimantRole" AS ENUM ('OWNER', 'REPRESENTATIVE');

-- CreateEnum
CREATE TYPE "RightsNoticeStatus" AS ENUM ('RECEIVED', 'CONTENT_REMOVED', 'COUNTER_NOTICE_RECEIVED', 'RESTORED', 'KEPT_DOWN', 'REJECTED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "CounterNoticeBasis" AS ENUM ('OWN_WORK', 'LICENSE', 'EXCEPTION', 'PUBLIC_DOMAIN');

-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'AGE_18';

-- AlterEnum
ALTER TYPE "ReportReason" ADD VALUE 'INTIMATE_WITHOUT_CONSENT';
ALTER TYPE "ReportReason" ADD VALUE 'CHILD_SAFETY';
ALTER TYPE "ReportReason" ADD VALUE 'MINOR_ACCOUNT';

-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'CONTENT_REMOVED';
ALTER TYPE "NotificationType" ADD VALUE 'CONTENT_RESTORED';

-- AlterTable
ALTER TABLE "media" ADD COLUMN     "sha256" CHAR(64);

-- CreateTable
CREATE TABLE "rights_notices" (
    "id" UUID NOT NULL,
    "number" SERIAL NOT NULL,
    "kind" "RightsNoticeKind" NOT NULL,
    "status" "RightsNoticeStatus" NOT NULL DEFAULT 'RECEIVED',
    "claimantName" VARCHAR(200) NOT NULL,
    "claimantEmail" VARCHAR(320) NOT NULL,
    "claimantAltEmail" VARCHAR(320),
    "claimantPhone" VARCHAR(40),
    "claimantDomicile" VARCHAR(500),
    "claimantRole" "RightsClaimantRole" NOT NULL,
    "principalName" VARCHAR(200),
    "workDescription" VARCHAR(2000) NOT NULL,
    "rightDescription" VARCHAR(2000) NOT NULL,
    "facts" VARCHAR(4000),
    "urls" TEXT[],
    "trademarkRegistration" VARCHAR(40),
    "swornStatement" BOOLEAN NOT NULL,
    "penaltyAcknowledged" BOOLEAN NOT NULL,
    "submittedById" UUID,
    "receivedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contentRemovedAt" TIMESTAMPTZ(3),
    "uploaderNotifiedAt" TIMESTAMPTZ(3),
    "counterNoticeAt" TIMESTAMPTZ(3),
    "restoreDueAt" TIMESTAMPTZ(3),
    "restoredAt" TIMESTAMPTZ(3),
    "decidedById" UUID,
    "decisionNote" VARCHAR(1000),
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "rights_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rights_notice_targets" (
    "id" UUID NOT NULL,
    "noticeId" UUID NOT NULL,
    "targetType" "ReportTargetType" NOT NULL,
    "targetId" UUID NOT NULL,
    "ownerId" UUID,
    "url" VARCHAR(2000) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "rights_notice_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "counter_notices" (
    "id" UUID NOT NULL,
    "noticeId" UUID NOT NULL,
    "userId" UUID,
    "name" VARCHAR(200) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "domicile" VARCHAR(500) NOT NULL,
    "basis" "CounterNoticeBasis" NOT NULL,
    "explanation" VARCHAR(4000) NOT NULL,
    "swornStatement" BOOLEAN NOT NULL,
    "penaltyAcknowledged" BOOLEAN NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "forwardedAt" TIMESTAMPTZ(3),

    CONSTRAINT "counter_notices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "blocked_media_hashes" (
    "sha256" CHAR(64) NOT NULL,
    "reason" VARCHAR(40) NOT NULL,
    "noticeId" UUID,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "blocked_media_hashes_pkey" PRIMARY KEY ("sha256")
);

-- CreateIndex
CREATE UNIQUE INDEX "rights_notices_number_key" ON "rights_notices"("number");

-- CreateIndex
CREATE INDEX "rights_notices_status_receivedAt_idx" ON "rights_notices"("status", "receivedAt");

-- CreateIndex
CREATE INDEX "rights_notices_submittedById_idx" ON "rights_notices"("submittedById");

-- CreateIndex
CREATE INDEX "rights_notices_decidedById_idx" ON "rights_notices"("decidedById");

-- CreateIndex
CREATE INDEX "rights_notice_targets_targetType_targetId_idx" ON "rights_notice_targets"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "rights_notice_targets_ownerId_createdAt_idx" ON "rights_notice_targets"("ownerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "rights_notice_targets_noticeId_targetType_targetId_key" ON "rights_notice_targets"("noticeId", "targetType", "targetId");

-- CreateIndex
CREATE INDEX "counter_notices_noticeId_idx" ON "counter_notices"("noticeId");

-- CreateIndex
CREATE INDEX "counter_notices_userId_idx" ON "counter_notices"("userId");

-- CreateIndex
CREATE INDEX "blocked_media_hashes_noticeId_idx" ON "blocked_media_hashes"("noticeId");

-- CreateIndex
CREATE INDEX "media_sha256_idx" ON "media"("sha256");

-- AddForeignKey
ALTER TABLE "rights_notices" ADD CONSTRAINT "rights_notices_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rights_notices" ADD CONSTRAINT "rights_notices_decidedById_fkey" FOREIGN KEY ("decidedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rights_notice_targets" ADD CONSTRAINT "rights_notice_targets_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "rights_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rights_notice_targets" ADD CONSTRAINT "rights_notice_targets_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_notices" ADD CONSTRAINT "counter_notices_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "rights_notices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "counter_notices" ADD CONSTRAINT "counter_notices_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "blocked_media_hashes" ADD CONSTRAINT "blocked_media_hashes_noticeId_fkey" FOREIGN KEY ("noticeId") REFERENCES "rights_notices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
