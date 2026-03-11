-- Daily team quality metrics by organization/repository.
CREATE VIEW "metrics"."metrics_team_quality_daily" AS
WITH event_metrics AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', "event_at") AS "bucket",
        "organization_id",
        "repository_id",
        COUNT(*) FILTER (
          WHERE "type" = 'issue.state_changed'
          AND "payload" ->> 'event' = 'reopened'
        )::BIGINT AS "issues_reopened_count",
        COUNT(*) FILTER (
          WHERE "type" = 'pull_request.state_changed'
          AND "payload" ->> 'event' = 'reopened'
        )::BIGINT AS "pull_requests_reopened_count",
        COUNT(*) FILTER (WHERE "type" = 'pull_request.reviewed')::BIGINT AS "pull_requests_reviewed_count",
        COUNT(*) FILTER (WHERE "type" = 'pull_request.review_requested')::BIGINT AS "pull_requests_review_requested_count",
        COUNT(*) FILTER (WHERE (
            (
              "type" = 'commit.created'
              AND (
              COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
              COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0)
            ) >= 500
            ) OR (
              "type" = 'pull_request.created'
              AND (
              COALESCE(NULLIF("payload" ->> 'additions', '')::INT, 0) +
              COALESCE(NULLIF("payload" ->> 'deletions', '')::INT, 0)
            ) >= 1000
            )
          ))::BIGINT AS "large_changes_count",
        ROUND(
          COUNT(*) FILTER (
            WHERE "type" = 'issue.state_changed'
            AND "payload" ->> 'event' = 'reopened'
          )::NUMERIC / NULLIF(
            COUNT(*) FILTER (
              WHERE "type" = 'issue.state_changed'
              AND "payload" ->> 'event' = 'closed'
            ),
            0
          ),
          4
        ) AS "issue_reopen_rate",
        ROUND(
          COUNT(*) FILTER (
            WHERE "type" = 'pull_request.state_changed'
            AND "payload" ->> 'event' = 'reopened'
          )::NUMERIC / NULLIF(
            COUNT(*) FILTER (
              WHERE "type" = 'pull_request.state_changed'
              AND "payload" ->> 'event' = 'merged'
            ),
            0
          ),
          4
        ) AS "pull_request_reopen_rate",
        ROUND(
          COUNT(*) FILTER (WHERE (
            (
              "type" = 'commit.created'
              AND (
              COALESCE(NULLIF("payload" #>> '{stats,additions}', '')::INT, 0) +
              COALESCE(NULLIF("payload" #>> '{stats,deletions}', '')::INT, 0)
            ) >= 500
            ) OR (
              "type" = 'pull_request.created'
              AND (
              COALESCE(NULLIF("payload" ->> 'additions', '')::INT, 0) +
              COALESCE(NULLIF("payload" ->> 'deletions', '')::INT, 0)
            ) >= 1000
            )
          ))::NUMERIC
          / NULLIF(COUNT(*) FILTER (WHERE "type" IN ('commit.created', 'pull_request.created')), 0),
          4
        ) AS "large_change_ratio",
        (
          COUNT(*) FILTER (
            WHERE "type" = 'issue.state_changed'
            AND "payload" ->> 'event' = 'closed'
          ) - COUNT(*) FILTER (
            WHERE "type" = 'issue.state_changed'
            AND "payload" ->> 'event' = 'reopened'
          )
        )::BIGINT AS "issue_close_reopen_balance",
        (
          COUNT(*) FILTER (
            WHERE "type" = 'pull_request.state_changed'
            AND "payload" ->> 'event' = 'merged'
          ) - COUNT(*) FILTER (
            WHERE "type" = 'pull_request.state_changed'
            AND "payload" ->> 'event' = 'reopened'
          )
        )::BIGINT AS "pull_request_merge_reopen_balance",
        ROUND(
          (
            COUNT(*) FILTER (
              WHERE "type" = 'issue.state_changed'
              AND "payload" ->> 'event' = 'reopened'
            ) + COUNT(*) FILTER (
              WHERE "type" = 'pull_request.state_changed'
              AND "payload" ->> 'event' = 'reopened'
            )
          )::NUMERIC / NULLIF(COUNT(*), 0),
          4
        ) AS "rework_intensity"
    FROM "metrics"."metric_events"
    GROUP BY 1, 2, 3
),
user_quality AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        SUM("merged_without_review_count")::BIGINT AS "merged_without_review_count",
        SUM("pull_requests_merged_count")::BIGINT AS "pull_requests_merged_count",
        SUM("pull_requests_merged_after_review_count")::BIGINT AS "pull_requests_merged_after_review_count",
        SUM("merged_with_review_count")::BIGINT AS "merged_with_review_count",
        SUM("reviews_on_pull_requests_count")::BIGINT AS "reviews_on_pull_requests_count",
        SUM("reviews_on_merged_pull_requests_count")::BIGINT AS "reviews_on_merged_pull_requests_count",
        SUM("self_reviews_count")::BIGINT AS "self_reviews_count",
        SUM("self_merged_pull_requests_count")::BIGINT AS "self_merged_pull_requests_count",
        SUM("post_review_change_sample_count")::BIGINT AS "post_review_change_sample_count"
    FROM "metrics"."metrics_user_quality_daily"
    GROUP BY 1, 2, 3
)
SELECT
    e."bucket",
    e."organization_id",
    e."repository_id",
    e."issues_reopened_count",
    e."pull_requests_reopened_count",
    e."pull_requests_reviewed_count",
    e."pull_requests_review_requested_count",
    e."large_changes_count",
    COALESCE(u."merged_without_review_count", 0)::BIGINT AS "merged_without_review_count",
    e."issue_reopen_rate",
    e."pull_request_reopen_rate",
    e."large_change_ratio",
    e."issue_close_reopen_balance",
    e."pull_request_merge_reopen_balance",
    ROUND(COALESCE(u."merged_with_review_count", 0)::NUMERIC / NULLIF(u."pull_requests_merged_count", 0), 4) AS "review_coverage_rate",
    e."rework_intensity",
    COALESCE(u."pull_requests_merged_count", 0)::BIGINT AS "pull_requests_merged_count",
    COALESCE(u."pull_requests_merged_after_review_count", 0)::BIGINT AS "pull_requests_merged_after_review_count",
    COALESCE(u."merged_with_review_count", 0)::BIGINT AS "merged_with_review_count",
    ROUND(COALESCE(u."merged_without_review_count", 0)::NUMERIC / NULLIF(u."pull_requests_merged_count", 0), 4) AS "merged_without_review_ratio",
    COALESCE(u."reviews_on_pull_requests_count", 0)::BIGINT AS "reviews_on_pull_requests_count",
    COALESCE(u."reviews_on_merged_pull_requests_count", 0)::BIGINT AS "reviews_on_merged_pull_requests_count",
    COALESCE(u."self_reviews_count", 0)::BIGINT AS "self_reviews_count",
    COALESCE(u."self_merged_pull_requests_count", 0)::BIGINT AS "self_merged_pull_requests_count",
    ROUND(COALESCE(u."self_reviews_count", 0)::NUMERIC / NULLIF(u."reviews_on_merged_pull_requests_count", 0), 4) AS "self_review_ratio",
    ROUND(COALESCE(u."self_merged_pull_requests_count", 0)::NUMERIC / NULLIF(u."pull_requests_merged_count", 0), 4) AS "self_merge_ratio",
    0::NUMERIC AS "post_review_change_ratio",
    COALESCE(u."post_review_change_sample_count", 0)::BIGINT AS "post_review_change_sample_count",
    ROUND(COALESCE(u."reviews_on_pull_requests_count", 0)::NUMERIC / NULLIF(u."pull_requests_merged_after_review_count", 0), 4) AS "review_iteration_count_avg"
FROM event_metrics e
LEFT JOIN user_quality u
  ON u."bucket" = e."bucket"
 AND u."organization_id" = e."organization_id"
 AND u."repository_id" = e."repository_id";
