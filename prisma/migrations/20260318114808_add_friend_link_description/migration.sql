-- DropForeignKey
ALTER TABLE IF EXISTS "GameEdit" DROP CONSTRAINT IF EXISTS "GameEdit_gameId_fkey";

-- DropForeignKey
ALTER TABLE IF EXISTS "GameEdit" DROP CONSTRAINT IF EXISTS "GameEdit_userId_fkey";

-- AlterTable
ALTER TABLE "FriendLink" ADD COLUMN IF NOT EXISTS "description" VARCHAR(255);

-- AlterTable
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "fileSize" VARCHAR(20);
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "isMachineTranslated" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Resource" ADD COLUMN IF NOT EXISTS "language" VARCHAR(20);

-- DropTable
DROP TABLE IF EXISTS "GameEdit";
