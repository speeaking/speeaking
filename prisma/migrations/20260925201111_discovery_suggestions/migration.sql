-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'DISCOVERABILITY';

-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "discoverable" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "suggestion_dismissals" (
    "userId" UUID NOT NULL,
    "targetUserId" UUID NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "suggestion_dismissals_pkey" PRIMARY KEY ("userId","targetUserId")
);

-- CreateIndex
CREATE INDEX "suggestion_dismissals_targetUserId_idx" ON "suggestion_dismissals"("targetUserId");

-- AddForeignKey
ALTER TABLE "suggestion_dismissals" ADD CONSTRAINT "suggestion_dismissals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suggestion_dismissals" ADD CONSTRAINT "suggestion_dismissals_targetUserId_fkey" FOREIGN KEY ("targetUserId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
