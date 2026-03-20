-- Daily team repository-health metrics by organization/repository.
CREATE VIEW "metrics"."metrics_team_repository_health_daily" AS
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
        COUNT(*) FILTER (WHERE "type" IN ('issue.commented', 'pull_request.commented'))::BIGINT AS "comments_count"
    FROM "metrics"."metric_events"
    GROUP BY 1, 2, 3
),
issue_metrics AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        COUNT(*)::BIGINT AS "issues_created_count",
        COUNT(closed."closed_at")::BIGINT AS "issues_closed_count",
        COUNT(*) FILTER (WHERE label_state."has_label")::BIGINT AS "issues_with_label_count",
        COUNT(*) FILTER (WHERE assignment_state."has_assignment")::BIGINT AS "issues_with_assignment_count",
        COUNT(*) FILTER (WHERE type_state."has_type")::BIGINT AS "typed_issues_count"
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
    LEFT JOIN LATERAL (
        SELECT TRUE AS "has_label"
        FROM "metrics"."metric_events" labeled
        WHERE labeled."type" = 'issue.labeled'
          AND labeled."repository_id" = created."repository_id"
          AND NULLIF(labeled."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
        LIMIT 1
    ) label_state ON TRUE
    LEFT JOIN LATERAL (
        SELECT TRUE AS "has_assignment"
        FROM "metrics"."metric_events" assigned
        WHERE assigned."type" = 'issue.assigned'
          AND assigned."repository_id" = created."repository_id"
          AND NULLIF(assigned."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
        LIMIT 1
    ) assignment_state ON TRUE
    LEFT JOIN LATERAL (
        SELECT TRUE AS "has_type"
        FROM "metrics"."metric_events" typed
        WHERE typed."type" = 'issue.typed'
          AND typed."repository_id" = created."repository_id"
          AND NULLIF(typed."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
        LIMIT 1
    ) type_state ON TRUE
    WHERE created."type" = 'issue.created'
      AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
    GROUP BY 1, 2, 3
),
pull_request_metrics AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        COUNT(*)::BIGINT AS "pull_requests_created_count",
        COUNT(merged."merged_at")::BIGINT AS "pull_requests_merged_count",
        COUNT(*) FILTER (WHERE label_state."has_label")::BIGINT AS "pull_requests_with_label_count",
        COUNT(*) FILTER (WHERE assignment_state."has_assignment")::BIGINT AS "pull_requests_with_assignment_count"
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
        SELECT TRUE AS "has_label"
        FROM "metrics"."metric_events" labeled
        WHERE labeled."type" = 'pull_request.labeled'
          AND labeled."repository_id" = created."repository_id"
          AND NULLIF(labeled."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
        LIMIT 1
    ) label_state ON TRUE
    LEFT JOIN LATERAL (
        SELECT TRUE AS "has_assignment"
        FROM "metrics"."metric_events" assigned
        WHERE assigned."type" = 'pull_request.assigned'
          AND assigned."repository_id" = created."repository_id"
          AND NULLIF(assigned."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
        LIMIT 1
    ) assignment_state ON TRUE
    WHERE created."type" = 'pull_request.created'
      AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
    GROUP BY 1, 2, 3
),
work_metrics AS (
    SELECT
        COALESCE(i."bucket", pr."bucket") AS "bucket",
        COALESCE(i."organization_id", pr."organization_id") AS "organization_id",
        COALESCE(i."repository_id", pr."repository_id") AS "repository_id",
        COALESCE(i."issues_created_count", 0)::BIGINT AS "issues_created_count",
        COALESCE(i."issues_closed_count", 0)::BIGINT AS "issues_closed_count",
        COALESCE(pr."pull_requests_created_count", 0)::BIGINT AS "pull_requests_created_count",
        COALESCE(pr."pull_requests_merged_count", 0)::BIGINT AS "pull_requests_merged_count",
        COALESCE(i."issues_with_label_count", 0)::BIGINT AS "issues_with_label_count",
        COALESCE(i."issues_with_assignment_count", 0)::BIGINT AS "issues_with_assignment_count",
        COALESCE(i."typed_issues_count", 0)::BIGINT AS "typed_issues_count",
        COALESCE(pr."pull_requests_with_label_count", 0)::BIGINT AS "pull_requests_with_label_count",
        COALESCE(pr."pull_requests_with_assignment_count", 0)::BIGINT AS "pull_requests_with_assignment_count"
    FROM issue_metrics i
    FULL JOIN pull_request_metrics pr
      ON pr."bucket" = i."bucket"
     AND pr."organization_id" = i."organization_id"
     AND pr."repository_id" = i."repository_id"
),
days AS (
    SELECT DISTINCT "bucket", "organization_id", "repository_id"
    FROM "metrics"."metrics_team_activity_daily"
),
open_issues AS (
    SELECT
        d."bucket",
        d."organization_id",
        d."repository_id",
        COUNT(*)::BIGINT AS "open_issues_count",
        COUNT(*) FILTER (
            WHERE d."bucket" + INTERVAL '1 day' - created."event_at" >= INTERVAL '14 days'
        )::BIGINT AS "stale_issues_count",
        ROUND(
            (
                PERCENTILE_CONT(0.75) WITHIN GROUP (
                    ORDER BY EXTRACT(EPOCH FROM (d."bucket" + INTERVAL '1 day' - created."event_at"))
                )
            )::NUMERIC,
            2
        ) AS "open_issue_aging_p75_sec"
    FROM days d
    JOIN "metrics"."metric_events" created
      ON created."type" = 'issue.created'
     AND created."organization_id" = d."organization_id"
     AND created."repository_id" = d."repository_id"
     AND created."event_at" < d."bucket" + INTERVAL '1 day'
    WHERE NOT EXISTS (
        SELECT 1
        FROM "metrics"."metric_events" closed
        WHERE closed."type" = 'issue.state_changed'
          AND closed."repository_id" = created."repository_id"
          AND NULLIF(closed."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
          AND closed."payload" ->> 'event' = 'closed'
          AND closed."event_at" < d."bucket" + INTERVAL '1 day'
    )
    GROUP BY 1, 2, 3
),
open_pull_requests AS (
    SELECT
        d."bucket",
        d."organization_id",
        d."repository_id",
        COUNT(*)::BIGINT AS "open_pull_requests_count",
        COUNT(*) FILTER (
            WHERE d."bucket" + INTERVAL '1 day' - created."event_at" >= INTERVAL '7 days'
        )::BIGINT AS "stale_pull_requests_count",
        ROUND(
            (
                PERCENTILE_CONT(0.75) WITHIN GROUP (
                    ORDER BY EXTRACT(EPOCH FROM (d."bucket" + INTERVAL '1 day' - created."event_at"))
                )
            )::NUMERIC,
            2
        ) AS "open_pull_request_aging_p75_sec"
    FROM days d
    JOIN "metrics"."metric_events" created
      ON created."type" = 'pull_request.created'
     AND created."organization_id" = d."organization_id"
     AND created."repository_id" = d."repository_id"
     AND created."event_at" < d."bucket" + INTERVAL '1 day'
    WHERE NOT EXISTS (
        SELECT 1
        FROM "metrics"."metric_events" state_changed
        WHERE state_changed."type" = 'pull_request.state_changed'
          AND state_changed."repository_id" = created."repository_id"
          AND NULLIF(state_changed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
          AND state_changed."payload" ->> 'event' IN ('merged', 'closed')
          AND state_changed."event_at" < d."bucket" + INTERVAL '1 day'
    )
    GROUP BY 1, 2, 3
)
SELECT
    a."bucket",
    a."organization_id",
    a."repository_id",
    COALESCE(w."issues_created_count", 0)::BIGINT AS "issues_created_count",
    COALESCE(w."pull_requests_created_count", 0)::BIGINT AS "pull_requests_created_count",
    (COALESCE(w."issues_created_count", 0) - COALESCE(w."issues_closed_count", 0))::BIGINT AS "issue_backlog_delta",
    (COALESCE(w."pull_requests_created_count", 0) - COALESCE(w."pull_requests_merged_count", 0))::BIGINT AS "pull_request_backlog_delta",
    (
      (COALESCE(w."issues_created_count", 0) - COALESCE(w."issues_closed_count", 0))
      + (COALESCE(w."pull_requests_created_count", 0) - COALESCE(w."pull_requests_merged_count", 0))
    )::BIGINT AS "total_backlog_delta",
    ROUND(COALESCE(w."issues_closed_count", 0)::NUMERIC / NULLIF(w."issues_created_count", 0), 4) AS "issue_close_rate",
    ROUND(COALESCE(w."pull_requests_merged_count", 0)::NUMERIC / NULLIF(w."pull_requests_created_count", 0), 4) AS "pull_request_merge_rate",
    ROUND(
      GREATEST(
        (COALESCE(w."issues_created_count", 0) - COALESCE(w."issues_closed_count", 0))
        + (COALESCE(w."pull_requests_created_count", 0) - COALESCE(w."pull_requests_merged_count", 0)),
        0
      )::NUMERIC / NULLIF(COALESCE(w."issues_created_count", 0) + COALESCE(w."pull_requests_created_count", 0), 0),
      4
    ) AS "stale_open_work_ratio",
    ROUND(
      (COALESCE(e."issues_reopened_count", 0) + COALESCE(e."pull_requests_reopened_count", 0))::NUMERIC
      / NULLIF(COALESCE(w."issues_created_count", 0) + COALESCE(w."pull_requests_created_count", 0), 0),
      4
    ) AS "reopen_pressure_index",
    ROUND(
      1 / (1 + GREATEST((
        (COALESCE(w."issues_created_count", 0) - COALESCE(w."issues_closed_count", 0))
        + (COALESCE(w."pull_requests_created_count", 0) - COALESCE(w."pull_requests_merged_count", 0))
      )::NUMERIC, 0)),
      4
    ) AS "queue_stability_index",
    ROUND(COALESCE(e."comments_count", 0)::NUMERIC / NULLIF(COALESCE(w."issues_created_count", 0) + COALESCE(w."pull_requests_created_count", 0), 0), 4) AS "discussion_intensity_ratio",
    COALESCE(w."issues_closed_count", 0)::BIGINT AS "issues_closed_count",
    (COALESCE(w."issues_created_count", 0) + COALESCE(w."pull_requests_created_count", 0))::BIGINT AS "created_work_count",
    ROUND(COALESCE(w."issues_closed_count", 0)::NUMERIC / NULLIF(w."issues_created_count", 0), 4) AS "issue_resolution_ratio",
    ROUND(
      (COALESCE(w."issues_with_label_count", 0) + COALESCE(w."pull_requests_with_label_count", 0))::NUMERIC
      / NULLIF(COALESCE(w."issues_created_count", 0) + COALESCE(w."pull_requests_created_count", 0), 0),
      4
    ) AS "label_coverage_ratio",
    ROUND(
      (COALESCE(w."issues_with_assignment_count", 0) + COALESCE(w."pull_requests_with_assignment_count", 0))::NUMERIC
      / NULLIF(COALESCE(w."issues_created_count", 0) + COALESCE(w."pull_requests_created_count", 0), 0),
      4
    ) AS "assignment_coverage_ratio",
    ROUND(COALESCE(w."typed_issues_count", 0)::NUMERIC / NULLIF(w."issues_created_count", 0), 4) AS "typed_issue_ratio",
    COALESCE(members."repository_members_count", 0)::BIGINT AS "repository_members_count",
    ROUND(
        GREATEST(COALESCE(members."repository_members_count", 0) - a."active_contributors_count", 0)::NUMERIC
        / NULLIF(members."repository_members_count", 0),
        4
    ) AS "inactive_members_ratio",
    ROUND(MAX(ua."events_total")::NUMERIC / NULLIF(a."events_total", 0), 4) AS "bus_factor_risk_index",
    oi."open_issues_count",
    oi."stale_issues_count",
    oi."open_issue_aging_p75_sec",
    ROUND(oi."stale_issues_count"::NUMERIC / NULLIF(oi."open_issues_count", 0), 4) AS "stale_issue_ratio",
    opr."open_pull_requests_count",
    opr."stale_pull_requests_count",
    opr."open_pull_request_aging_p75_sec",
    ROUND(opr."stale_pull_requests_count"::NUMERIC / NULLIF(opr."open_pull_requests_count", 0), 4) AS "stale_pull_request_ratio"
FROM "metrics"."metrics_team_activity_daily" a
LEFT JOIN event_metrics e
  ON e."bucket" = a."bucket"
 AND e."organization_id" = a."organization_id"
 AND e."repository_id" = a."repository_id"
LEFT JOIN work_metrics w
  ON w."bucket" = a."bucket"
 AND w."organization_id" = a."organization_id"
 AND w."repository_id" = a."repository_id"
LEFT JOIN "metrics"."metrics_user_activity_daily" ua
  ON ua."bucket" = a."bucket"
 AND ua."organization_id" = a."organization_id"
 AND ua."repository_id" = a."repository_id"
LEFT JOIN (
    SELECT "repository_id", COUNT(*)::BIGINT AS "repository_members_count"
    FROM "metrics"."repository_memberships"
    GROUP BY 1
) members
  ON members."repository_id" = a."repository_id"
LEFT JOIN open_issues oi
  ON oi."bucket" = a."bucket"
 AND oi."organization_id" = a."organization_id"
 AND oi."repository_id" = a."repository_id"
LEFT JOIN open_pull_requests opr
  ON opr."bucket" = a."bucket"
 AND opr."organization_id" = a."organization_id"
 AND opr."repository_id" = a."repository_id"
GROUP BY
    a."bucket",
    a."organization_id",
    a."repository_id",
    a."active_contributors_count",
    a."events_total",
    e."issues_reopened_count",
    e."pull_requests_reopened_count",
    e."comments_count",
    w."issues_created_count",
    w."issues_closed_count",
    w."pull_requests_created_count",
    w."pull_requests_merged_count",
    w."issues_with_label_count",
    w."pull_requests_with_label_count",
    w."issues_with_assignment_count",
    w."pull_requests_with_assignment_count",
    w."typed_issues_count",
    members."repository_members_count",
    oi."open_issues_count",
    oi."stale_issues_count",
    oi."open_issue_aging_p75_sec",
    opr."open_pull_requests_count",
    opr."stale_pull_requests_count",
    opr."open_pull_request_aging_p75_sec";
