-- CreateEnum
CREATE TYPE "ContentEditType" AS ENUM ('GAME', 'COMPANY', 'GUIDE', 'RESOURCE');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('CREATE_GAME', 'EDIT_GAME', 'COMMENT', 'CREATE_GUIDE', 'EDIT_GUIDE', 'RATE_GAME', 'FAVORITE_GAME');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "twoFactorSecret" VARCHAR(255);

-- CreateTable
CREATE TABLE "ContentEdit" (
    "id" SERIAL NOT NULL,
    "targetType" "ContentEditType" NOT NULL,
    "targetId" INTEGER NOT NULL,
    "editorId" INTEGER,
    "snapshot" JSONB NOT NULL,
    "changeSummary" VARCHAR(500),
    "isRevert" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContentEdit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Activity" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "ActivityType" NOT NULL,
    "targetType" VARCHAR(50),
    "targetId" INTEGER,
    "meta" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Activity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ContentEdit_targetType_targetId_idx" ON "ContentEdit"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ContentEdit_editorId_idx" ON "ContentEdit"("editorId");

-- CreateIndex
CREATE INDEX "ContentEdit_createdAt_idx" ON "ContentEdit"("createdAt");

-- CreateIndex
CREATE INDEX "Activity_userId_createdAt_idx" ON "Activity"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_targetType_targetId_createdAt_idx" ON "Activity"("targetType", "targetId", "createdAt");

-- CreateIndex
CREATE INDEX "Activity_createdAt_idx" ON "Activity"("createdAt");

-- AddForeignKey
ALTER TABLE "ContentEdit" ADD CONSTRAINT "ContentEdit_editorId_fkey" FOREIGN KEY ("editorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Activity" ADD CONSTRAINT "Activity_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
