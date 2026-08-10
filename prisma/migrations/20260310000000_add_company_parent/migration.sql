-- AlterTable: add parentId to Company for parent-child relationship
ALTER TABLE "Company" ADD COLUMN "parentId" INTEGER;

-- AddForeignKey
ALTER TABLE "Company" ADD CONSTRAINT "Company_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
