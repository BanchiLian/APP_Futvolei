-- AlterTable
ALTER TABLE "users" ADD COLUMN     "username" VARCHAR(30);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");


-- Usernames are compared case-insensitively because every write lowercases them
-- (see usernameSchema). This makes forgetting that normalisation a hard error.
ALTER TABLE "users" ADD CONSTRAINT "users_username_lowercase_check" CHECK ("username" IS NULL OR "username" = lower("username"));
