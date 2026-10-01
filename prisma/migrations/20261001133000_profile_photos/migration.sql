-- AlterTable
ALTER TABLE "profiles" ADD COLUMN     "avatarMediaId" UUID,
ADD COLUMN     "coverMediaId" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "profiles_avatarMediaId_key" ON "profiles"("avatarMediaId");

-- CreateIndex
CREATE UNIQUE INDEX "profiles_coverMediaId_key" ON "profiles"("coverMediaId");

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_avatarMediaId_fkey" FOREIGN KEY ("avatarMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_coverMediaId_fkey" FOREIGN KEY ("coverMediaId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Foto de perfil y portada (ADR-058): como en publicaciones y productos, nunca un comprobante de
-- autenticidad ni una foto de Pruébatelo, venga de donde venga el UPDATE. Mismo candado que
-- `reject_proof_media_link` (FOR KEY SHARE sobre la foto).
CREATE OR REPLACE FUNCTION "reject_private_profile_media"() RETURNS trigger
  LANGUAGE plpgsql VOLATILE
  AS $$
DECLARE
  candidate uuid;
BEGIN
  FOREACH candidate IN ARRAY ARRAY[NEW."avatarMediaId", NEW."coverMediaId"] LOOP
    CONTINUE WHEN candidate IS NULL;
    PERFORM 1 FROM "media" WHERE "id" = candidate FOR KEY SHARE;
    IF EXISTS (SELECT 1 FROM "authenticity_checks" WHERE "proofMediaIds" @> ARRAY[candidate])
       OR EXISTS (SELECT 1 FROM "authenticity_proof_history" WHERE "mediaId" = candidate) THEN
      RAISE EXCEPTION 'proof_media_link: la foto % es un comprobante de autenticidad', candidate
        USING ERRCODE = 'check_violation';
    END IF;
    IF EXISTS (SELECT 1 FROM "try_on_photos" WHERE "mediaId" = candidate)
       OR EXISTS (SELECT 1 FROM "try_on_results" WHERE "resultMediaId" = candidate) THEN
      RAISE EXCEPTION 'private_media_link: la foto % es de Pruébatelo', candidate
        USING ERRCODE = 'check_violation';
    END IF;
  END LOOP;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "profiles_reject_private_media"
  BEFORE INSERT OR UPDATE OF "avatarMediaId", "coverMediaId" ON "profiles"
  FOR EACH ROW EXECUTE FUNCTION "reject_private_profile_media"();
