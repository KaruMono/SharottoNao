-- Persist VNDB's tag category so adult-content classification remains
-- auditable after the upstream response has been processed.
ALTER TABLE "VndbTag" ADD COLUMN "category" VARCHAR(10);

CREATE INDEX "VndbTag_category_idx" ON "VndbTag"("category");
