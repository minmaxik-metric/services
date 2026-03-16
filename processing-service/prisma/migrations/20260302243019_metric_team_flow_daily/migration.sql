-- Daily team flow metrics by organization/repository.
CREATE VIEW "metrics"."metrics_team_flow_daily" AS
WITH event_metrics AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', "event_at") AS "bucket",
        "organization_id",
        "repository_id",
        COUNT(*)::BIGINT AS "events_ingested_count",
        COUNT(*) FILTER (WHERE "type" IN ('issue.created', 'pull_request.created'))::BIGINT AS "incoming_work_count",
        COUNT(*) FILTER (WHERE (
            ("type" = 'issue.state_changed' AND "payload" ->> 'event' = 'closed')
            OR ("type" = 'pull_request.state_changed' AND "payload" ->> 'event' = 'merged')
          ))::BIGINT AS "done_work_count",
        (
          COUNT(*) FILTER (WHERE "type" IN ('issue.created', 'pull_request.created'))
          - COUNT(*) FILTER (WHERE (
            ("type" = 'issue.state_changed' AND "payload" ->> 'event' = 'closed')
            OR ("type" = 'pull_request.state_changed' AND "payload" ->> 'event' = 'merged')
          ))
        )::BIGINT AS "work_balance_delta"
    FROM "metrics"."metric_events"
    GROUP BY 1, 2, 3
),
pull_requests AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        created."event_at" AS "created_at",
        merged."merged_at",
        first_review."first_review_at"
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
),
pull_request_metrics AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        COUNT("merged_at")::BIGINT AS "pull_requests_merged_count",
        COUNT(*) FILTER (
          WHERE "merged_at" IS NOT NULL AND "first_review_at" IS NOT NULL
        )::BIGINT AS "pull_requests_merged_after_review_count",
        ROUND(
          (
            PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("merged_at" - "created_at"))
            ) FILTER (WHERE "merged_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "pull_request_cycle_time_median_sec",
        ROUND(
          (
            PERCENTILE_CONT(0.75) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("merged_at" - "created_at"))
            ) FILTER (WHERE "merged_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "pull_request_cycle_time_p75_sec",
        ROUND(
          (
            PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("merged_at" - "first_review_at"))
            ) FILTER (WHERE "merged_at" IS NOT NULL AND "first_review_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "time_to_merge_after_first_review_median_sec"
    FROM pull_requests
    GROUP BY 1, 2, 3
),
issues AS (
    SELECT
        public.time_bucket(INTERVAL '1 day', created."event_at") AS "bucket",
        created."organization_id",
        created."repository_id",
        created."event_at" AS "created_at",
        closed."closed_at"
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
),
issue_metrics AS (
    SELECT
        "bucket",
        "organization_id",
        "repository_id",
        COUNT("closed_at")::BIGINT AS "issues_closed_count",
        ROUND(
          (
            PERCENTILE_CONT(0.5) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("closed_at" - "created_at"))
            ) FILTER (WHERE "closed_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "issue_lead_time_median_sec",
        ROUND(
          (
            PERCENTILE_CONT(0.75) WITHIN GROUP (
              ORDER BY EXTRACT(EPOCH FROM ("closed_at" - "created_at"))
            ) FILTER (WHERE "closed_at" IS NOT NULL)
          )::NUMERIC,
          2
        ) AS "issue_lead_time_p75_sec"
    FROM issues
    GROUP BY 1, 2, 3
)
SELECT
    e."bucket",
    e."organization_id",
    e."repository_id",
    e."events_ingested_count",
    e."incoming_work_count",
    e."done_work_count",
    e."work_balance_delta",
    ROUND(e."done_work_count"::NUMERIC / NULLIF(e."incoming_work_count", 0), 4) AS "throughput_ratio",
    ROUND(GREATEST(e."work_balance_delta", 0)::NUMERIC / NULLIF(e."incoming_work_count", 0), 4) AS "backlog_growth_ratio",
    ROUND(GREATEST(e."done_work_count" - e."incoming_work_count", 0)::NUMERIC / NULLIF(e."done_work_count", 0), 4) AS "backlog_reduction_ratio",
    COALESCE(pr."pull_requests_merged_count", 0)::BIGINT AS "pull_requests_merged_count",
    COALESCE(pr."pull_requests_merged_after_review_count", 0)::BIGINT AS "pull_requests_merged_after_review_count",
    pr."pull_request_cycle_time_median_sec",
    pr."pull_request_cycle_time_p75_sec",
    COALESCE(i."issues_closed_count", 0)::BIGINT AS "issues_closed_count",
    i."issue_lead_time_median_sec",
    i."issue_lead_time_p75_sec",
    pr."time_to_merge_after_first_review_median_sec"
FROM event_metrics e
LEFT JOIN pull_request_metrics pr
  ON pr."bucket" = e."bucket"
 AND pr."organization_id" = e."organization_id"
 AND pr."repository_id" = e."repository_id"
LEFT JOIN issue_metrics i
  ON i."bucket" = e."bucket"
 AND i."organization_id" = e."organization_id"
 AND i."repository_id" = e."repository_id";
