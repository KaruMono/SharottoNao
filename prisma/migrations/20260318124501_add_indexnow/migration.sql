-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IndexNowSubmissionStatus') THEN
    CREATE TYPE "IndexNowSubmissionStatus" AS ENUM ('SUCCESS', 'FAILED');
  END IF;
END $$;

-- CreateEnum
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'IndexNowSubmissionType') THEN
    CREATE TYPE "IndexNowSubmissionType" AS ENUM ('ADD', 'UPDATE', 'DELETE');
  END IF;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "IndexNowSubmission" (
    "id" SERIAL NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "status" "IndexNowSubmissionStatus" NOT NULL,
    "type" "IndexNowSubmissionType" NOT NULL,
    "errorMessage" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndexNowSubmission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "IndexNowSetting" (
    "id" SERIAL NOT NULL,
    "apiKey" VARCHAR(255) NOT NULL,
    "autoSubmissionEnabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IndexNowSetting_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IndexNowSubmission_status_submittedAt_idx" ON "IndexNowSubmission"("status", "submittedAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IndexNowSubmission_url_idx" ON "IndexNowSubmission"("url");
