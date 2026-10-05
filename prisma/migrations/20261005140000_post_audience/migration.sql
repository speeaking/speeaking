-- Preserve the existing audience before enabling public defaults for new posts.
CREATE TYPE "PostAudience" AS ENUM ('PUBLIC', 'FRIENDS', 'ONLY_ME');
ALTER TABLE "posts" ADD COLUMN "audience" "PostAudience" NOT NULL DEFAULT 'FRIENDS';
UPDATE "posts" p SET "audience" = 'PUBLIC'
WHERE p."productId" IS NOT NULL OR EXISTS (
  SELECT 1 FROM "profiles" profile JOIN "users" u ON u."id" = profile."userId"
  WHERE profile."userId" = p."authorId" AND (
    profile."isEditorial" = true OR
    (profile."role" = 'ADMIN' AND lower(u."email") = 'speeaking@gmail.com')
  )
);
ALTER TABLE "posts" ALTER COLUMN "audience" SET DEFAULT 'PUBLIC';
CREATE INDEX "posts_audience_status_publishedAt_idx" ON "posts"("audience", "status", "publishedAt" DESC);
