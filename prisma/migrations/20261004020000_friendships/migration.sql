CREATE TYPE "FriendshipStatus" AS ENUM ('PENDING', 'ACCEPTED');
CREATE TABLE "friendships" (
  "userAId" UUID NOT NULL,
  "userBId" UUID NOT NULL,
  "requesterId" UUID NOT NULL,
  "status" "FriendshipStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMPTZ(3),
  CONSTRAINT "friendships_pkey" PRIMARY KEY ("userAId", "userBId"),
  CONSTRAINT "friendships_ordered_pair" CHECK ("userAId" < "userBId"),
  CONSTRAINT "friendships_requester_is_participant" CHECK ("requesterId" IN ("userAId", "userBId")),
  CONSTRAINT "friendships_acceptance_time" CHECK (("status" = 'ACCEPTED') = ("acceptedAt" IS NOT NULL)),
  CONSTRAINT "friendships_userAId_fkey" FOREIGN KEY ("userAId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "friendships_userBId_fkey" FOREIGN KEY ("userBId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "friendships_userAId_status_createdAt_idx" ON "friendships"("userAId", "status", "createdAt" DESC);
CREATE INDEX "friendships_userBId_status_createdAt_idx" ON "friendships"("userBId", "status", "createdAt" DESC);
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_REQUEST';
ALTER TYPE "NotificationType" ADD VALUE 'FRIEND_ACCEPTED';
