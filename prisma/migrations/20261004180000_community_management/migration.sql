-- Cambios aditivos: las comunidades oficiales y sus membresías conservan sus datos.
CREATE TYPE "CommunityRole" AS ENUM ('MEMBER', 'ADMIN');
ALTER TABLE "communities" ADD COLUMN "ownerId" UUID;
ALTER TABLE "community_memberships" ADD COLUMN "role" "CommunityRole" NOT NULL DEFAULT 'MEMBER';
CREATE INDEX "communities_ownerId_idx" ON "communities"("ownerId");
ALTER TABLE "communities" ADD CONSTRAINT "communities_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "community_invitations" (
  "communityId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "invitedById" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_invitations_pkey" PRIMARY KEY ("userId", "communityId"),
  CONSTRAINT "community_invitations_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "community_invitations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "community_invitations_invitedById_fkey" FOREIGN KEY ("invitedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX "community_invitations_communityId_createdAt_idx" ON "community_invitations"("communityId", "createdAt");

CREATE TABLE "community_removals" (
  "communityId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "community_removals_pkey" PRIMARY KEY ("userId", "communityId"),
  CONSTRAINT "community_removals_communityId_fkey" FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "community_removals_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "community_removals_communityId_createdAt_idx" ON "community_removals"("communityId", "createdAt");

ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'COMMUNITY_INVITE';
ALTER TABLE "notifications" ADD COLUMN "communityId" UUID;
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_communityId_fkey"
  FOREIGN KEY ("communityId") REFERENCES "communities"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "notifications_communityId_idx" ON "notifications"("communityId");
