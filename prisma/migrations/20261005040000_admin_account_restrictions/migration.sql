-- Restricciones de acceso del equipo; solo agrega una tabla y relaciones.
CREATE TABLE "account_restrictions" (
    "userId" UUID NOT NULL,
    "reason" VARCHAR(500) NOT NULL,
    "blockedById" UUID,
    "blockedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "account_restrictions_pkey" PRIMARY KEY ("userId")
);

CREATE INDEX "account_restrictions_blockedById_idx" ON "account_restrictions"("blockedById");
CREATE INDEX "account_restrictions_blockedAt_idx" ON "account_restrictions"("blockedAt");
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_blockedById_fkey"
    FOREIGN KEY ("blockedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "account_restrictions" ADD CONSTRAINT "account_restrictions_reason_not_empty"
    CHECK (char_length(trim("reason")) >= 3);
