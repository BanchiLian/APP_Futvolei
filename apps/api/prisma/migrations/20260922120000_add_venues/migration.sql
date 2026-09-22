-- Training centres (CTs). The system moves from a single arena to a network of
-- CTs, each running its own grid of aulas and dayuses (ADR-25).

-- CreateTable
CREATE TABLE "venues" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "description" VARCHAR(1000),
    "address" VARCHAR(255) NOT NULL,
    "city" VARCHAR(80) NOT NULL,
    "state" CHAR(2) NOT NULL,
    "latitude" DECIMAL(9,6) NOT NULL,
    "longitude" DECIMAL(9,6) NOT NULL,
    "phone" VARCHAR(11),
    "instagram" VARCHAR(60),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "venues_is_active_idx" ON "venues"("is_active");

ALTER TABLE "venues" ADD CONSTRAINT "venues_latitude_range_check" CHECK ("latitude" BETWEEN -90 AND 90);
ALTER TABLE "venues" ADD CONSTRAINT "venues_longitude_range_check" CHECK ("longitude" BETWEEN -180 AND 180);
ALTER TABLE "venues" ADD CONSTRAINT "venues_state_format_check" CHECK ("state" ~ '^[A-Z]{2}$');
ALTER TABLE "venues" ADD CONSTRAINT "venues_phone_digits_check" CHECK ("phone" IS NULL OR "phone" ~ '^[0-9]{10,11}$');

-- Existing grids and sessions predate CTs and all belonged to the one arena.
-- Adding venue_id as NOT NULL straight away would fail on those rows, so the
-- column starts nullable, the rows are attached to a placeholder CT, and only
-- then is the constraint tightened. The placeholder is only created when there is
-- something to attach, and an admin is expected to edit its address.
ALTER TABLE "schedule_templates" ADD COLUMN "venue_id" UUID;
ALTER TABLE "sessions" ADD COLUMN "venue_id" UUID;

INSERT INTO "venues" ("id", "name", "address", "city", "state", "latitude", "longitude", "updated_at")
SELECT '01990000-0000-7000-8000-000000000001', 'Arena principal', 'Endereço a definir', 'São Paulo', 'SP', -23.550520, -46.633308, CURRENT_TIMESTAMP
WHERE EXISTS (SELECT 1 FROM "schedule_templates") OR EXISTS (SELECT 1 FROM "sessions");

UPDATE "schedule_templates" SET "venue_id" = '01990000-0000-7000-8000-000000000001' WHERE "venue_id" IS NULL;
UPDATE "sessions" SET "venue_id" = '01990000-0000-7000-8000-000000000001' WHERE "venue_id" IS NULL;

ALTER TABLE "schedule_templates" ALTER COLUMN "venue_id" SET NOT NULL;
ALTER TABLE "sessions" ALTER COLUMN "venue_id" SET NOT NULL;

CREATE INDEX "schedule_templates_venue_id_type_is_active_idx" ON "schedule_templates"("venue_id", "type", "is_active");
CREATE INDEX "sessions_venue_id_starts_at_idx" ON "sessions"("venue_id", "starts_at");

ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Community directory: the member controls whether they appear (LGPD, ADR-26).
ALTER TABLE "users" ADD COLUMN "show_in_community" BOOLEAN NOT NULL DEFAULT true;
