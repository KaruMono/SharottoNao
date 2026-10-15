-- CreateEnum
CREATE TYPE "VndbTagStatus" AS ENUM ('PENDING', 'MAPPED', 'IGNORED');

-- CreateEnum
CREATE TYPE "GameTagSourceType" AS ENUM ('MANUAL', 'VNDB', 'SYSTEM');

-- AlterTable
ALTER TABLE "Game" ADD COLUMN "vndbTagsSyncedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Tag"
ADD COLUMN "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- CreateTable
CREATE TABLE "TagAlias" (
    "id" SERIAL NOT NULL,
    "tagId" INTEGER NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "normalizedName" VARCHAR(100) NOT NULL,
    "locale" VARCHAR(20),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TagAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VndbTag" (
    "id" VARCHAR(20) NOT NULL,
    "nameEn" VARCHAR(255) NOT NULL,
    "tagId" INTEGER,
    "status" "VndbTagStatus" NOT NULL DEFAULT 'PENDING',
    "isNsfw" BOOLEAN NOT NULL DEFAULT false,
    "affectsGameNsfw" BOOLEAN NOT NULL DEFAULT false,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VndbTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GameVndbTag" (
    "gameId" INTEGER NOT NULL,
    "vndbTagId" VARCHAR(20) NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL,
    "spoiler" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GameVndbTag_pkey" PRIMARY KEY ("gameId", "vndbTagId")
);

-- CreateTable
CREATE TABLE "GameTagSource" (
    "gameId" INTEGER NOT NULL,
    "tagId" INTEGER NOT NULL,
    "source" "GameTagSourceType" NOT NULL,

    CONSTRAINT "GameTagSource_pkey" PRIMARY KEY ("gameId", "tagId", "source")
);

-- Preserve every existing display association and record its original source.
-- The machine-translation tag is maintained by a system rule; all other
-- pre-existing associations were created through manual game editing flows.
UPDATE "Tag"
SET "isSystem" = true
WHERE "name" = '机器翻译';

INSERT INTO "GameTagSource" ("gameId", "tagId", "source")
SELECT
    gt."gameId",
    gt."tagId",
    CASE
        WHEN t."name" = '机器翻译' THEN 'SYSTEM'::"GameTagSourceType"
        ELSE 'MANUAL'::"GameTagSourceType"
    END
FROM "GameTag" gt
INNER JOIN "Tag" t ON t."id" = gt."tagId";

-- CreateIndex
CREATE UNIQUE INDEX "TagAlias_normalizedName_key" ON "TagAlias"("normalizedName");

-- CreateIndex
CREATE INDEX "TagAlias_tagId_idx" ON "TagAlias"("tagId");

-- CreateIndex
CREATE INDEX "TagAlias_name_idx" ON "TagAlias"("name");

-- CreateIndex
CREATE INDEX "VndbTag_tagId_idx" ON "VndbTag"("tagId");

-- CreateIndex
CREATE INDEX "VndbTag_status_idx" ON "VndbTag"("status");

-- CreateIndex
CREATE INDEX "VndbTag_isNsfw_idx" ON "VndbTag"("isNsfw");

-- CreateIndex
CREATE INDEX "GameVndbTag_vndbTagId_idx" ON "GameVndbTag"("vndbTagId");

-- CreateIndex
CREATE INDEX "GameVndbTag_gameId_spoiler_rating_idx" ON "GameVndbTag"("gameId", "spoiler", "rating");

-- CreateIndex
CREATE INDEX "GameTagSource_gameId_source_idx" ON "GameTagSource"("gameId", "source");

-- CreateIndex
CREATE INDEX "GameTagSource_tagId_source_idx" ON "GameTagSource"("tagId", "source");

-- AddForeignKey
ALTER TABLE "TagAlias" ADD CONSTRAINT "TagAlias_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VndbTag" ADD CONSTRAINT "VndbTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "Tag"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVndbTag" ADD CONSTRAINT "GameVndbTag_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameVndbTag" ADD CONSTRAINT "GameVndbTag_vndbTagId_fkey" FOREIGN KEY ("vndbTagId") REFERENCES "VndbTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GameTagSource" ADD CONSTRAINT "GameTagSource_gameId_tagId_fkey" FOREIGN KEY ("gameId", "tagId") REFERENCES "GameTag"("gameId", "tagId") ON DELETE CASCADE ON UPDATE CASCADE;
