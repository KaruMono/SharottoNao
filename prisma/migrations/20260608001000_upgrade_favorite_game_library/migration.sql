ALTER TABLE "Favorite" ADD COLUMN "note" TEXT;
ALTER TABLE "Favorite" ADD COLUMN "startedAt" TIMESTAMP(3);
ALTER TABLE "Favorite" ADD COLUMN "completedAt" TIMESTAMP(3);
ALTER TABLE "Favorite" ADD COLUMN "statusUpdatedAt" TIMESTAMP(3);

UPDATE "Favorite"
SET "statusUpdatedAt" = "createdAt"
WHERE "statusUpdatedAt" IS NULL;

ALTER TABLE "Favorite" ALTER COLUMN "statusUpdatedAt" SET NOT NULL;
ALTER TABLE "Favorite" ALTER COLUMN "statusUpdatedAt" SET DEFAULT CURRENT_TIMESTAMP;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FavoriteStatus') THEN
    CREATE TYPE "FavoriteStatus" AS ENUM ('WISHLIST', 'PLAYING', 'COMPLETED', 'ON_HOLD', 'DROPPED');
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Favorite' AND column_name = 'status'
  ) THEN
    ALTER TABLE "Favorite" ALTER COLUMN "status" DROP DEFAULT;
    ALTER TABLE "Favorite" ALTER COLUMN "status" TYPE TEXT USING "status"::TEXT;

    UPDATE "Favorite"
    SET "status" = CASE "status"
        WHEN 'NOT_PLAYED' THEN 'WISHLIST'
        WHEN 'PLAYED' THEN 'COMPLETED'
        ELSE "status"
    END;

    IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FavoriteStatus_old') THEN
      DROP TYPE "FavoriteStatus_old";
    END IF;

    IF EXISTS (
      SELECT 1
      FROM pg_type t
      JOIN pg_enum e ON t.oid = e.enumtypid
      WHERE t.typname = 'FavoriteStatus' AND e.enumlabel IN ('NOT_PLAYED', 'PLAYED')
    ) THEN
      ALTER TYPE "FavoriteStatus" RENAME TO "FavoriteStatus_old";
      CREATE TYPE "FavoriteStatus" AS ENUM ('WISHLIST', 'PLAYING', 'COMPLETED', 'ON_HOLD', 'DROPPED');
    END IF;

    ALTER TABLE "Favorite" ALTER COLUMN "status" TYPE "FavoriteStatus" USING "status"::"FavoriteStatus";
  ELSE
    ALTER TABLE "Favorite" ADD COLUMN "status" "FavoriteStatus" NOT NULL DEFAULT 'COMPLETED';
  END IF;

  ALTER TABLE "Favorite" ALTER COLUMN "status" SET DEFAULT 'COMPLETED';

  IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'FavoriteStatus_old') THEN
    DROP TYPE "FavoriteStatus_old";
  END IF;
END $$;

CREATE INDEX "Favorite_userId_status_idx" ON "Favorite"("userId", "status");