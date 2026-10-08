-- Who runs a CT.
--
-- Authority over a training centre is held per CT, not account-wide: an owner
-- commands theirs and nothing else. Only the super admin is global.
CREATE TYPE "VenueRole" AS ENUM ('OWNER', 'PROFESSOR');

CREATE TABLE "venue_members" (
  "id"         UUID         NOT NULL,
  "venue_id"   UUID         NOT NULL,
  "user_id"    UUID         NOT NULL,
  "role"       "VenueRole"  NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,

  CONSTRAINT "venue_members_pkey" PRIMARY KEY ("id")
);

-- One role per person per CT: promoting someone updates the row instead of
-- leaving them holding two different kinds of authority at once.
CREATE UNIQUE INDEX "venue_members_venue_id_user_id_key" ON "venue_members"("venue_id", "user_id");
CREATE INDEX "venue_members_user_id_idx" ON "venue_members"("user_id");

ALTER TABLE "venue_members"
  ADD CONSTRAINT "venue_members_venue_id_fkey" FOREIGN KEY ("venue_id")
  REFERENCES "venues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "venue_members"
  ADD CONSTRAINT "venue_members_user_id_fkey" FOREIGN KEY ("user_id")
  REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
