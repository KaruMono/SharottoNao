-- AlterTable: add title and titleColor columns to User
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "title" VARCHAR(50);
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "titleColor" VARCHAR(20);
