import type {
	MetricDirection,
	ScoreCategory
} from "@/entities/rating/model/types"

export type MetricDefinition = {
	metric: string
	category: ScoreCategory
	direction: MetricDirection
	defaultWeight: number
	optimalMin?: number
	optimalMax?: number
}

export const userMetricDefinitions: MetricDefinition[] = [
	{ metric: "events_total", category: "activity", direction: "positive", defaultWeight: 1 },
	{ metric: "event_types_covered_count", category: "activity", direction: "positive", defaultWeight: 1.2 },
	{ metric: "active_days_count", category: "activity", direction: "positive", defaultWeight: 1 },
	{ metric: "activity_share_in_team", category: "activity", direction: "positive", defaultWeight: 0.7 },
	{ metric: "commits_count", category: "productivity", direction: "positive", defaultWeight: 1 },
	{ metric: "pull_requests_created_count", category: "productivity", direction: "positive", defaultWeight: 1 },
	{ metric: "reviews_submitted_count", category: "productivity", direction: "positive", defaultWeight: 0.8 },
	{ metric: "code_churn", category: "productivity", direction: "positive", defaultWeight: 0.5 },
	{ metric: "deletion_to_addition_ratio", category: "productivity", direction: "optimal", defaultWeight: 0.8, optimalMin: 0.15, optimalMax: 0.85 },
	{ metric: "large_commit_ratio", category: "productivity", direction: "negative", defaultWeight: 0.9 },
	{ metric: "communication_events_total", category: "communication", direction: "positive", defaultWeight: 1 },
	{ metric: "comments_total_count", category: "communication", direction: "positive", defaultWeight: 0.7 },
	{ metric: "review_response_ratio", category: "communication", direction: "positive", defaultWeight: 1 },
	{ metric: "cross_actor_interaction_ratio", category: "communication", direction: "positive", defaultWeight: 0.8 },
	{ metric: "median_review_response_time_sec", category: "communication", direction: "negative", defaultWeight: 0.8 },
	{ metric: "review_coverage_rate", category: "quality", direction: "positive", defaultWeight: 1.2 },
	{ metric: "issue_reopen_rate", category: "quality", direction: "negative", defaultWeight: 0.8 },
	{ metric: "pull_request_reopen_rate", category: "quality", direction: "negative", defaultWeight: 0.8 },
	{ metric: "merged_without_review_count", category: "quality", direction: "negative", defaultWeight: 1 },
	{ metric: "rework_intensity", category: "quality", direction: "negative", defaultWeight: 1 },
	{ metric: "done_work_count", category: "flow", direction: "positive", defaultWeight: 1 },
	{ metric: "work_balance_delta", category: "flow", direction: "positive", defaultWeight: 0.9 },
	{ metric: "issue_close_rate", category: "repository_health", direction: "positive", defaultWeight: 1 },
	{ metric: "pull_request_merge_rate", category: "repository_health", direction: "positive", defaultWeight: 1 },
	{ metric: "stale_open_work_ratio", category: "repository_health", direction: "negative", defaultWeight: 1 },
	{ metric: "reopen_pressure_index", category: "repository_health", direction: "negative", defaultWeight: 1 }
]

export const repositoryMetricDefinitions: MetricDefinition[] = [
	...userMetricDefinitions.filter(
		definition => definition.metric !== "activity_share_in_team"
	),
	{ metric: "active_contributors_count", category: "activity", direction: "positive", defaultWeight: 1 },
	{ metric: "contributors_with_commits_count", category: "activity", direction: "positive", defaultWeight: 0.7 },
	{ metric: "contributors_with_reviews_count", category: "activity", direction: "positive", defaultWeight: 0.7 },
	{ metric: "throughput_ratio", category: "flow", direction: "positive", defaultWeight: 1 },
	{ metric: "backlog_growth_ratio", category: "flow", direction: "negative", defaultWeight: 1 },
	{ metric: "discussion_intensity_ratio", category: "repository_health", direction: "positive", defaultWeight: 0.6 }
]

export const defaultCategoryWeights: Record<ScoreCategory, number> = {
	activity: 0.2,
	productivity: 0.25,
	communication: 0.2,
	quality: 0.2,
	flow: 0.1,
	repository_health: 0.05
}
