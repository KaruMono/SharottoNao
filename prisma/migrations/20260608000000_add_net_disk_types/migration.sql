CREATE TABLE "NetDiskType" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(100),
    "domains" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NetDiskType_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NetDiskType_name_key" ON "NetDiskType"("name");
CREATE INDEX "NetDiskType_isActive_sortOrder_idx" ON "NetDiskType"("isActive", "sortOrder");

ALTER TABLE "Resource" ADD COLUMN "netDiskTypeId" INTEGER;
CREATE INDEX "Resource_netDiskTypeId_idx" ON "Resource"("netDiskTypeId");

ALTER TABLE "Resource" ADD CONSTRAINT "Resource_netDiskTypeId_fkey" FOREIGN KEY ("netDiskTypeId") REFERENCES "NetDiskType"("id") ON DELETE SET NULL ON UPDATE CASCADE;