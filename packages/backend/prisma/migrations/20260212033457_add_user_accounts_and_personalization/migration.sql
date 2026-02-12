-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_series_ratings" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_series_ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_series_notes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "note" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_series_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_tag_votes" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "tagValue" TEXT NOT NULL,
    "vote" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_tag_votes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE INDEX "users_username_idx" ON "users"("username");

-- CreateIndex
CREATE INDEX "oauth_identities_userId_idx" ON "oauth_identities"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_identities_provider_providerId_key" ON "oauth_identities"("provider", "providerId");

-- CreateIndex
CREATE INDEX "user_series_ratings_userId_idx" ON "user_series_ratings"("userId");

-- CreateIndex
CREATE INDEX "user_series_ratings_seriesId_idx" ON "user_series_ratings"("seriesId");

-- CreateIndex
CREATE INDEX "user_series_ratings_rating_idx" ON "user_series_ratings"("rating");

-- CreateIndex
CREATE UNIQUE INDEX "user_series_ratings_userId_seriesId_key" ON "user_series_ratings"("userId", "seriesId");

-- CreateIndex
CREATE INDEX "user_series_notes_userId_idx" ON "user_series_notes"("userId");

-- CreateIndex
CREATE INDEX "user_series_notes_seriesId_idx" ON "user_series_notes"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "user_series_notes_userId_seriesId_key" ON "user_series_notes"("userId", "seriesId");

-- CreateIndex
CREATE INDEX "user_tag_votes_userId_idx" ON "user_tag_votes"("userId");

-- CreateIndex
CREATE INDEX "user_tag_votes_seriesId_idx" ON "user_tag_votes"("seriesId");

-- CreateIndex
CREATE INDEX "user_tag_votes_tagValue_idx" ON "user_tag_votes"("tagValue");

-- CreateIndex
CREATE UNIQUE INDEX "user_tag_votes_userId_seriesId_tagValue_key" ON "user_tag_votes"("userId", "seriesId", "tagValue");

-- CreateIndex
CREATE INDEX "user_preferences_userId_idx" ON "user_preferences"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_preferences_userId_key_key" ON "user_preferences"("userId", "key");

-- AddForeignKey
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_series_ratings" ADD CONSTRAINT "user_series_ratings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_series_ratings" ADD CONSTRAINT "user_series_ratings_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_series_notes" ADD CONSTRAINT "user_series_notes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_series_notes" ADD CONSTRAINT "user_series_notes_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tag_votes" ADD CONSTRAINT "user_tag_votes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_tag_votes" ADD CONSTRAINT "user_tag_votes_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_preferences" ADD CONSTRAINT "user_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
