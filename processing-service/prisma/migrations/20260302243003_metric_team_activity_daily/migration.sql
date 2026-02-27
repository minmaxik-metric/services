-- Daily team activity metrics by organization/repository.
CREATE MATERIALIZED VIEW "metrics"."metrics_team_activity_daily"
WITH (timescaledb.continuous) AS
SELECT
    public.time_bucket(INTERVAL '1 day', "event_at") AS "bucket",
    "organization_id",
    "repository_id",
    COUNT(*)::BIGINT AS "events_total",
    COUNT(DISTINCT COALESCE(
      NULLIF("payload" -> 'actor' ->> 'id', ''),
      NULLIF("payload" -> 'author' ->> 'id', '')
    ))::BIGINT AS "active_contributors_count",
    ROUND(
      COUNT(*)::NUMERIC / NULLIF(COUNT(DISTINCT COALESCE(
      NULLIF("payload" -> 'actor' ->> 'id', ''),
      NULLIF("payload" -> 'author' ->> 'id', '')
    )), 0),
      4
    ) AS "events_per_active_contributor",
    COUNT(DISTINCT CASE
      WHEN "type" = 'commit.created' THEN NULLIF("payload" -> 'author' ->> 'id', '')
      ELSE NULL
    END)::BIGINT AS "contributors_with_commits_count",
    COUNT(DISTINCT CASE
      WHEN "type" = 'pull_request.reviewed' THEN NULLIF("payload" -> 'actor' ->> 'id', '')
      ELSE NULL
    END)::BIGINT AS "contributors_with_reviews_count",
    COUNT(DISTINCT "type")::BIGINT AS "event_types_covered_count",
    COUNT(DISTINCT public.time_bucket(INTERVAL '1 day', "event_at"))::BIGINT AS "active_days_count",
    ROUND(
      COUNT(DISTINCT public.time_bucket(INTERVAL '1 day', "event_at"))::NUMERIC / 1,
      4
    ) AS "activity_consistency_score"
FROM "metrics"."metric_events"
GROUP BY 1, 2, 3
WITH NO DATA;

CREATE INDEX "metrics_team_activity_daily_bucket_idx"
ON "metrics"."metrics_team_activity_daily" ("bucket" DESC);

CREATE INDEX "metrics_team_activity_daily_org_repo_bucket_idx"
ON "metrics"."metrics_team_activity_daily" ("organization_id", "repository_id", "bucket" DESC);

SELECT public.add_continuous_aggregate_policy(
    'metrics.metrics_team_activity_daily',
    start_offset => INTERVAL '10 years',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '3 minutes'
);


CREATE VIEW "metrics"."metrics_user_activity_daily_with_team_share" AS
SELECT
  u.*,
  ROUND(
    u."events_total"::NUMERIC / NULLIF(t."events_total", 0),
    4
  ) AS "activity_share_in_team"
FROM "metrics"."metrics_user_activity_daily" u
JOIN "metrics"."metrics_team_activity_daily" t
  ON u."bucket" = t."bucket"
 AND u."organization_id" = t."organization_id"
 AND u."repository_id" = t."repository_id";
