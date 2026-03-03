-- Daily individual productivity metrics by organization/repository/contributor.
CREATE VIEW "metrics"."metrics_user_productivity_daily" AS
WITH event_metrics AS (
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
        SUM((
            COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'additions', '')::INT, 0)
          ))::BIGINT AS "code_additions",
        SUM((
            COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'deletions', '')::INT, 0)
          ))::BIGINT AS "code_deletions",
        SUM((
            COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'additions', '')::INT, 0)
          ) + (
            COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'deletions', '')::INT, 0)
          ))::BIGINT AS "code_churn",
        (SUM((
            COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'additions', '')::INT, 0)
          )) - SUM((
            COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'deletions', '')::INT, 0)
          )))::BIGINT AS "net_code_change",
        ROUND(
          SUM((
            COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'deletions', '')::INT, 0)
          ))::NUMERIC / NULLIF(SUM((
            COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
            COALESCE(NULLIF("payload" ->> 'additions', '')::INT, 0)
          )), 0),
          4
        ) AS "deletion_to_addition_ratio",
        COUNT(*) FILTER (WHERE "type" = 'commit.created')::BIGINT AS "commits_count",
        COUNT(*) FILTER (WHERE "type" = 'pull_request.created')::BIGINT AS "pull_requests_created_count",
        COUNT(*) FILTER (WHERE "type" = 'pull_request.reviewed')::BIGINT AS "reviews_submitted_count",
        ROUND(
          SUM((
              COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
              COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0)
            ))::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE "type" = 'commit.created'), 0),
          2
        ) AS "avg_commit_size_lines",
        PERCENTILE_CONT(0.5) WITHIN GROUP (
          ORDER BY (
              COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
              COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0)
            )
        ) FILTER (WHERE "type" = 'commit.created') AS "median_commit_size_lines",
        ROUND(
          COUNT(*) FILTER (
            WHERE "type" = 'commit.created'
            AND (
              COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
              COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0)
            ) >= 500
          )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE "type" = 'commit.created'), 0),
          4
        ) AS "large_commit_ratio"
    FROM "metrics"."metric_events"
    WHERE COALESCE(
          NULLIF("payload" -> 'actor' ->> 'id', ''),
          NULLIF("payload" -> 'author' ->> 'id', '')
        ) IS NOT NULL
    GROUP BY 1, 2, 3, 4
),
pull_requests AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        NULLIF(created."payload" -> 'author' ->> 'id', '') AS "contributor_id",
        NULLIF(created."payload" -> 'author' ->> 'login', '') AS "contributor_login",
        (
            COALESCE(NULLIF(created."payload" ->> 'additions', '')::INT, 0)
            + COALESCE(NULLIF(created."payload" ->> 'deletions', '')::INT, 0)
        ) AS "size_lines",
        merged."merged_at",
        review_stats."reviews_before_merge_count"
    FROM "metrics"."metric_events" created
    LEFT JOIN LATERAL (
        SELECT state_changed."event_at" AS "merged_at"
        FROM "metrics"."metric_events" state_changed
        WHERE state_changed."type" = 'pull_request.state_changed'
          AND state_changed."repository_id" = created."repository_id"
          AND NULLIF(state_changed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
          AND state_changed."payload" ->> 'event' = 'merged'
          AND state_changed."event_at" >= created."event_at"
        ORDER BY state_changed."event_at" ASC
        LIMIT 1
    ) merged ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*) FILTER (
                WHERE merged."merged_at" IS NOT NULL
                  AND reviewed."event_at" <= merged."merged_at"
            )::BIGINT AS "reviews_before_merge_count"
        FROM "metrics"."metric_events" reviewed
        WHERE reviewed."type" = 'pull_request.reviewed'
          AND reviewed."repository_id" = created."repository_id"
          AND NULLIF(reviewed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
          AND reviewed."event_at" >= created."event_at"
    ) review_stats ON TRUE
    WHERE created."type" = 'pull_request.created'
      AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
      AND NULLIF(created."payload" -> 'author' ->> 'id', '') IS NOT NULL
),
pull_request_metrics AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        "contributor_id",
        MAX("contributor_login") AS "contributor_login",
        COUNT(*)::BIGINT AS "pull_requests_created_count",
        COUNT("merged_at")::BIGINT AS "pull_requests_merged_count",
        COUNT(*) FILTER (WHERE "size_lines" >= 1000)::BIGINT AS "large_pull_requests_count",
        COUNT(*) FILTER (WHERE "size_lines" BETWEEN 50 AND 450)::BIGINT AS "small_pull_requests_count",
        ROUND(AVG("size_lines")::NUMERIC, 2) AS "avg_pull_request_size_lines",
        PERCENTILE_CONT(0.5) WITHIN GROUP (
            ORDER BY "size_lines"
        ) AS "median_pull_request_size_lines",
        ROUND(
            COUNT(*) FILTER (WHERE "size_lines" >= 1000)::NUMERIC / NULLIF(COUNT(*), 0),
            4
        ) AS "large_pull_request_ratio",
        ROUND(
            COUNT(*) FILTER (WHERE "size_lines" BETWEEN 50 AND 450)::NUMERIC / NULLIF(COUNT(*), 0),
            4
        ) AS "small_pull_request_ratio",
        SUM("reviews_before_merge_count")::BIGINT AS "reviews_on_merged_pull_requests_count"
    FROM pull_requests
    GROUP BY 1, 2, 3, 4
)
SELECT
    e."bucket",
    e."organization_id",
    e."repository_id",
    e."contributor_id",
    COALESCE(e."contributor_login", pr."contributor_login") AS "contributor_login",
    e."code_additions",
    e."code_deletions",
    e."code_churn",
    e."net_code_change",
    e."deletion_to_addition_ratio",
    e."commits_count",
    COALESCE(pr."pull_requests_created_count", e."pull_requests_created_count")::BIGINT AS "pull_requests_created_count",
    e."reviews_submitted_count",
    e."avg_commit_size_lines",
    COALESCE(pr."avg_pull_request_size_lines", 0) AS "avg_pull_request_size_lines",
    e."median_commit_size_lines",
    pr."median_pull_request_size_lines",
    e."large_commit_ratio",
    COALESCE(pr."large_pull_requests_count", 0)::BIGINT AS "large_pull_requests_count",
    COALESCE(pr."small_pull_requests_count", 0)::BIGINT AS "small_pull_requests_count",
    pr."large_pull_request_ratio",
    pr."small_pull_request_ratio",
    COALESCE(pr."pull_requests_merged_count", 0)::BIGINT AS "pull_requests_merged_count",
    ROUND(
      COALESCE(pr."pull_requests_merged_count", 0)::NUMERIC / NULLIF(e."commits_count", 0) * 100,
      2
    ) AS "merged_pull_requests_per_100_commits",
    ROUND(
      COALESCE(pr."reviews_on_merged_pull_requests_count", 0)::NUMERIC
      / NULLIF(pr."pull_requests_merged_count", 0),
      4
    ) AS "reviews_per_merged_pull_request"
FROM event_metrics e
LEFT JOIN pull_request_metrics pr
  ON pr."bucket" = e."bucket"
 AND pr."organization_id" = e."organization_id"
 AND pr."repository_id" = e."repository_id"
 AND pr."contributor_id" = e."contributor_id";
