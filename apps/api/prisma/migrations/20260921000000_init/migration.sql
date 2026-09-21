-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'PROFESSOR', 'ALUNO', 'DAYUSE');

-- CreateEnum
CREATE TYPE "SessionType" AS ENUM ('AULA', 'DAYUSE');

-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('ABERTA', 'CANCELADA', 'ENCERRADA');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('CONFIRMADA', 'NAO_VOU', 'LISTA_ESPERA', 'CANCELADA_PELA_ARENA', 'PRESENTE', 'FALTOU');

-- CreateEnum
CREATE TYPE "SkillLevel" AS ENUM ('INICIANTE', 'INTERMEDIARIO', 'AVANCADO');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(11) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'DAYUSE',
    "avatar_url" VARCHAR(500),
    "avatar_thumbnail_url" VARCHAR(500),
    "birth_date" DATE,
    "skill_level" "SkillLevel",
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "terms_accepted_at" TIMESTAMPTZ(3),
    "last_login_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "revoked_at" TIMESTAMPTZ(3),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token_hash" VARCHAR(255) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_templates" (
    "id" UUID NOT NULL,
    "type" "SessionType" NOT NULL,
    "weekday" SMALLINT NOT NULL,
    "start_time" VARCHAR(5) NOT NULL,
    "end_time" VARCHAR(5) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "responsible_id" UUID,
    "title" VARCHAR(120),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "schedule_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" UUID NOT NULL,
    "template_id" UUID,
    "type" "SessionType" NOT NULL,
    "starts_at" TIMESTAMPTZ(3) NOT NULL,
    "ends_at" TIMESTAMPTZ(3) NOT NULL,
    "capacity" INTEGER NOT NULL,
    "responsible_id" UUID,
    "title" VARCHAR(120),
    "status" "SessionStatus" NOT NULL DEFAULT 'ABERTA',
    "cancel_reason" VARCHAR(255),
    "cancelled_at" TIMESTAMPTZ(3),
    "created_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bookings" (
    "id" UUID NOT NULL,
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "status" "BookingStatus" NOT NULL,
    "waitlist_position" INTEGER,
    "is_walk_in" BOOLEAN NOT NULL DEFAULT false,
    "responded_at" TIMESTAMPTZ(3),
    "checked_in_at" TIMESTAMPTZ(3),
    "checked_in_by" UUID,
    "notes" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "bookings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" VARCHAR(100) NOT NULL,
    "value" JSONB NOT NULL,
    "updated_by" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" UUID NOT NULL,
    "actor_id" UUID,
    "action" VARCHAR(100) NOT NULL,
    "entity" VARCHAR(60) NOT NULL,
    "entity_id" VARCHAR(64),
    "metadata" JSONB,
    "ip" VARCHAR(64),
    "user_agent" VARCHAR(255),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_role_is_active_idx" ON "users"("role", "is_active");

-- CreateIndex
CREATE INDEX "users_deleted_at_idx" ON "users"("deleted_at");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "refresh_tokens_user_id_revoked_at_idx" ON "refresh_tokens"("user_id", "revoked_at");

-- CreateIndex
CREATE INDEX "refresh_tokens_expires_at_idx" ON "refresh_tokens"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "password_reset_tokens_token_hash_key" ON "password_reset_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "password_reset_tokens_user_id_idx" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "password_reset_tokens_expires_at_idx" ON "password_reset_tokens"("expires_at");

-- CreateIndex
CREATE INDEX "schedule_templates_type_weekday_is_active_idx" ON "schedule_templates"("type", "weekday", "is_active");

-- CreateIndex
CREATE INDEX "schedule_templates_responsible_id_idx" ON "schedule_templates"("responsible_id");

-- CreateIndex
CREATE INDEX "sessions_starts_at_type_idx" ON "sessions"("starts_at", "type");

-- CreateIndex
CREATE INDEX "sessions_status_starts_at_idx" ON "sessions"("status", "starts_at");

-- CreateIndex
CREATE INDEX "sessions_responsible_id_starts_at_idx" ON "sessions"("responsible_id", "starts_at");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_template_slot_key" ON "sessions"("template_id", "starts_at");

-- CreateIndex
CREATE INDEX "bookings_user_id_idx" ON "bookings"("user_id");

-- CreateIndex
CREATE INDEX "bookings_session_id_status_idx" ON "bookings"("session_id", "status");

-- CreateIndex
CREATE INDEX "bookings_user_id_status_idx" ON "bookings"("user_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "bookings_session_id_user_id_key" ON "bookings"("session_id", "user_id");

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "audit_logs"("actor_id", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entity_id_idx" ON "audit_logs"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_logs_action_created_at_idx" ON "audit_logs"("action", "created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "audit_logs"("created_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "schedule_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_responsible_id_fkey" FOREIGN KEY ("responsible_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_checked_in_by_fkey" FOREIGN KEY ("checked_in_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- =============================================================================
-- Guarantees Prisma cannot express, added as raw SQL.
-- These are invariants, not validations: the application also checks them, but
-- the database is what makes them impossible to violate — including under a race.
-- =============================================================================

-- There is exactly ONE super admin (section 4.1). Prisma cannot generate a
-- partial index, so this is the database-level cap on the role. A second insert
-- fails even if two processes run the creation script simultaneously.
CREATE UNIQUE INDEX "users_one_super_admin_key" ON "users" ("role") WHERE "role" = 'SUPER_ADMIN';

-- E-mail uniqueness is case-insensitive because every write normalises to
-- lowercase (ADR-07). This makes forgetting that normalisation a hard error.
ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase_check" CHECK ("email" = lower("email"));
ALTER TABLE "users" ADD CONSTRAINT "users_phone_digits_check" CHECK ("phone" ~ '^[0-9]{10,11}$');

-- Schedule templates: HH:mm wall-clock times in the business timezone (ADR-06).
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_start_time_format_check" CHECK ("start_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_end_time_format_check" CHECK ("end_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$');
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_time_order_check" CHECK ("end_time" > "start_time");
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_weekday_check" CHECK ("weekday" BETWEEN 0 AND 6);
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_capacity_check" CHECK ("capacity" > 0);

-- An AULA always has a responsible professor; a DAYUSE may not have one (section 5).
ALTER TABLE "schedule_templates" ADD CONSTRAINT "schedule_templates_aula_responsible_check" CHECK ("type" <> 'AULA' OR "responsible_id" IS NOT NULL);

-- Sessions.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_time_order_check" CHECK ("ends_at" > "starts_at");
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_capacity_check" CHECK ("capacity" > 0);

-- A cancellation always carries its reason, so the app can tell the user why.
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_cancel_reason_check" CHECK ("status" <> 'CANCELADA' OR "cancel_reason" IS NOT NULL);

-- A waitlist position exists if and only if the booking is on the waitlist.
-- Promoting someone must clear it; this makes a forgotten clear impossible.
ALTER TABLE "bookings" ADD CONSTRAINT "bookings_waitlist_position_check" CHECK (
    ("status" = 'LISTA_ESPERA' AND "waitlist_position" IS NOT NULL AND "waitlist_position" > 0)
    OR ("status" <> 'LISTA_ESPERA' AND "waitlist_position" IS NULL)
);
