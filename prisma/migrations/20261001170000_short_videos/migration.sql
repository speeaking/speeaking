-- AlterTable
ALTER TABLE "media" ADD COLUMN     "durationMs" INTEGER,
ADD COLUMN     "posterId" UUID,
ADD COLUMN     "videoCodec" VARCHAR(8);

-- CreateIndex
CREATE UNIQUE INDEX "media_posterId_key" ON "media"("posterId");

-- AddForeignKey
ALTER TABLE "media" ADD CONSTRAINT "media_posterId_fkey" FOREIGN KEY ("posterId") REFERENCES "media"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- Solo un video tiene portada, y nunca es él mismo (ADR-062).
ALTER TABLE "media" ADD CONSTRAINT "media_poster_only_video"
  CHECK ("posterId" IS NULL OR ("kind" = 'VIDEO' AND "posterId" <> "id"));
