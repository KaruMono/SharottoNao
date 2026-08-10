ALTER TYPE "ReportType" ADD VALUE IF NOT EXISTS 'GUIDE';

ALTER TABLE "Guide" ADD COLUMN "likeCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "GuideLike" (
    "id" SERIAL NOT NULL,
    "guideId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuideLike_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GuideLike_guideId_userId_key" ON "GuideLike"("guideId", "userId");
CREATE INDEX "GuideLike_guideId_idx" ON "GuideLike"("guideId");
CREATE INDEX "GuideLike_userId_idx" ON "GuideLike"("userId");

ALTER TABLE "GuideLike" ADD CONSTRAINT "GuideLike_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GuideLike" ADD CONSTRAINT "GuideLike_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Report" ADD COLUMN "guideId" INTEGER;
ALTER TABLE "Report" ADD CONSTRAINT "Report_guideId_fkey" FOREIGN KEY ("guideId") REFERENCES "Guide"("id") ON DELETE CASCADE ON UPDATE CASCADE;
