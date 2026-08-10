CREATE TYPE "ResourceHealthStatus" AS ENUM ('AVAILABLE', 'NEEDS_REVIEW', 'SUSPECTED_BAD', 'UNAVAILABLE');
CREATE TYPE "ResourceHealthFeedbackType" AS ENUM ('LINK_EXPIRED', 'WRONG_PASSWORD', 'VERSION_OUTDATED', 'MALICIOUS', 'OTHER');

ALTER TABLE "Resource" ADD COLUMN "healthStatus" "ResourceHealthStatus" NOT NULL DEFAULT 'AVAILABLE';
ALTER TABLE "Resource" ADD COLUMN "healthNote" TEXT;
ALTER TABLE "Resource" ADD COLUMN "healthCheckedAt" TIMESTAMP(3);
ALTER TABLE "Resource" ADD COLUMN "issueCount" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "ResourceHealthFeedback" (
    "id" SERIAL NOT NULL,
    "resourceId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" "ResourceHealthFeedbackType" NOT NULL,
    "detail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ResourceHealthFeedback_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Resource_healthStatus_idx" ON "Resource"("healthStatus");
CREATE INDEX "ResourceHealthFeedback_resourceId_idx" ON "ResourceHealthFeedback"("resourceId");
CREATE INDEX "ResourceHealthFeedback_userId_idx" ON "ResourceHealthFeedback"("userId");
CREATE INDEX "ResourceHealthFeedback_type_idx" ON "ResourceHealthFeedback"("type");

ALTER TABLE "ResourceHealthFeedback" ADD CONSTRAINT "ResourceHealthFeedback_resourceId_fkey" FOREIGN KEY ("resourceId") REFERENCES "Resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ResourceHealthFeedback" ADD CONSTRAINT "ResourceHealthFeedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;