-- Daily team productivity metrics by organization/repository.
CREATE VIEW "metrics"."metrics_team_productivity_daily" AS
SELECT
    "bucket",
    "organization_id",
    "repository_id",
    SUM("code_additions")::BIGINT AS "code_additions",
    SUM("code_deletions")::BIGINT AS "code_deletions",
    SUM("code_churn")::BIGINT AS "code_churn",
    SUM("net_code_change")::BIGINT AS "net_code_change",
    ROUND(SUM("code_deletions")::NUMERIC / NULLIF(SUM("code_additions"), 0), 4) AS "deletion_to_addition_ratio",
    SUM("commits_count")::BIGINT AS "commits_count",
    SUM("pull_requests_created_count")::BIGINT AS "pull_requests_created_count",
    SUM("reviews_submitted_count")::BIGINT AS "reviews_submitted_count",
    ROUND(
      SUM("avg_commit_size_lines" * "commits_count")::NUMERIC / NULLIF(SUM("commits_count"), 0),
      2
    ) AS "avg_commit_size_lines",
    ROUND(
      SUM("avg_pull_request_size_lines" * "pull_requests_created_count")::NUMERIC
      / NULLIF(SUM("pull_requests_created_count"), 0),
      2
    ) AS "avg_pull_request_size_lines",
    AVG("median_commit_size_lines") AS "median_commit_size_lines",
    AVG("median_pull_request_size_lines") AS "median_pull_request_size_lines",
    ROUND(SUM("large_commit_ratio" * "commits_count")::NUMERIC / NULLIF(SUM("commits_count"), 0), 4) AS "large_commit_ratio",
    SUM("large_pull_requests_count")::BIGINT AS "large_pull_requests_count",
    SUM("small_pull_requests_count")::BIGINT AS "small_pull_requests_count",
    ROUND(SUM("large_pull_requests_count")::NUMERIC / NULLIF(SUM("pull_requests_created_count"), 0), 4) AS "large_pull_request_ratio",
    ROUND(SUM("small_pull_requests_count")::NUMERIC / NULLIF(SUM("pull_requests_created_count"), 0), 4) AS "small_pull_request_ratio",
    SUM("pull_requests_merged_count")::BIGINT AS "pull_requests_merged_count",
    ROUND(SUM("pull_requests_merged_count")::NUMERIC / NULLIF(SUM("commits_count"), 0) * 100, 2) AS "merged_pull_requests_per_100_commits",
    ROUND(
      SUM("reviews_per_merged_pull_request" * "pull_requests_merged_count")::NUMERIC
      / NULLIF(SUM("pull_requests_merged_count"), 0),
      4
    ) AS "reviews_per_merged_pull_request"
FROM "metrics"."metrics_user_productivity_daily"
GROUP BY 1, 2, 3;
