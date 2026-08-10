-- AlterTable: 记录下载时的资源大小快照（MB），用于首页流量统计
ALTER TABLE "DownloadRecord" ADD COLUMN IF NOT EXISTS "sizeMb" INTEGER NOT NULL DEFAULT 0;

-- 回填历史记录：从 Resource.fileSize 字符串（如 "1.2G"、"800M"）解析出 MB
UPDATE "DownloadRecord" d
SET "sizeMb" = sub."sizeMb"
FROM (
  SELECT
    r."id",
    CASE
      WHEN UPPER(SUBSTRING(r."fileSize" FROM '[A-Za-z]+$')) LIKE 'T%'
        THEN ROUND((SUBSTRING(r."fileSize" FROM '^[0-9.]+'))::numeric * 1024 * 1024)
      WHEN UPPER(SUBSTRING(r."fileSize" FROM '[A-Za-z]+$')) LIKE 'G%'
        THEN ROUND((SUBSTRING(r."fileSize" FROM '^[0-9.]+'))::numeric * 1024)
      WHEN UPPER(SUBSTRING(r."fileSize" FROM '[A-Za-z]+$')) LIKE 'K%'
        THEN ROUND((SUBSTRING(r."fileSize" FROM '^[0-9.]+'))::numeric / 1024)
      ELSE ROUND((SUBSTRING(r."fileSize" FROM '^[0-9.]+'))::numeric)
    END::int AS "sizeMb"
  FROM "Resource" r
  WHERE r."fileSize" ~ '^[0-9.]+\s*[A-Za-z]+$'
) sub
WHERE d."resourceId" = sub."id" AND d."sizeMb" = 0;

-- CreateIndex: 首页今日/近一周流量按时间范围聚合
CREATE INDEX IF NOT EXISTS "DownloadRecord_createdAt_idx" ON "DownloadRecord"("createdAt");
