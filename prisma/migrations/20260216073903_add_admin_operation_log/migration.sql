-- CreateTable
CREATE TABLE "AdminOperationLog" (
    "id" SERIAL NOT NULL,
    "adminId" INTEGER NOT NULL,
    "action" VARCHAR(100) NOT NULL,
    "targetType" VARCHAR(50),
    "targetId" INTEGER,
    "content" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminOperationLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdminOperationLog_adminId_createdAt_idx" ON "AdminOperationLog"("adminId", "createdAt");

-- CreateIndex
CREATE INDEX "AdminOperationLog_targetType_targetId_idx" ON "AdminOperationLog"("targetType", "targetId");

-- AddForeignKey
ALTER TABLE "AdminOperationLog" ADD CONSTRAINT "AdminOperationLog_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
