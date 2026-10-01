-- CreateEnum
CREATE TYPE "EditorialDraftKind" AS ENUM ('QUESTION', 'TIP', 'DATE', 'TOPIC');

-- CreateEnum
CREATE TYPE "EditorialDraftStatus" AS ENUM ('PENDING', 'PUBLISHED', 'DISCARDED');

-- AlterEnum
ALTER TYPE "AIFeature" ADD VALUE 'EDITORIAL_DRAFT';

-- CreateTable
CREATE TABLE "editorial_drafts" (
    "id" UUID NOT NULL,
    "communityId" UUID NOT NULL,
    "kind" "EditorialDraftKind" NOT NULL,
    "day" DATE NOT NULL,
    "autoKey" TEXT,
    "body" TEXT NOT NULL,
    "occasion" TEXT,
    "topic" TEXT,
    "status" "EditorialDraftStatus" NOT NULL DEFAULT 'PENDING',
    "provider" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "promptVersion" TEXT NOT NULL,
    "requestId" UUID,
    "postId" UUID,
    "reviewedById" UUID,
    "reviewedAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "editorial_drafts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "editorial_drafts_autoKey_key" ON "editorial_drafts"("autoKey");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_drafts_requestId_key" ON "editorial_drafts"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "editorial_drafts_postId_key" ON "editorial_drafts"("postId");

-- CreateIndex
CREATE INDEX "editorial_drafts_status_createdAt_idx" ON "editorial_drafts"("status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "editorial_drafts_communityId_status_createdAt_idx" ON "editorial_drafts"("communityId", "status", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "editorial_drafts_reviewedById_idx" ON "editorial_drafts"("reviewedById");

-- AddForeignKey
ALTER TABLE "editorial_drafts" ADD CONSTRAINT "editorial_drafts_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_drafts" ADD CONSTRAINT "editorial_drafts_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "ai_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_drafts" ADD CONSTRAINT "editorial_drafts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "editorial_drafts" ADD CONSTRAINT "editorial_drafts_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

