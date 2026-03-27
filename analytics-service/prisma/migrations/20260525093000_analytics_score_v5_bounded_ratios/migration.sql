-- Scoring v5 normalizes bounded ratios on an absolute 0..1 scale,
-- clamps derived rate metrics, and removes stored v4 score runs.
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
  "algorithm_version" = 'analytics-score-v5',
  "category_weights" = '{"activity":0.15,"productivity":0.2,"communication":0.2,"quality":0.25,"flow":0.15,"repository_health":0.05}'::JSONB,
  "metric_weights" = '{}'::JSONB,
  "optimal_ranges" = '{
    "deletion_to_addition_ratio":{"min":0.15,"max":0.85},
    "avg_pull_request_size_lines":{"min":50,"max":450},
    "median_pull_request_size_lines":{"min":50,"max":450},
    "commit_to_pr_ratio":{"min":1,"max":8},
    "code_churn_per_pr":{"min":50,"max":600},
    "comments_per_review_ratio":{"min":0.5,"max":5},
    "post_review_change_ratio":{"min":0.15,"max":0.85},
    "review_iteration_count_avg":{"min":1,"max":3}
  }'::JSONB,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'default-user-profile';

UPDATE "analytics"."scoring_profiles"
SET
  "algorithm_version" = 'analytics-score-v5',
  "category_weights" = '{"activity":0.15,"productivity":0.15,"communication":0.15,"quality":0.25,"flow":0.15,"repository_health":0.15}'::JSONB,
  "metric_weights" = '{}'::JSONB,
  "optimal_ranges" = '{
    "deletion_to_addition_ratio":{"min":0.15,"max":0.85},
    "avg_pull_request_size_lines":{"min":50,"max":450},
    "median_pull_request_size_lines":{"min":50,"max":450},
    "commit_to_pr_ratio":{"min":1,"max":8},
    "code_churn_per_pr":{"min":50,"max":600},
    "comments_per_review_ratio":{"min":0.5,"max":5},
    "post_review_change_ratio":{"min":0.15,"max":0.85},
    "review_iteration_count_avg":{"min":1,"max":3},
    "events_per_active_contributor":{"min":3,"max":60}
  }'::JSONB,
  "updated_at" = CURRENT_TIMESTAMP
WHERE "id" = 'default-repository-profile';
