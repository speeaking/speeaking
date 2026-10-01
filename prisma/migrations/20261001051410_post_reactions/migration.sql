-- CreateEnum
CREATE TYPE "ReactionKind" AS ENUM ('LIKE', 'CARE', 'HAHA', 'WOW', 'SAD', 'ANGRY');

-- AlterTable
ALTER TABLE "likes" ADD COLUMN     "kind" "ReactionKind" NOT NULL DEFAULT 'LIKE';
