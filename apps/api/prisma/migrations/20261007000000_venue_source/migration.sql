-- Where a CT came from, so a re-import updates instead of duplicating, and so the
-- source can be credited. OpenStreetMap data is ODbL: using it requires attribution.
ALTER TABLE "venues" ADD COLUMN "source" VARCHAR(20) NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "venues" ADD COLUMN "external_id" VARCHAR(60);

ALTER TABLE "venues"
  ADD CONSTRAINT "venues_source_check" CHECK ("source" IN ('MANUAL', 'OSM'));

-- An imported row must carry its id at the source; a hand-typed one must not.
ALTER TABLE "venues"
  ADD CONSTRAINT "venues_external_id_check"
  CHECK (("source" = 'MANUAL' AND "external_id" IS NULL) OR ("source" <> 'MANUAL' AND "external_id" IS NOT NULL));

-- NULLs do not collide in Postgres, so this constrains imported rows only.
CREATE UNIQUE INDEX "venues_source_external_id_key" ON "venues"("source", "external_id");
