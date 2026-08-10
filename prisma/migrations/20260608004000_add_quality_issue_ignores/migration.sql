CREATE TABLE "QualityIssueIgnore" (
    "id" SERIAL NOT NULL,
    "checkKey" VARCHAR(100) NOT NULL,
    "targetType" VARCHAR(50) NOT NULL,
    "targetId" INTEGER NOT NULL,
    "reason" TEXT,
    "adminId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QualityIssueIgnore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QualityIssueIgnore_checkKey_targetType_targetId_key" ON "QualityIssueIgnore"("checkKey", "targetType", "targetId");
CREATE INDEX "QualityIssueIgnore_checkKey_targetType_idx" ON "QualityIssueIgnore"("checkKey", "targetType");
CREATE INDEX "QualityIssueIgnore_adminId_createdAt_idx" ON "QualityIssueIgnore"("adminId", "createdAt");

ALTER TABLE "QualityIssueIgnore" ADD CONSTRAINT "QualityIssueIgnore_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;