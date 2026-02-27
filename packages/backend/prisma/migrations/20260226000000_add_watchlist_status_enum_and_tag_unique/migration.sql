-- CreateEnum
CREATE TYPE "WatchlistStatus" AS ENUM ('plan_to_watch', 'watching', 'completed', 'on_hold', 'dropped');

-- AlterTable: Convert status column from TEXT to WatchlistStatus enum
-- First drop the default, alter the type, then re-add the default
ALTER TABLE "user_watchlist" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "user_watchlist" ALTER COLUMN "status" TYPE "WatchlistStatus" USING "status"::"WatchlistStatus";
ALTER TABLE "user_watchlist" ALTER COLUMN "status" SET DEFAULT 'plan_to_watch';

-- Deduplicate tags before adding unique constraint
-- Keep the first tag (by id) for each (seriesId, value) pair, delete the rest
DELETE FROM "tags" a USING "tags" b
WHERE a."seriesId" = b."seriesId"
  AND a."value" = b."value"
  AND a."id" > b."id";

-- CreateIndex
CREATE UNIQUE INDEX "tags_seriesId_value_key" ON "tags"("seriesId", "value");
