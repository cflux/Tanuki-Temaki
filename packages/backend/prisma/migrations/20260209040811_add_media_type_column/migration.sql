-- AlterTable
ALTER TABLE "series" ADD COLUMN     "mediaType" TEXT NOT NULL DEFAULT 'ANIME';

-- CreateIndex
CREATE INDEX "series_mediaType_idx" ON "series"("mediaType");
