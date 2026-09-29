-- CreateEnum
CREATE TYPE "AIFunding" AS ENUM ('PLATFORM', 'USER_PAID', 'SELLER_PAID', 'SYSTEM');

-- CreateEnum
CREATE TYPE "WalletEntryKind" AS ENUM ('TOPUP', 'PROMO', 'TRY_ON', 'SPONSORED_TRY_ON', 'REFUND', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "TopUpStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "TryOnStatus" AS ENUM ('PENDING', 'READY', 'FAILED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AIFeature" ADD VALUE 'SHOPPING_INTENT';
ALTER TYPE "AIFeature" ADD VALUE 'LOOK_COPY';
ALTER TYPE "AIFeature" ADD VALUE 'VIRTUAL_TRY_ON';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AnalyticsEventType" ADD VALUE 'NEED_SUBMITTED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'LOOK_GENERATED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'LOOK_ITEM_SWAPPED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'TRY_ON_GENERATED';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'WALLET_TOPUP';
ALTER TYPE "AnalyticsEventType" ADD VALUE 'WALLET_CHARGE';

-- AlterEnum
ALTER TYPE "ConsentType" ADD VALUE 'TRY_ON_PHOTOS';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Surface" ADD VALUE 'STYLIST';
ALTER TYPE "Surface" ADD VALUE 'WALLET';

-- AlterTable
ALTER TABLE "ai_requests" ADD COLUMN     "funding" "AIFunding" NOT NULL DEFAULT 'PLATFORM';

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN     "sponsorsTryOn" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "tryOnDailyCapCents" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "wallets" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "balanceCents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "wallets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_entries" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "kind" "WalletEntryKind" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "balanceAfterCents" INTEGER NOT NULL,
    "reference" VARCHAR(80),
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wallet_top_ups" (
    "id" UUID NOT NULL,
    "walletId" UUID NOT NULL,
    "packId" VARCHAR(40) NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "bonusCents" INTEGER NOT NULL DEFAULT 0,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "status" "TopUpStatus" NOT NULL DEFAULT 'PENDING',
    "provider" VARCHAR(40) NOT NULL,
    "providerRef" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "paidAt" TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "wallet_top_ups_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "try_on_photos" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "consentVersion" VARCHAR(20) NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "try_on_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "try_on_results" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "photoId" UUID NOT NULL,
    "productIds" UUID[],
    "cacheKey" VARCHAR(64) NOT NULL,
    "status" "TryOnStatus" NOT NULL DEFAULT 'PENDING',
    "resultMediaId" UUID,
    "aiRequestId" UUID,
    "funding" "AIFunding" NOT NULL DEFAULT 'PLATFORM',
    "sponsorSellerId" UUID,
    "chargedCents" INTEGER NOT NULL DEFAULT 0,
    "errorCode" VARCHAR(40),
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "try_on_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "style_looks" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "needText" VARCHAR(300) NOT NULL,
    "need" JSONB NOT NULL,
    "items" JSONB NOT NULL,
    "totalCents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'MXN',
    "title" VARCHAR(80) NOT NULL,
    "explanation" VARCHAR(300),
    "copySource" VARCHAR(20) NOT NULL,
    "anchorProductId" UUID,
    "algorithmVersion" VARCHAR(20) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "style_looks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "wallets_userId_key" ON "wallets"("userId");

-- CreateIndex
CREATE INDEX "wallet_entries_walletId_createdAt_idx" ON "wallet_entries"("walletId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "wallet_entries_kind_createdAt_idx" ON "wallet_entries"("kind", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "wallet_top_ups_providerRef_key" ON "wallet_top_ups"("providerRef");

-- CreateIndex
CREATE INDEX "wallet_top_ups_walletId_createdAt_idx" ON "wallet_top_ups"("walletId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "try_on_photos_mediaId_key" ON "try_on_photos"("mediaId");

-- CreateIndex
CREATE INDEX "try_on_photos_userId_createdAt_idx" ON "try_on_photos"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "try_on_photos_expiresAt_idx" ON "try_on_photos"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "try_on_results_cacheKey_key" ON "try_on_results"("cacheKey");

-- CreateIndex
CREATE UNIQUE INDEX "try_on_results_resultMediaId_key" ON "try_on_results"("resultMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "try_on_results_aiRequestId_key" ON "try_on_results"("aiRequestId");

-- CreateIndex
CREATE INDEX "try_on_results_userId_createdAt_idx" ON "try_on_results"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "try_on_results_expiresAt_idx" ON "try_on_results"("expiresAt");

-- CreateIndex
CREATE INDEX "try_on_results_sponsorSellerId_createdAt_idx" ON "try_on_results"("sponsorSellerId", "createdAt");

-- CreateIndex
CREATE INDEX "style_looks_userId_createdAt_idx" ON "style_looks"("userId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "wallet_top_ups_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "wallets"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_photos" ADD CONSTRAINT "try_on_photos_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_photos" ADD CONSTRAINT "try_on_photos_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_results" ADD CONSTRAINT "try_on_results_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_results" ADD CONSTRAINT "try_on_results_photoId_fkey" FOREIGN KEY ("photoId") REFERENCES "try_on_photos"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_results" ADD CONSTRAINT "try_on_results_resultMediaId_fkey" FOREIGN KEY ("resultMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "try_on_results" ADD CONSTRAINT "try_on_results_aiRequestId_fkey" FOREIGN KEY ("aiRequestId") REFERENCES "ai_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "style_looks" ADD CONSTRAINT "style_looks_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Saldo (ADR-044): nunca negativo, movimientos con monto y saldo resultante válidos, recargas
-- positivas; tope diario de patrocinio y cobros de Pruébatelo no negativos.
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_balance_non_negative" CHECK ("balanceCents" >= 0);
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_amount_non_zero" CHECK ("amountCents" <> 0);
ALTER TABLE "wallet_entries" ADD CONSTRAINT "wallet_entries_balance_after_non_negative" CHECK ("balanceAfterCents" >= 0);
ALTER TABLE "wallet_top_ups" ADD CONSTRAINT "wallet_top_ups_amounts_valid" CHECK ("amountCents" > 0 AND "bonusCents" >= 0);
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_try_on_cap_non_negative" CHECK ("tryOnDailyCapCents" >= 0);
ALTER TABLE "try_on_results" ADD CONSTRAINT "try_on_results_charged_non_negative" CHECK ("chargedCents" >= 0);
ALTER TABLE "style_looks" ADD CONSTRAINT "style_looks_total_non_negative" CHECK ("totalCents" >= 0);

-- Fotos privadas de Pruébatelo (ADR-045): como los comprobantes de autenticidad, nunca se adjuntan
-- a una publicación ni a un producto, venga de donde venga el INSERT. Misma función y candado que
-- `reject_proof_media_link` (migración 20260926205245), con las dos tablas nuevas.
CREATE OR REPLACE FUNCTION "reject_proof_media_link"() RETURNS trigger
  LANGUAGE plpgsql VOLATILE
  AS $$
BEGIN
  PERFORM 1 FROM "media" WHERE "id" = NEW."mediaId" FOR KEY SHARE;
  IF EXISTS (SELECT 1 FROM "authenticity_checks" WHERE "proofMediaIds" @> ARRAY[NEW."mediaId"])
     OR EXISTS (SELECT 1 FROM "authenticity_proof_history" WHERE "mediaId" = NEW."mediaId") THEN
    RAISE EXCEPTION 'proof_media_link: la foto % es un comprobante de autenticidad', NEW."mediaId"
      USING ERRCODE = 'check_violation';
  END IF;
  IF EXISTS (SELECT 1 FROM "try_on_photos" WHERE "mediaId" = NEW."mediaId")
     OR EXISTS (SELECT 1 FROM "try_on_results" WHERE "resultMediaId" = NEW."mediaId") THEN
    RAISE EXCEPTION 'private_media_link: la foto % es de Pruébatelo', NEW."mediaId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;
