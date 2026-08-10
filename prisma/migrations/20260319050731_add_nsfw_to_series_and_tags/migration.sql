-- AlterTable
ALTER TABLE "GameSeries" ADD COLUMN IF NOT EXISTS "isNsfw" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Tag" ADD COLUMN IF NOT EXISTS "isNsfw" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "GameSeries_isNsfw_idx" ON "GameSeries"("isNsfw");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Tag_isNsfw_idx" ON "Tag"("isNsfw");
