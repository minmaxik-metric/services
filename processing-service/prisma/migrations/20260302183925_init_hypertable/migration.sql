CREATE EXTENSION IF NOT EXISTS timescaledb;

SELECT public.create_hypertable(
	'metrics.metric_events'::regclass,
	public.by_range('event_at'::name),
	TRUE,
	TRUE
);

CREATE INDEX IF NOT EXISTS "metric_events_repository_type_event_at_idx"
ON "metrics"."metric_events" ("repository_id", "type", "event_at" DESC);

CREATE INDEX IF NOT EXISTS "metric_events_pr_state_match_idx"
ON "metrics"."metric_events" (
  "repository_id",
  (NULLIF("payload" ->> 'prId', '')),
  "event_at" DESC
)
WHERE "type" = 'pull_request.state_changed';

CREATE INDEX IF NOT EXISTS "metric_events_pr_review_request_match_idx"
ON "metrics"."metric_events" (
  "repository_id",
  (NULLIF("payload" ->> 'prId', '')),
  (NULLIF("payload" -> 'requestedReviewer' ->> 'id', '')),
  "event_at" DESC
)
WHERE "type" = 'pull_request.review_requested';

CREATE INDEX IF NOT EXISTS "metric_events_pr_review_response_match_idx"
ON "metrics"."metric_events" (
  "repository_id",
  (NULLIF("payload" ->> 'prId', '')),
  (NULLIF("payload" -> 'actor' ->> 'id', '')),
  "event_at" DESC
)
WHERE "type" = 'pull_request.reviewed';

CREATE INDEX IF NOT EXISTS "metric_events_issue_state_match_idx"
ON "metrics"."metric_events" (
  "repository_id",
  (NULLIF("payload" ->> 'issueId', '')),
  "event_at" DESC
)
WHERE "type" = 'issue.state_changed';
