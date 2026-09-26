-- Comprobantes de autenticidad (P14, ADR-036): rendimiento, bitácora y protección de las fotos.
--
-- 1. Índice GIN en `authenticity_checks."proofMediaIds"`: `/media`, el recolector de huérfanas y la
--    validación de adjuntos preguntan «¿esta foto es un comprobante?» (`@>` / `&&`, que usa el
--    índice; `= ANY(...)` no lo usaría).
-- 2. `authenticity_proof_history`: una fila por foto en cada envío. Reemplazar el comprobante no
--    libera las fotos anteriores (auditoría): siguen protegidas como las vigentes.
-- 3. Trigger en `post_media` y `product_media`: una foto de comprobante (vigente o anterior) nunca se
--    adjunta a una publicación ni a un producto, venga de donde venga el INSERT.

-- CreateTable
CREATE TABLE "authenticity_proof_history" (
    "id" UUID NOT NULL,
    "productId" UUID NOT NULL,
    "mediaId" UUID NOT NULL,
    "submittedAt" TIMESTAMPTZ(3) NOT NULL,
    "replacedAt" TIMESTAMPTZ(3),

    CONSTRAINT "authenticity_proof_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "authenticity_proof_history_mediaId_idx" ON "authenticity_proof_history"("mediaId");

-- CreateIndex
CREATE INDEX "authenticity_proof_history_productId_submittedAt_idx" ON "authenticity_proof_history"("productId", "submittedAt");

-- CreateIndex
CREATE INDEX "authenticity_checks_proofMediaIds_idx" ON "authenticity_checks" USING GIN ("proofMediaIds");

-- AddForeignKey
ALTER TABLE "authenticity_proof_history" ADD CONSTRAINT "authenticity_proof_history_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "authenticity_proof_history" ADD CONSTRAINT "authenticity_proof_history_mediaId_fkey" FOREIGN KEY ("mediaId") REFERENCES "media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Bitácora inicial: los comprobantes vigentes (la fecha del envío no se guardaba; se usa la última
-- actualización de la revisión). Solo fotos que siguen existiendo (llave foránea).
INSERT INTO "authenticity_proof_history" ("id", "productId", "mediaId", "submittedAt")
SELECT gen_random_uuid(), ac."productId", m."id", ac."updatedAt"
FROM "authenticity_checks" ac
CROSS JOIN LATERAL unnest(ac."proofMediaIds") AS proof("mediaId")
JOIN "media" m ON m."id" = proof."mediaId";

-- Una foto de comprobante (vigente o de un envío anterior) nunca se adjunta. Primero toma el candado
-- de la foto (el mismo FOR KEY SHARE de la llave foránea): si `submitProof` la tiene bloqueada
-- FOR UPDATE mientras la guarda como comprobante, espera a que confirme, y la consulta siguiente (con
-- su propia foto de la base en READ COMMITTED: la función es VOLATILE) ya ve el comprobante. Al revés,
-- `submitProof` espera este candado y después ve el adjunto (`lockPrivateReadyMedia`).
CREATE FUNCTION "reject_proof_media_link"() RETURNS trigger
  LANGUAGE plpgsql VOLATILE
  AS $$
BEGIN
  PERFORM 1 FROM "media" WHERE "id" = NEW."mediaId" FOR KEY SHARE;
  IF EXISTS (SELECT 1 FROM "authenticity_checks" WHERE "proofMediaIds" @> ARRAY[NEW."mediaId"])
     OR EXISTS (SELECT 1 FROM "authenticity_proof_history" WHERE "mediaId" = NEW."mediaId") THEN
    RAISE EXCEPTION 'proof_media_link: la foto % es un comprobante de autenticidad', NEW."mediaId"
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "post_media_reject_proof"
  BEFORE INSERT OR UPDATE OF "mediaId" ON "post_media"
  FOR EACH ROW EXECUTE FUNCTION "reject_proof_media_link"();

CREATE TRIGGER "product_media_reject_proof"
  BEFORE INSERT OR UPDATE OF "mediaId" ON "product_media"
  FOR EACH ROW EXECUTE FUNCTION "reject_proof_media_link"();
