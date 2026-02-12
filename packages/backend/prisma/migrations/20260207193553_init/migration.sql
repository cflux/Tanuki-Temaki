-- CreateTable
CREATE TABLE "series" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "titleImage" TEXT,
    "description" TEXT NOT NULL,
    "rating" DOUBLE PRECISION,
    "ageRating" TEXT,
    "languages" TEXT[],
    "genres" TEXT[],
    "contentAdvisory" TEXT[],
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "series_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tags" (
    "id" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "category" TEXT,

    CONSTRAINT "tags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "relationships" (
    "id" TEXT NOT NULL,
    "fromSeriesId" TEXT NOT NULL,
    "toSeriesId" TEXT NOT NULL,
    "similarity" DOUBLE PRECISION,
    "sharedTags" TEXT[],
    "discoveredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "relationships_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "series_url_key" ON "series"("url");

-- CreateIndex
CREATE INDEX "series_provider_idx" ON "series"("provider");

-- CreateIndex
CREATE INDEX "series_title_idx" ON "series"("title");

-- CreateIndex
CREATE UNIQUE INDEX "series_provider_externalId_key" ON "series"("provider", "externalId");

-- CreateIndex
CREATE INDEX "tags_seriesId_idx" ON "tags"("seriesId");

-- CreateIndex
CREATE INDEX "tags_value_idx" ON "tags"("value");

-- CreateIndex
CREATE INDEX "tags_category_idx" ON "tags"("category");

-- CreateIndex
CREATE INDEX "relationships_fromSeriesId_idx" ON "relationships"("fromSeriesId");

-- CreateIndex
CREATE INDEX "relationships_toSeriesId_idx" ON "relationships"("toSeriesId");

-- CreateIndex
CREATE UNIQUE INDEX "relationships_fromSeriesId_toSeriesId_key" ON "relationships"("fromSeriesId", "toSeriesId");

-- AddForeignKey
ALTER TABLE "tags" ADD CONSTRAINT "tags_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_fromSeriesId_fkey" FOREIGN KEY ("fromSeriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "relationships" ADD CONSTRAINT "relationships_toSeriesId_fkey" FOREIGN KEY ("toSeriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
