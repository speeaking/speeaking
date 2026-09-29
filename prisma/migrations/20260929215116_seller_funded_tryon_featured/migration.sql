-- AlterEnum
ALTER TYPE "AnalyticsEventType" ADD VALUE 'TRY_ON_REQUESTED';

-- AlterEnum
ALTER TYPE "WalletEntryKind" ADD VALUE 'FEATURED';

-- AlterTable
ALTER TABLE "products" ADD COLUMN     "featuredUntil" TIMESTAMPTZ(3);

-- AlterTable
ALTER TABLE "try_on_results" ADD COLUMN     "sellerId" UUID;

-- CreateIndex
CREATE INDEX "products_featuredUntil_idx" ON "products"("featuredUntil");

-- CreateIndex
CREATE INDEX "try_on_results_sellerId_createdAt_idx" ON "try_on_results"("sellerId", "createdAt");
