-- CreateTable
CREATE TABLE "user_watchlist" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "seriesId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'plan_to_watch',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_watchlist_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_watchlist_userId_idx" ON "user_watchlist"("userId");

-- CreateIndex
CREATE INDEX "user_watchlist_seriesId_idx" ON "user_watchlist"("seriesId");

-- CreateIndex
CREATE INDEX "user_watchlist_status_idx" ON "user_watchlist"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_watchlist_userId_seriesId_key" ON "user_watchlist"("userId", "seriesId");

-- AddForeignKey
ALTER TABLE "user_watchlist" ADD CONSTRAINT "user_watchlist_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_watchlist" ADD CONSTRAINT "user_watchlist_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "series"("id") ON DELETE CASCADE ON UPDATE CASCADE;
