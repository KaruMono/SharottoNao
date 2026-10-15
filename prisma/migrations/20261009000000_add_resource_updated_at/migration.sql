-- 仅记录资源内容更新时间，避免下载计数、审核和可用性检查刷新首页排序。
ALTER TABLE "Resource" ADD COLUMN "updatedAt" TIMESTAMP(3);

-- 旧资源没有独立的编辑时间，沿用上传时间，避免迁移时全部置顶。
UPDATE "Resource" SET "updatedAt" = "createdAt";

ALTER TABLE "Resource" ALTER COLUMN "updatedAt" SET DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE "Resource" ALTER COLUMN "updatedAt" SET NOT NULL;

CREATE INDEX "Resource_status_deletedAt_updatedAt_idx" ON "Resource"("status", "deletedAt", "updatedAt");
