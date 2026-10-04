CREATE TABLE "shared_looks" (
  "id" UUID NOT NULL, "ownerId" UUID NOT NULL, "resultId" UUID NOT NULL,
  "recipientId" UUID, "tokenHash" VARCHAR(64), "message" VARCHAR(240) NOT NULL,
  "sizes" JSONB NOT NULL DEFAULT '{}', "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "revokedAt" TIMESTAMPTZ(3), "approvedAt" TIMESTAMPTZ(3), "approvedById" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "shared_looks_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "shared_looks_channel_check" CHECK (
    ("recipientId" IS NOT NULL AND "tokenHash" IS NULL) OR
    ("recipientId" IS NULL AND "tokenHash" IS NOT NULL)
  ),
  CONSTRAINT "shared_looks_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "shared_looks_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "users"("id") ON DELETE CASCADE,
  CONSTRAINT "shared_looks_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "users"("id") ON DELETE SET NULL,
  CONSTRAINT "shared_looks_resultId_fkey" FOREIGN KEY ("resultId") REFERENCES "try_on_results"("id") ON DELETE CASCADE
);
CREATE UNIQUE INDEX "shared_looks_tokenHash_key" ON "shared_looks"("tokenHash");
CREATE INDEX "shared_looks_ownerId_resultId_createdAt_idx" ON "shared_looks"("ownerId", "resultId", "createdAt" DESC);
CREATE INDEX "shared_looks_expiresAt_idx" ON "shared_looks"("expiresAt");
ALTER TABLE "messages" ADD COLUMN "sharedLookId" UUID;
ALTER TABLE "messages" ADD CONSTRAINT "messages_sharedLookId_fkey" FOREIGN KEY ("sharedLookId") REFERENCES "shared_looks"("id") ON DELETE SET NULL;
ALTER TABLE "cart_items" ADD COLUMN "requestedSize" VARCHAR(40), ADD COLUMN "giftRecipientName" VARCHAR(80);
ALTER TABLE "order_items" ADD COLUMN "requestedSize" VARCHAR(40), ADD COLUMN "giftRecipientName" VARCHAR(80);
