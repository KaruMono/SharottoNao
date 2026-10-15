-- CreateEnum
CREATE TYPE "TagDisplayTier" AS ENUM ('PRIMARY', 'SECONDARY');

-- AlterTable
ALTER TABLE "VndbTag"
ADD COLUMN "displayTier" "TagDisplayTier" NOT NULL DEFAULT 'PRIMARY';

-- AlterTable
ALTER TABLE "GameTagSource"
ADD COLUMN "displayTier" "TagDisplayTier" NOT NULL DEFAULT 'PRIMARY';

-- CreateIndex
CREATE INDEX "VndbTag_displayTier_idx" ON "VndbTag"("displayTier");
