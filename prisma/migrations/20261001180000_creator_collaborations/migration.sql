-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_TAGGED';
ALTER TYPE "NotificationType" ADD VALUE 'PRODUCT_TAG_REMOVED';

-- AlterTable
ALTER TABLE "posts" ADD COLUMN     "collaboration" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "seller_profiles" ADD COLUMN     "acceptsCollaborations" BOOLEAN NOT NULL DEFAULT false;

