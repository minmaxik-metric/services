-- Daily individual activity metrics by organization/repository/contributor.
CREATE MATERIALIZED VIEW "metrics"."metrics_user_activity_daily"
WITH (timescaledb.continuous) AS
SELECT
    public.time_bucket(INTERVAL '1 day', "event_at") AS "bucket",
    "organization_id",
    "repository_id",
    COALESCE(
      NULLIF("payload" -> 'actor' ->> 'id', ''),
      NULLIF("payload" -> 'author' ->> 'id', '')
    ) AS "contributor_id",
    MAX(COALESCE(
      NULLIF("payload" -> 'actor' ->> 'login', ''),
      NULLIF("payload" -> 'author' ->> 'login', '')
    )) AS "contributor_login",
    COUNT(*)::BIGINT AS "events_total",
    COUNT(DISTINCT "type")::BIGINT AS "event_types_covered_count",
    COUNT(DISTINCT public.time_bucket(INTERVAL '1 day', "event_at"))::BIGINT AS "active_days_count",
    ROUND(
      COUNT(DISTINCT public.time_bucket(INTERVAL '1 day', "event_at"))::NUMERIC / 1,
      4
    ) AS "activity_consistency_score"
FROM "metrics"."metric_events"
WHERE COALESCE(
      NULLIF("payload" -> 'actor' ->> 'id', ''),
      NULLIF("payload" -> 'author' ->> 'id', '')
    ) IS NOT NULL
GROUP BY 1, 2, 3, 4
WITH NO DATA;

CREATE INDEX "metrics_user_activity_daily_bucket_idx"
ON "metrics"."metrics_user_activity_daily" ("bucket" DESC);

CREATE INDEX "metrics_user_activity_daily_org_repo_user_bucket_idx"
ON "metrics"."metrics_user_activity_daily" (
  "organization_id",
  "repository_id",
  "contributor_id",
  "bucket" DESC
);

SELECT public.add_continuous_aggregate_policy(
    'metrics.metrics_user_activity_daily',
    start_offset => INTERVAL '10 years',
    end_offset => INTERVAL '1 hour',
    schedule_interval => INTERVAL '3 minutes'
);
