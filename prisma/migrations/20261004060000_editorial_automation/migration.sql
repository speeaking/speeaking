CREATE TABLE "editorial_automation_tokens" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "tokenHash" VARCHAR(64) NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt" TIMESTAMPTZ(3),
  "revokedAt" TIMESTAMPTZ(3),
  CONSTRAINT "editorial_automation_tokens_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "editorial_automation_tokens_tokenHash_key" ON "editorial_automation_tokens"("tokenHash");
CREATE INDEX "editorial_automation_tokens_userId_idx" ON "editorial_automation_tokens"("userId");
ALTER TABLE "editorial_automation_tokens" ADD CONSTRAINT "editorial_automation_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
