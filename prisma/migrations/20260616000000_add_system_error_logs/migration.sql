CREATE TABLE IF NOT EXISTS "SystemErrorLog" (
  "id" SERIAL PRIMARY KEY,
  "type" VARCHAR(50) NOT NULL,
  "source" VARCHAR(100),
  "message" TEXT NOT NULL,
  "detail" TEXT,
  "metadata" JSONB,
  "isRead" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "SystemErrorLog_isRead_createdAt_idx" ON "SystemErrorLog"("isRead", "createdAt");
CREATE INDEX IF NOT EXISTS "SystemErrorLog_type_createdAt_idx" ON "SystemErrorLog"("type", "createdAt");
