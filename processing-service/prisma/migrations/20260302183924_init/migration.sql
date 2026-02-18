-- CreateEnum
CREATE TYPE "Provider" AS ENUM ('GITHUB');

-- CreateEnum
CREATE TYPE "Season" AS ENUM ('AUTUMN', 'SPRING');

-- CreateEnum
CREATE TYPE "SemesterAssignmentType" AS ENUM ('ORGANIZATION', 'REPO', 'USER');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'GITHUB',
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "avatar_url" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repositories" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'GITHUB',
    "external_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "url" TEXT NOT NULL,
    "organization_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "last_synced_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "repositories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'GITHUB',
    "external_id" TEXT NOT NULL,
    "login" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "repository_memberships" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "joined_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "repository_memberships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_events" (
    "id" TEXT NOT NULL,
    "provider" "Provider" NOT NULL DEFAULT 'GITHUB',
    "type" TEXT NOT NULL,
    "event_at" TIMESTAMPTZ(3) NOT NULL,
    "published_at" TIMESTAMPTZ(3) NOT NULL,
    "ingested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "organization_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "payload" JSONB NOT NULL,

    CONSTRAINT "metric_events_pkey" PRIMARY KEY ("id","event_at")
);

-- CreateTable
CREATE TABLE "semesters" (
    "id" TEXT NOT NULL,
    "season" "Season" NOT NULL,
    "year" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "start_date" TIMESTAMPTZ(3) NOT NULL,
    "end_date" TIMESTAMPTZ(3) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "semesters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "semesters_assignments" (
    "id" TEXT NOT NULL,
    "type" "SemesterAssignmentType" NOT NULL,
    "subject_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,
    "semester_id" TEXT NOT NULL,

    CONSTRAINT "semesters_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_provider_external_id_key" ON "organizations"("provider", "external_id");

-- CreateIndex
CREATE INDEX "repositories_organization_id_idx" ON "repositories"("organization_id");

-- CreateIndex
CREATE INDEX "repositories_created_at_idx" ON "repositories"("created_at");

-- CreateIndex
CREATE INDEX "repositories_last_synced_at_idx" ON "repositories"("last_synced_at");

-- CreateIndex
CREATE UNIQUE INDEX "repositories_provider_external_id_key" ON "repositories"("provider", "external_id");

-- CreateIndex
CREATE INDEX "users_provider_login_idx" ON "users"("provider", "login");

-- CreateIndex
CREATE UNIQUE INDEX "users_provider_external_id_key" ON "users"("provider", "external_id");

-- CreateIndex
CREATE INDEX "repository_memberships_repository_id_idx" ON "repository_memberships"("repository_id");

-- CreateIndex
CREATE UNIQUE INDEX "repository_memberships_user_id_repository_id_key" ON "repository_memberships"("user_id", "repository_id");

-- CreateIndex
CREATE INDEX "metric_events_id_idx" ON "metric_events"("id");

-- CreateIndex
CREATE INDEX "metric_events_event_at_idx" ON "metric_events"("event_at" DESC);

-- CreateIndex
CREATE INDEX "metric_events_type_event_at_idx" ON "metric_events"("type", "event_at" DESC);

-- CreateIndex
CREATE INDEX "metric_events_organization_id_event_at_idx" ON "metric_events"("organization_id", "event_at" DESC);

-- CreateIndex
CREATE INDEX "metric_events_repository_id_event_at_idx" ON "metric_events"("repository_id", "event_at" DESC);

-- CreateIndex
CREATE INDEX "metric_events_published_at_idx" ON "metric_events"("published_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "semesters_season_year_key" ON "semesters"("season", "year");

-- CreateIndex
CREATE UNIQUE INDEX "semesters_assignments_semester_id_type_subject_id_key" ON "semesters_assignments"("semester_id", "type", "subject_id");

-- AddForeignKey
ALTER TABLE "repositories" ADD CONSTRAINT "repositories_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_memberships" ADD CONSTRAINT "repository_memberships_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "repository_memberships" ADD CONSTRAINT "repository_memberships_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_events" ADD CONSTRAINT "metric_events_organization_id_fkey" FOREIGN KEY ("organization_id") REFERENCES "organizations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_events" ADD CONSTRAINT "metric_events_repository_id_fkey" FOREIGN KEY ("repository_id") REFERENCES "repositories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "semesters_assignments" ADD CONSTRAINT "semesters_assignments_semester_id_fkey" FOREIGN KEY ("semester_id") REFERENCES "semesters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
