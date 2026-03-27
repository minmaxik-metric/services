-- CreateTable
CREATE TABLE "scoring_profiles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "algorithm_version" TEXT NOT NULL,
    "category_weights" JSONB NOT NULL DEFAULT '{}',
    "metric_weights" JSONB NOT NULL DEFAULT '{}',
    "optimal_ranges" JSONB NOT NULL DEFAULT '{}',
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "scoring_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_runs" (
    "id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "repository_id" TEXT,
    "bucket" TIMESTAMPTZ(3) NOT NULL,
    "period" TEXT NOT NULL,
    "scoring_profile_id" TEXT,
    "algorithm_version" TEXT NOT NULL,
    "weights" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL,
    "error" TEXT,
    "started_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" TIMESTAMPTZ(3),

    CONSTRAINT "score_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" TEXT NOT NULL,
    "score_run_id" TEXT NOT NULL,
    "scoring_profile_id" TEXT,
    "subject_type" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "subject_label" TEXT NOT NULL,
    "bucket" TIMESTAMPTZ(3) NOT NULL,
    "period" TEXT NOT NULL,
    "score" DECIMAL(8,4) NOT NULL,
    "rank" INTEGER NOT NULL,
    "activity_score" DECIMAL(8,4) NOT NULL,
    "productivity_score" DECIMAL(8,4) NOT NULL,
    "communication_score" DECIMAL(8,4) NOT NULL,
    "quality_score" DECIMAL(8,4) NOT NULL,
    "flow_score" DECIMAL(8,4) NOT NULL,
    "repository_health_score" DECIMAL(8,4) NOT NULL,
    "confidence_score" DECIMAL(8,4) NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "raw_metrics" JSONB NOT NULL DEFAULT '{}',
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "score_components" (
    "id" TEXT NOT NULL,
    "rating_id" TEXT NOT NULL,
    "score_run_id" TEXT NOT NULL,
    "subject_type" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "bucket" TIMESTAMPTZ(3) NOT NULL,
    "period" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "raw_value" DOUBLE PRECISION NOT NULL,
    "normalized_value" DOUBLE PRECISION NOT NULL,
    "weight" DOUBLE PRECISION NOT NULL,
    "weighted_score" DOUBLE PRECISION NOT NULL,
    "direction" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "score_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "metric_stats" (
    "id" TEXT NOT NULL,
    "score_run_id" TEXT NOT NULL,
    "scoring_profile_id" TEXT,
    "subject_type" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "repository_id" TEXT NOT NULL,
    "bucket" TIMESTAMPTZ(3) NOT NULL,
    "period" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "sample_count" INTEGER NOT NULL,
    "min_value" DOUBLE PRECISION NOT NULL,
    "p05_value" DOUBLE PRECISION NOT NULL,
    "p50_value" DOUBLE PRECISION NOT NULL,
    "p95_value" DOUBLE PRECISION NOT NULL,
    "max_value" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "metric_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scoring_profiles_subject_type_status_is_default_idx" ON "scoring_profiles"("subject_type", "status", "is_default");

-- CreateIndex
CREATE INDEX "score_runs_subject_type_organization_id_repository_id_bucke_idx" ON "score_runs"("subject_type", "organization_id", "repository_id", "bucket" DESC, "period");

-- CreateIndex
CREATE INDEX "ratings_leaderboard_idx" ON "ratings"("subject_type", "organization_id", "repository_id", "bucket" DESC, "period", "rank");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_identity_key" ON "ratings"("scoring_profile_id", "subject_type", "organization_id", "repository_id", "subject_id", "bucket", "period");

-- CreateIndex
CREATE INDEX "score_components_rating_idx" ON "score_components"("rating_id");

-- CreateIndex
CREATE INDEX "score_components_lookup_idx" ON "score_components"("subject_type", "organization_id", "repository_id", "subject_id", "bucket" DESC, "period");

-- CreateIndex
CREATE UNIQUE INDEX "metric_stats_identity_key" ON "metric_stats"("scoring_profile_id", "subject_type", "organization_id", "repository_id", "bucket", "period", "metric");

-- AddForeignKey
ALTER TABLE "score_runs" ADD CONSTRAINT "score_runs_scoring_profile_id_fkey" FOREIGN KEY ("scoring_profile_id") REFERENCES "scoring_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_score_run_id_fkey" FOREIGN KEY ("score_run_id") REFERENCES "score_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_scoring_profile_id_fkey" FOREIGN KEY ("scoring_profile_id") REFERENCES "scoring_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_components" ADD CONSTRAINT "score_components_rating_id_fkey" FOREIGN KEY ("rating_id") REFERENCES "ratings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "score_components" ADD CONSTRAINT "score_components_score_run_id_fkey" FOREIGN KEY ("score_run_id") REFERENCES "score_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_stats" ADD CONSTRAINT "metric_stats_score_run_id_fkey" FOREIGN KEY ("score_run_id") REFERENCES "score_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "metric_stats" ADD CONSTRAINT "metric_stats_scoring_profile_id_fkey" FOREIGN KEY ("scoring_profile_id") REFERENCES "scoring_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
