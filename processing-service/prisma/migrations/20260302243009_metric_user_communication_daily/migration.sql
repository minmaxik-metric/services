-- Daily individual communication metrics by organization/repository/contributor.
CREATE VIEW "metrics"."metrics_user_communication_daily" AS
WITH communication_events AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', "event_at") AS "bucket",
        "organization_id",
        "repository_id",
        "type",
        "event_at",
        "payload",
        CASE
          WHEN "type" = 'pull_request.review_requested'
            THEN NULLIF("payload" -> 'requestedReviewer' ->> 'id', '')
          ELSE COALESCE(
            NULLIF("payload" -> 'actor' ->> 'id', ''),
            NULLIF("payload" -> 'author' ->> 'id', '')
          )
        END AS "contributor_id",
        CASE
          WHEN "type" = 'pull_request.review_requested'
            THEN NULLIF("payload" -> 'requestedReviewer' ->> 'login', '')
          ELSE COALESCE(
            NULLIF("payload" -> 'actor' ->> 'login', ''),
            NULLIF("payload" -> 'author' ->> 'login', '')
          )
        END AS "contributor_login"
    FROM "metrics"."metric_events"
),
user_base AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        "contributor_id",
        MAX("contributor_login") AS "contributor_login",
        COUNT(*) FILTER (WHERE "type" = 'issue.commented')::BIGINT AS "issue_comments_count",
        COUNT(*) FILTER (WHERE "type" = 'pull_request.commented')::BIGINT AS "pull_request_comments_count",
        COUNT(*) FILTER (WHERE "type" = 'pull_request.review_requested')::BIGINT AS "review_requests_count",
        COUNT(*) FILTER (WHERE "type" = 'pull_request.reviewed')::BIGINT AS "reviews_count",
        COUNT(*) FILTER (
          WHERE "type" IN ('issue.labeled', 'pull_request.labeled')
        )::BIGINT AS "labels_changed_count",
        COUNT(*) FILTER (
          WHERE "type" IN ('issue.assigned', 'pull_request.assigned')
        )::BIGINT AS "assignees_changed_count",
        COUNT(*) FILTER (
          WHERE "type" IN (
            'issue.commented',
            'pull_request.commented',
            'pull_request.review_requested',
            'pull_request.reviewed',
            'issue.labeled',
            'pull_request.labeled',
            'issue.assigned',
            'pull_request.assigned'
          )
        )::BIGINT AS "communication_events_total",
        (
          COUNT(*) FILTER (WHERE "type" = 'issue.commented')
          + COUNT(*) FILTER (WHERE "type" = 'pull_request.commented')
        )::BIGINT AS "comments_total_count",
        (
          COUNT(*) FILTER (WHERE "type" = 'issue.assigned')
          + COUNT(*) FILTER (WHERE "type" = 'pull_request.assigned')
        )::BIGINT AS "assignment_events_total",
        ROUND(
          (
            COUNT(*) FILTER (WHERE "type" = 'issue.commented')
            + COUNT(*) FILTER (WHERE "type" = 'pull_request.commented')
          )::NUMERIC / NULLIF(COUNT(*) FILTER (WHERE "type" = 'pull_request.reviewed'), 0),
          4
        ) AS "comments_per_review_ratio",
        ROUND(
          COUNT(*) FILTER (
            WHERE NULLIF("payload" -> 'actor' ->> 'id', '') IS NOT NULL
              AND COALESCE(
                NULLIF("payload" -> 'assignee' ->> 'id', ''),
                NULLIF("payload" -> 'requestedReviewer' ->> 'id', '')
              ) IS NOT NULL
              AND NULLIF("payload" -> 'actor' ->> 'id', '') <> COALESCE(
                NULLIF("payload" -> 'assignee' ->> 'id', ''),
                NULLIF("payload" -> 'requestedReviewer' ->> 'id', '')
              )
          )::NUMERIC / NULLIF(
            COUNT(*) FILTER (
              WHERE NULLIF("payload" -> 'actor' ->> 'id', '') IS NOT NULL
                AND COALESCE(
                  NULLIF("payload" -> 'assignee' ->> 'id', ''),
                  NULLIF("payload" -> 'requestedReviewer' ->> 'id', '')
                ) IS NOT NULL
            ),
            0
          ),
          4
        ) AS "cross_actor_interaction_ratio"
    FROM communication_events
    WHERE "contributor_id" IS NOT NULL
    GROUP BY 1, 2, 3, 4
),
review_requests_with_response AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', request."event_at") AS "bucket",
        request."organization_id",
        request."repository_id",
        NULLIF(request."payload" -> 'requestedReviewer' ->> 'id', '') AS "contributor_id",
        NULLIF(request."payload" -> 'requestedReviewer' ->> 'login', '') AS "contributor_login",
        request."event_at" AS "request_at",
        response."event_at" AS "response_at"
    FROM "metrics"."metric_events" request
    LEFT JOIN LATERAL (
        SELECT reviewed."event_at"
        FROM "metrics"."metric_events" reviewed
        WHERE reviewed."type" = 'pull_request.reviewed'
          AND reviewed."organization_id" = request."organization_id"
          AND reviewed."repository_id" = request."repository_id"
          AND NULLIF(reviewed."payload" ->> 'prId', '') = NULLIF(request."payload" ->> 'prId', '')
          AND NULLIF(reviewed."payload" -> 'actor' ->> 'id', '') = NULLIF(request."payload" -> 'requestedReviewer' ->> 'id', '')
          AND reviewed."event_at" >= request."event_at"
        ORDER BY reviewed."event_at" ASC
        LIMIT 1
    ) response ON TRUE
    WHERE request."type" = 'pull_request.review_requested'
      AND NULLIF(request."payload" ->> 'prId', '') IS NOT NULL
      AND NULLIF(request."payload" -> 'requestedReviewer' ->> 'id', '') IS NOT NULL
),
user_review_request_metrics AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        "contributor_id",
        MAX("contributor_login") AS "contributor_login",
        COUNT(*)::BIGINT AS "review_requests_count",
        COUNT("response_at")::BIGINT AS "review_responses_count",
        ROUND(COUNT("response_at")::NUMERIC / NULLIF(COUNT(*), 0), 4) AS "review_response_ratio",
        COUNT(*) FILTER (WHERE "response_at" IS NULL)::BIGINT AS "review_queue_pressure",
        ROUND(COUNT(*) FILTER (WHERE "response_at" IS NULL)::NUMERIC / NULLIF(COUNT(*), 0), 4) AS "unanswered_review_request_ratio",
        ROUND(
          (
            PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("response_at" - "request_at"))
            ) FILTER (WHERE "response_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "median_review_response_time_sec",
        ROUND(
          (
            PERCENTILE_CONT(0.75) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("response_at" - "request_at"))
            ) FILTER (WHERE "response_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "p75_review_response_time_sec"
    FROM review_requests_with_response
    GROUP BY 1, 2, 3, 4
),
pull_requests AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        NULLIF(created."payload" -> 'author' ->> 'id', '') AS "contributor_id",
        created."event_at" AS "created_at",
        first_review."first_review_at"
    FROM "metrics"."metric_events" created
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
    WHERE created."type" = 'pull_request.created'
      AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
      AND NULLIF(created."payload" -> 'author' ->> 'id', '') IS NOT NULL
),
first_review_metrics AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        "contributor_id",
        COUNT("first_review_at")::BIGINT AS "pull_requests_with_first_review_count",
        ROUND(
          (
            PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("first_review_at" - "created_at"))
            ) FILTER (WHERE "first_review_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "time_to_first_review_median_sec",
        ROUND(
          (
            PERCENTILE_CONT(0.75) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("first_review_at" - "created_at"))
            ) FILTER (WHERE "first_review_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "time_to_first_review_p75_sec"
    FROM pull_requests
    GROUP BY 1, 2, 3, 4
)
SELECT
    b."bucket",
    b."organization_id",
    b."repository_id",
    b."contributor_id",
    COALESCE(b."contributor_login", r."contributor_login") AS "contributor_login",
    b."issue_comments_count",
    b."pull_request_comments_count",
    COALESCE(r."review_requests_count", b."review_requests_count")::BIGINT AS "review_requests_count",
    b."reviews_count",
    b."labels_changed_count",
    b."assignees_changed_count",
    b."communication_events_total",
    b."comments_total_count",
    b."assignment_events_total",
    b."comments_per_review_ratio",
    COALESCE(r."review_response_ratio", ROUND(COALESCE(r."review_responses_count", 0)::NUMERIC / NULLIF(b."review_requests_count", 0), 4)) AS "review_response_ratio",
    COALESCE(r."review_responses_count", 0)::BIGINT AS "review_responses_count",
    r."median_review_response_time_sec",
    b."cross_actor_interaction_ratio",
    COALESCE(r."review_queue_pressure", b."review_requests_count")::BIGINT AS "review_queue_pressure",
    r."p75_review_response_time_sec",
    COALESCE(r."unanswered_review_request_ratio", ROUND(COALESCE(r."review_queue_pressure", b."review_requests_count")::NUMERIC / NULLIF(b."review_requests_count", 0), 4)) AS "unanswered_review_request_ratio",
    COALESCE(fr."pull_requests_with_first_review_count", 0)::BIGINT AS "pull_requests_with_first_review_count",
    fr."time_to_first_review_median_sec",
    fr."time_to_first_review_p75_sec"
FROM user_base b
LEFT JOIN user_review_request_metrics r
  ON r."bucket" = b."bucket"
 AND r."organization_id" = b."organization_id"
 AND r."repository_id" = b."repository_id"
 AND r."contributor_id" = b."contributor_id"
LEFT JOIN first_review_metrics fr
  ON fr."bucket" = b."bucket"
 AND fr."organization_id" = b."organization_id"
 AND fr."repository_id" = b."repository_id"
 AND fr."contributor_id" = b."contributor_id";
