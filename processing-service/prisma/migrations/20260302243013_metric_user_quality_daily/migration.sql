-- Daily individual quality metrics by organization/repository/contributor.
CREATE VIEW "metrics"."metrics_user_quality_daily" AS
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
        created."event_at" AS "created_at",
        merged."merged_at",
        merged."merge_actor_id",
        first_review."first_review_at",
        review_stats."reviews_count",
        review_stats."self_reviews_count",
        review_stats."reviews_before_merge_count"
    FROM "metrics"."metric_events" created
    LEFT JOIN LATERAL (
        SELECT
            state_changed."event_at" AS "merged_at",
            NULLIF(state_changed."payload" -> 'actor' ->> 'id', '') AS "merge_actor_id"
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
        SELECT reviewed."event_at" AS "first_review_at"
        FROM "metrics"."metric_events" reviewed
        WHERE reviewed."type" = 'pull_request.reviewed'
          AND reviewed."repository_id" = created."repository_id"
          AND NULLIF(reviewed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
          AND reviewed."event_at" >= created."event_at"
        ORDER BY reviewed."event_at" ASC
        LIMIT 1
    ) first_review ON TRUE
    LEFT JOIN LATERAL (
        SELECT
            COUNT(*)::BIGINT AS "reviews_count",
            COUNT(*) FILTER (
                WHERE NULLIF(reviewed."payload" -> 'actor' ->> 'id', '')
                    = NULLIF(created."payload" -> 'author' ->> 'id', '')
            )::BIGINT AS "self_reviews_count",
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
        COUNT("merged_at")::BIGINT AS "pull_requests_merged_count",
        COUNT(*) FILTER (
            WHERE "merged_at" IS NOT NULL AND "first_review_at" IS NOT NULL
        )::BIGINT AS "pull_requests_merged_after_review_count",
        SUM("reviews_count")::BIGINT AS "reviews_on_pull_requests_count",
        SUM("reviews_before_merge_count")::BIGINT AS "reviews_on_merged_pull_requests_count",
        SUM("self_reviews_count")::BIGINT AS "self_reviews_count",
        COUNT(*) FILTER (
            WHERE "merged_at" IS NOT NULL
              AND "merge_actor_id" = "contributor_id"
        )::BIGINT AS "self_merged_pull_requests_count",
        COUNT(*) FILTER (
            WHERE "merged_at" IS NOT NULL
              AND "reviews_before_merge_count" > 0
        )::BIGINT AS "merged_with_review_count",
        COUNT(*) FILTER (
            WHERE "merged_at" IS NOT NULL
              AND "reviews_before_merge_count" = 0
        )::BIGINT AS "merged_without_review_count",
        ROUND(
            COUNT(*) FILTER (
                WHERE "merged_at" IS NOT NULL
                  AND "reviews_before_merge_count" > 0
            )::NUMERIC / NULLIF(COUNT("merged_at"), 0),
            4
        ) AS "review_coverage_rate",
        ROUND(
            COUNT(*) FILTER (
                WHERE "merged_at" IS NOT NULL
                  AND "reviews_before_merge_count" = 0
            )::NUMERIC / NULLIF(COUNT("merged_at"), 0),
            4
        ) AS "merged_without_review_ratio",
        ROUND(SUM("self_reviews_count")::NUMERIC / NULLIF(SUM("reviews_before_merge_count"), 0), 4) AS "self_review_ratio",
        ROUND(
            COUNT(*) FILTER (
                WHERE "merged_at" IS NOT NULL
                  AND "merge_actor_id" = "contributor_id"
            )::NUMERIC / NULLIF(COUNT("merged_at"), 0),
            4
        ) AS "self_merge_ratio",
        0::NUMERIC AS "post_review_change_ratio",
        0::BIGINT AS "post_review_change_sample_count",
        ROUND(SUM("reviews_count")::NUMERIC / NULLIF(COUNT("first_review_at"), 0), 4) AS "review_iteration_count_avg"
    FROM pull_requests
    GROUP BY 1, 2, 3, 4
)
SELECT
    e."bucket",
    e."organization_id",
    e."repository_id",
    e."contributor_id",
    COALESCE(e."contributor_login", pr."contributor_login") AS "contributor_login",
    e."issues_reopened_count",
    e."pull_requests_reopened_count",
    e."pull_requests_reviewed_count",
    e."pull_requests_review_requested_count",
    COALESCE(pr."merged_without_review_count", 0)::BIGINT AS "merged_without_review_count",
    e."issue_reopen_rate",
    e."pull_request_reopen_rate",
    pr."review_coverage_rate",
    e."rework_intensity",
    COALESCE(pr."pull_requests_merged_count", 0)::BIGINT AS "pull_requests_merged_count",
    COALESCE(pr."pull_requests_merged_after_review_count", 0)::BIGINT AS "pull_requests_merged_after_review_count",
    COALESCE(pr."merged_with_review_count", 0)::BIGINT AS "merged_with_review_count",
    pr."merged_without_review_ratio",
    COALESCE(pr."reviews_on_pull_requests_count", 0)::BIGINT AS "reviews_on_pull_requests_count",
    COALESCE(pr."reviews_on_merged_pull_requests_count", 0)::BIGINT AS "reviews_on_merged_pull_requests_count",
    COALESCE(pr."self_reviews_count", 0)::BIGINT AS "self_reviews_count",
    COALESCE(pr."self_merged_pull_requests_count", 0)::BIGINT AS "self_merged_pull_requests_count",
    pr."self_review_ratio",
    pr."self_merge_ratio",
    pr."post_review_change_ratio",
    pr."post_review_change_sample_count",
    pr."review_iteration_count_avg"
FROM event_metrics e
LEFT JOIN pull_request_metrics pr
  ON pr."bucket" = e."bucket"
 AND pr."organization_id" = e."organization_id"
 AND pr."repository_id" = e."repository_id"
 AND pr."contributor_id" = e."contributor_id";
