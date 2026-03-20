-- Daily individual repository-health metrics by organization/repository/contributor.
CREATE VIEW "metrics"."metrics_user_repository_health_daily" AS
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
        )::BIGINT AS "pull_requests_reopened_count"
    FROM "metrics"."metric_events"
    WHERE COALESCE(
          NULLIF("payload" -> 'actor' ->> 'id', ''),
          NULLIF("payload" -> 'author' ->> 'id', '')
        ) IS NOT NULL
    GROUP BY 1, 2, 3, 4
),
issues AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        NULLIF(created."payload" -> 'author' ->> 'id', '') AS "contributor_id",
        NULLIF(created."payload" -> 'author' ->> 'login', '') AS "contributor_login",
        closed."closed_at",
        EXISTS (
            SELECT 1
            FROM "metrics"."metric_events" labeled
            WHERE labeled."type" = 'issue.labeled'
              AND labeled."repository_id" = created."repository_id"
              AND NULLIF(labeled."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
        ) AS "has_label",
        EXISTS (
            SELECT 1
            FROM "metrics"."metric_events" assigned
            WHERE assigned."type" = 'issue.assigned'
              AND assigned."repository_id" = created."repository_id"
              AND NULLIF(assigned."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
        ) AS "has_assignment",
        EXISTS (
            SELECT 1
            FROM "metrics"."metric_events" typed
            WHERE typed."type" = 'issue.typed'
              AND typed."repository_id" = created."repository_id"
              AND NULLIF(typed."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
        ) AS "has_type"
    FROM "metrics"."metric_events" created
    LEFT JOIN LATERAL (
        SELECT state_changed."event_at" AS "closed_at"
        FROM "metrics"."metric_events" state_changed
        WHERE state_changed."type" = 'issue.state_changed'
          AND state_changed."repository_id" = created."repository_id"
          AND NULLIF(state_changed."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
          AND state_changed."payload" ->> 'event' = 'closed'
          AND state_changed."event_at" >= created."event_at"
        ORDER BY state_changed."event_at" ASC
        LIMIT 1
    ) closed ON TRUE
    WHERE created."type" = 'issue.created'
      AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
      AND NULLIF(created."payload" -> 'author' ->> 'id', '') IS NOT NULL
),
issue_metrics AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        "contributor_id",
        MAX("contributor_login") AS "contributor_login",
        COUNT(*)::BIGINT AS "issues_created_count",
        COUNT("closed_at")::BIGINT AS "issues_closed_count",
        COUNT(*) FILTER (WHERE "has_label")::BIGINT AS "issues_with_label_count",
        COUNT(*) FILTER (WHERE "has_assignment")::BIGINT AS "issues_with_assignment_count",
        COUNT(*) FILTER (WHERE "has_type")::BIGINT AS "typed_issues_count",
        ROUND(COUNT("closed_at")::NUMERIC / NULLIF(COUNT(*), 0), 4) AS "issue_resolution_ratio",
        ROUND(COUNT(*) FILTER (WHERE "has_type")::NUMERIC / NULLIF(COUNT(*), 0), 4) AS "typed_issue_ratio"
    FROM issues
    GROUP BY 1, 2, 3, 4
),
pull_requests AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        NULLIF(created."payload" -> 'author' ->> 'id', '') AS "contributor_id",
        NULLIF(created."payload" -> 'author' ->> 'login', '') AS "contributor_login",
        merged."merged_at",
        EXISTS (
            SELECT 1
            FROM "metrics"."metric_events" labeled
            WHERE labeled."type" = 'pull_request.labeled'
              AND labeled."repository_id" = created."repository_id"
              AND NULLIF(labeled."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
        ) AS "has_label",
        EXISTS (
            SELECT 1
            FROM "metrics"."metric_events" assigned
            WHERE assigned."type" = 'pull_request.assigned'
              AND assigned."repository_id" = created."repository_id"
              AND NULLIF(assigned."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
        ) AS "has_assignment"
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
        COUNT(*) FILTER (WHERE "has_label")::BIGINT AS "pull_requests_with_label_count",
        COUNT(*) FILTER (WHERE "has_assignment")::BIGINT AS "pull_requests_with_assignment_count"
    FROM pull_requests
    GROUP BY 1, 2, 3, 4
),
keys AS (
    SELECT "bucket", "organization_id", "repository_id", "contributor_id" FROM event_metrics
    UNION
    SELECT "bucket", "organization_id", "repository_id", "contributor_id" FROM issue_metrics
    UNION
    SELECT "bucket", "organization_id", "repository_id", "contributor_id" FROM pull_request_metrics
)
SELECT
    k."bucket",
    k."organization_id",
    k."repository_id",
    k."contributor_id",
    COALESCE(e."contributor_login", i."contributor_login", pr."contributor_login") AS "contributor_login",
    COALESCE(i."issues_created_count", 0)::BIGINT AS "issues_created_count",
    COALESCE(pr."pull_requests_created_count", 0)::BIGINT AS "pull_requests_created_count",
    (COALESCE(i."issues_created_count", 0) - COALESCE(i."issues_closed_count", 0))::BIGINT AS "issue_backlog_delta",
    (COALESCE(pr."pull_requests_created_count", 0) - COALESCE(pr."pull_requests_merged_count", 0))::BIGINT AS "pull_request_backlog_delta",
    ROUND(COALESCE(i."issues_closed_count", 0)::NUMERIC / NULLIF(i."issues_created_count", 0), 4) AS "issue_close_rate",
    ROUND(COALESCE(pr."pull_requests_merged_count", 0)::NUMERIC / NULLIF(pr."pull_requests_created_count", 0), 4) AS "pull_request_merge_rate",
    ROUND(
      GREATEST(
        (COALESCE(i."issues_created_count", 0) - COALESCE(i."issues_closed_count", 0))
        + (COALESCE(pr."pull_requests_created_count", 0) - COALESCE(pr."pull_requests_merged_count", 0)),
        0
      )::NUMERIC / NULLIF(COALESCE(i."issues_created_count", 0) + COALESCE(pr."pull_requests_created_count", 0), 0),
      4
    ) AS "stale_open_work_ratio",
    ROUND(
      (COALESCE(e."issues_reopened_count", 0) + COALESCE(e."pull_requests_reopened_count", 0))::NUMERIC
      / NULLIF(COALESCE(i."issues_created_count", 0) + COALESCE(pr."pull_requests_created_count", 0), 0),
      4
    ) AS "reopen_pressure_index",
    COALESCE(i."issues_closed_count", 0)::BIGINT AS "issues_closed_count",
    (COALESCE(i."issues_created_count", 0) + COALESCE(pr."pull_requests_created_count", 0))::BIGINT AS "created_work_count",
    i."issue_resolution_ratio",
    ROUND(
      (COALESCE(i."issues_with_label_count", 0) + COALESCE(pr."pull_requests_with_label_count", 0))::NUMERIC
      / NULLIF(COALESCE(i."issues_created_count", 0) + COALESCE(pr."pull_requests_created_count", 0), 0),
      4
    ) AS "label_coverage_ratio",
    ROUND(
      (COALESCE(i."issues_with_assignment_count", 0) + COALESCE(pr."pull_requests_with_assignment_count", 0))::NUMERIC
      / NULLIF(COALESCE(i."issues_created_count", 0) + COALESCE(pr."pull_requests_created_count", 0), 0),
      4
    ) AS "assignment_coverage_ratio",
    i."typed_issue_ratio"
FROM keys k
LEFT JOIN event_metrics e USING ("bucket", "organization_id", "repository_id", "contributor_id")
LEFT JOIN issue_metrics i USING ("bucket", "organization_id", "repository_id", "contributor_id")
LEFT JOIN pull_request_metrics pr USING ("bucket", "organization_id", "repository_id", "contributor_id");
