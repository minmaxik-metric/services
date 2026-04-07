import {
	MetricDefinition,
	ScoreCategory,
	ScoringProfile
} from "./scoring.types"

export const ALGORITHM_VERSION = "analytics-score-v5"

export const DEFAULT_USER_PROFILE_ID = "default-user-profile"
export const DEFAULT_REPOSITORY_PROFILE_ID = "default-repository-profile"

export const BOUNDED_RATIO_METRICS = new Set([
	"activity_share_in_team",
	"large_commit_ratio",
	"large_pull_request_ratio",
	"small_pull_request_ratio",
	"review_response_ratio",
	"unanswered_review_request_ratio",
	"cross_actor_interaction_ratio",
	"review_coverage_rate",
	"issue_reopen_rate",
	"pull_request_reopen_rate",
	"merged_without_review_ratio",
	"self_review_ratio",
	"self_merge_ratio",
	"throughput_ratio",
	"backlog_growth_ratio",
	"backlog_reduction_ratio",
	"stale_open_work_ratio",
	"issue_resolution_ratio",
	"issue_close_rate",
	"pull_request_merge_rate",
	"reopen_pressure_index",
	"label_coverage_ratio",
	"assignment_coverage_ratio",
	"typed_issue_ratio",
	"inactive_members_ratio",
	"bus_factor_risk_index",
	"review_load_balance_index",
	"stale_issue_ratio",
	"stale_pull_request_ratio"
])

export const USER_CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
	activity: 0.15,
	productivity: 0.2,
	communication: 0.2,
	quality: 0.25,
	flow: 0.15,
	repository_health: 0.05
}

export const REPOSITORY_CATEGORY_WEIGHTS: Record<ScoreCategory, number> = {
	activity: 0.15,
	productivity: 0.15,
	communication: 0.15,
	quality: 0.25,
	flow: 0.15,
	repository_health: 0.15
}

export const USER_METRICS: MetricDefinition[] = [
	{
		metric: "active_days_count",
		category: "activity",
		direction: "positive",
		weight: 0.8
	},
	{
		metric: "event_types_covered_count",
		category: "activity",
		direction: "positive",
		weight: 1.2
	},
	{
		metric: "activity_share_in_team",
		category: "activity",
		direction: "positive",
		weight: 0.7
	},
	{
		metric: "commits_count",
		category: "productivity",
		direction: "positive",
		weight: 1
	},
	{
		metric: "pull_requests_created_count",
		category: "productivity",
		direction: "positive",
		weight: 1
	},
	{
		metric: "avg_pull_request_size_lines",
		category: "productivity",
		direction: "optimal",
		weight: 0.7,
		denominatorMetric: "pull_requests_created_count",
		optimalMin: 50,
		optimalMax: 450
	},
	{
		metric: "median_pull_request_size_lines",
		category: "productivity",
		direction: "optimal",
		weight: 0.7,
		denominatorMetric: "pull_requests_created_count",
		optimalMin: 50,
		optimalMax: 450
	},
	{
		metric: "deletion_to_addition_ratio",
		category: "productivity",
		direction: "optimal",
		weight: 0.8,
		denominatorMetric: "code_additions",
		optimalMin: 0.15,
		optimalMax: 0.85
	},
	{
		metric: "large_commit_ratio",
		category: "productivity",
		direction: "negative",
		weight: 0.9,
		denominatorMetric: "commits_count"
	},
	{
		metric: "large_pull_request_ratio",
		category: "productivity",
		direction: "negative",
		weight: 0.9,
		denominatorMetric: "pull_requests_created_count"
	},
	{
		metric: "small_pull_request_ratio",
		category: "productivity",
		direction: "positive",
		weight: 0.8,
		denominatorMetric: "pull_requests_created_count"
	},
	{
		metric: "commit_to_pr_ratio",
		category: "productivity",
		direction: "optimal",
		weight: 0.6,
		denominatorMetric: "pull_requests_created_count",
		optimalMin: 1,
		optimalMax: 8
	},
	{
		metric: "code_churn_per_pr",
		category: "productivity",
		direction: "optimal",
		weight: 0.6,
		denominatorMetric: "pull_requests_created_count",
		optimalMin: 50,
		optimalMax: 600
	},
	{
		metric: "reviews_submitted_count",
		category: "communication",
		direction: "positive",
		weight: 0.8
	},
	{
		metric: "review_response_ratio",
		category: "communication",
		direction: "positive",
		weight: 1,
		denominatorMetric: "review_requests_count"
	},
	{
		metric: "unanswered_review_request_ratio",
		category: "communication",
		direction: "negative",
		weight: 0.8,
		denominatorMetric: "review_requests_count"
	},
	{
		metric: "cross_actor_interaction_ratio",
		category: "communication",
		direction: "positive",
		weight: 0.8
	},
	{
		metric: "median_review_response_time_sec",
		category: "communication",
		direction: "negative",
		weight: 0.8,
		sampleMetric: "review_responses_count"
	},
	{
		metric: "p75_review_response_time_sec",
		category: "communication",
		direction: "negative",
		weight: 0.6,
		sampleMetric: "review_responses_count"
	},
	{
		metric: "time_to_first_review_median_sec",
		category: "communication",
		direction: "negative",
		weight: 0.8,
		sampleMetric: "pull_requests_with_first_review_count"
	},
	{
		metric: "time_to_first_review_p75_sec",
		category: "communication",
		direction: "negative",
		weight: 0.6,
		sampleMetric: "pull_requests_with_first_review_count"
	},
	{
		metric: "comments_per_review_ratio",
		category: "communication",
		direction: "optimal",
		weight: 0.4,
		denominatorMetric: "reviews_count",
		optimalMin: 0.5,
		optimalMax: 5
	},
	{
		metric: "reviews_per_merged_pull_request",
		category: "communication",
		direction: "positive",
		weight: 0.6,
		denominatorMetric: "pull_requests_merged_count"
	},
	{
		metric: "review_coverage_rate",
		category: "quality",
		direction: "positive",
		weight: 1.2,
		denominatorMetric: "pull_requests_merged_count"
	},
	{
		metric: "issue_reopen_rate",
		category: "quality",
		direction: "negative",
		weight: 0.8,
		denominatorMetric: "issues_closed_count"
	},
	{
		metric: "pull_request_reopen_rate",
		category: "quality",
		direction: "negative",
		weight: 0.8,
		denominatorMetric: "pull_requests_merged_count"
	},
	{
		metric: "merged_without_review_ratio",
		category: "quality",
		direction: "negative",
		weight: 1,
		denominatorMetric: "pull_requests_merged_count"
	},
	{
		metric: "self_review_ratio",
		category: "quality",
		direction: "negative",
		weight: 0.7,
		denominatorMetric: "reviews_on_merged_pull_requests_count"
	},
	{
		metric: "self_merge_ratio",
		category: "quality",
		direction: "negative",
		weight: 0.7,
		denominatorMetric: "pull_requests_merged_count"
	},
	{
		metric: "post_review_change_ratio",
		category: "quality",
		direction: "optimal",
		weight: 0.5,
		sampleMetric: "post_review_change_sample_count",
		optimalMin: 0.15,
		optimalMax: 0.85
	},
	{
		metric: "review_iteration_count_avg",
		category: "quality",
		direction: "optimal",
		weight: 0.6,
		denominatorMetric: "pull_requests_with_first_review_count",
		optimalMin: 1,
		optimalMax: 3
	},
	{
		metric: "done_work_count",
		category: "flow",
		direction: "positive",
		weight: 1
	},
	{
		metric: "throughput_ratio",
		category: "flow",
		direction: "positive",
		weight: 1,
		denominatorMetric: "incoming_work_count"
	},
	{
		metric: "pull_request_cycle_time_median_sec",
		category: "flow",
		direction: "negative",
		weight: 0.8,
		sampleMetric: "pull_requests_merged_count"
	},
	{
		metric: "pull_request_cycle_time_p75_sec",
		category: "flow",
		direction: "negative",
		weight: 0.6,
		sampleMetric: "pull_requests_merged_count"
	},
	{
		metric: "issue_lead_time_median_sec",
		category: "flow",
		direction: "negative",
		weight: 0.6,
		sampleMetric: "issues_closed_count"
	},
	{
		metric: "issue_lead_time_p75_sec",
		category: "flow",
		direction: "negative",
		weight: 0.5,
		sampleMetric: "issues_closed_count"
	},
	{
		metric: "time_to_merge_after_first_review_median_sec",
		category: "flow",
		direction: "negative",
		weight: 0.6,
		sampleMetric: "pull_requests_merged_after_review_count"
	},
	{
		metric: "backlog_growth_ratio",
		category: "flow",
		direction: "negative",
		weight: 1,
		denominatorMetric: "incoming_work_count"
	},
	{
		metric: "backlog_reduction_ratio",
		category: "flow",
		direction: "positive",
		weight: 1,
		denominatorMetric: "done_work_count"
	},
	{
		metric: "stale_open_work_ratio",
		category: "repository_health",
		direction: "negative",
		weight: 1,
		denominatorMetric: "created_work_count"
	},
	{
		metric: "issue_resolution_ratio",
		category: "repository_health",
		direction: "positive",
		weight: 0.8,
		denominatorMetric: "issues_created_count"
	},
	{
		metric: "issue_close_rate",
		category: "repository_health",
		direction: "positive",
		weight: 0.6,
		denominatorMetric: "issues_created_count"
	},
	{
		metric: "pull_request_merge_rate",
		category: "repository_health",
		direction: "positive",
		weight: 0.6,
		denominatorMetric: "health_pull_requests_created_count"
	},
	{
		metric: "reopen_pressure_index",
		category: "repository_health",
		direction: "negative",
		weight: 1,
		denominatorMetric: "created_work_count"
	},
	{
		metric: "label_coverage_ratio",
		category: "repository_health",
		direction: "positive",
		weight: 0.5,
		denominatorMetric: "created_work_count"
	},
	{
		metric: "assignment_coverage_ratio",
		category: "repository_health",
		direction: "positive",
		weight: 0.5,
		denominatorMetric: "created_work_count"
	},
	{
		metric: "typed_issue_ratio",
		category: "repository_health",
		direction: "positive",
		weight: 0.4,
		denominatorMetric: "issues_created_count"
	}
]

export const REPOSITORY_METRICS: MetricDefinition[] = [
	...USER_METRICS.filter(
		definition => definition.metric !== "activity_share_in_team"
	),
	{
		metric: "active_contributors_count",
		category: "activity",
		direction: "positive",
		weight: 1
	},
	{
		metric: "contributors_with_commits_count",
		category: "activity",
		direction: "positive",
		weight: 0.7
	},
	{
		metric: "contributors_with_reviews_count",
		category: "activity",
		direction: "positive",
		weight: 0.7
	},
	{
		metric: "active_communicators_count",
		category: "communication",
		direction: "positive",
		weight: 0.7
	},
	{
		metric: "events_per_active_contributor",
		category: "activity",
		direction: "optimal",
		weight: 0.4,
		denominatorMetric: "active_contributors_count",
		optimalMin: 3,
		optimalMax: 60
	},
	{
		metric: "inactive_members_ratio",
		category: "activity",
		direction: "negative",
		weight: 0.6,
		denominatorMetric: "repository_members_count"
	},
	{
		metric: "bus_factor_risk_index",
		category: "activity",
		direction: "negative",
		weight: 0.6,
		denominatorMetric: "events_total"
	},
	{
		metric: "review_load_balance_index",
		category: "communication",
		direction: "positive",
		weight: 0.6,
		denominatorMetric: "reviews_submitted_count"
	},
	{
		metric: "discussion_intensity_ratio",
		category: "repository_health",
		direction: "positive",
		weight: 0.6,
		denominatorMetric: "created_work_count"
	},
	{
		metric: "open_issue_aging_p75_sec",
		category: "repository_health",
		direction: "negative",
		weight: 0.5,
		sampleMetric: "open_issues_count"
	},
	{
		metric: "open_pull_request_aging_p75_sec",
		category: "repository_health",
		direction: "negative",
		weight: 0.5,
		sampleMetric: "open_pull_requests_count"
	},
	{
		metric: "stale_issue_ratio",
		category: "repository_health",
		direction: "negative",
		weight: 0.5,
		denominatorMetric: "open_issues_count"
	},
	{
		metric: "stale_pull_request_ratio",
		category: "repository_health",
		direction: "negative",
		weight: 0.5,
		denominatorMetric: "open_pull_requests_count"
	}
]

export const DEFAULT_SCORING_PROFILES: Record<
	"USER" | "REPOSITORY",
	ScoringProfile
> = {
	USER: {
		id: DEFAULT_USER_PROFILE_ID,
		name: "Default user rating profile",
		subjectType: "USER",
		algorithmVersion: ALGORITHM_VERSION,
		categoryWeights: USER_CATEGORY_WEIGHTS,
		metricWeights: {},
		optimalRanges: {
			deletion_to_addition_ratio: { min: 0.15, max: 0.85 },
			avg_pull_request_size_lines: { min: 50, max: 450 },
			median_pull_request_size_lines: { min: 50, max: 450 },
			commit_to_pr_ratio: { min: 1, max: 8 },
			code_churn_per_pr: { min: 50, max: 600 },
			comments_per_review_ratio: { min: 0.5, max: 5 },
			post_review_change_ratio: { min: 0.15, max: 0.85 },
			review_iteration_count_avg: { min: 1, max: 3 }
		}
	},
	REPOSITORY: {
		id: DEFAULT_REPOSITORY_PROFILE_ID,
		name: "Default repository team rating profile",
		subjectType: "REPOSITORY",
		algorithmVersion: ALGORITHM_VERSION,
		categoryWeights: REPOSITORY_CATEGORY_WEIGHTS,
		metricWeights: {},
		optimalRanges: {
			deletion_to_addition_ratio: { min: 0.15, max: 0.85 },
			avg_pull_request_size_lines: { min: 50, max: 450 },
			median_pull_request_size_lines: { min: 50, max: 450 },
			commit_to_pr_ratio: { min: 1, max: 8 },
			code_churn_per_pr: { min: 50, max: 600 },
			comments_per_review_ratio: { min: 0.5, max: 5 },
			post_review_change_ratio: { min: 0.15, max: 0.85 },
			review_iteration_count_avg: { min: 1, max: 3 },
			events_per_active_contributor: { min: 3, max: 60 }
		}
	}
}
