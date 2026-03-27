-- Scoring v2 removes noisy volume metrics and adds ratio/lifecycle metrics.
-- Existing persisted runs were calculated with the previous component set, so
-- invalidate them for default profiles and let the service recompute on demand.
DELETE FROM "analytics"."score_runs"
WHERE "scoring_profile_id" IN (
  'default-user-profile',
  'default-repository-profile'
);

DELETE FROM "analytics"."metric_stats"
WHERE "scoring_profile_id" IN (
  'default-user-profile',
  'default-repository-profile'
);

UPDATE "analytics"."scoring_profiles"
SET
  "algorithm_version" = 'analytics-score-v2',
  "category_weights" = '{"activity":0.15,"productivity":0.2,"communication":0.2,"quality":0.25,"flow":0.15,"repository_health":0.05}'::JSONB,
  "metric_weights" = '{}'::JSONB,
  "optimal_ranges" = '{"deletion_to_addition_ratio":{"min":0.15,"max":0.85},"avg_pull_request_size_lines":{"min":50,"max":450}}'::JSONB,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'default-user-profile';

UPDATE "analytics"."scoring_profiles"
SET
  "algorithm_version" = 'analytics-score-v2',
  "category_weights" = '{"activity":0.15,"productivity":0.15,"communication":0.15,"quality":0.25,"flow":0.15,"repository_health":0.15}'::JSONB,
  "metric_weights" = '{}'::JSONB,
  "optimal_ranges" = '{"deletion_to_addition_ratio":{"min":0.15,"max":0.85},"avg_pull_request_size_lines":{"min":50,"max":450}}'::JSONB,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'default-repository-profile';
