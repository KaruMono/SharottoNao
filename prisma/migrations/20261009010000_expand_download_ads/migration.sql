ALTER TABLE "Advertisement" ADD COLUMN "showOnMobile" BOOLEAN NOT NULL DEFAULT true;

-- Preserve existing 4:3 creatives in the left slot; download_top is now a wide banner.
UPDATE "Advertisement" SET "slot" = 'download_left' WHERE "slot" = 'download_top';
