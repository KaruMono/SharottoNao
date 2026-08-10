-- AlterTable: add platform column to Resource
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(20);
