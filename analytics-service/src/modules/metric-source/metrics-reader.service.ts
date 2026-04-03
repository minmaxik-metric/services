import { RpcStatus } from "@citec-spbu/common"
import { Injectable } from "@nestjs/common"
import { RpcException } from "@nestjs/microservices"

import { PrismaService } from "@/infrastructure/prisma/prisma.service"
import type {
	SemesterName,
	SemesterOption
} from "@/modules/ratings/rating.types"
import { BOUNDED_RATIO_METRICS } from "@/modules/scoring/scoring.config"

import { RawRatingRow } from "./raw-rating-row"

type DbRow = Record<string, unknown>
type SemesterRow = {
	semester: string
	year: number
	label: string
	dateFrom: Date
	dateTo: Date
}
export type EventTypeCountRow = {
	repositoryId: string
	subjectId: string
	eventTypesCoveredCount: number
}
export type PullRequestSizeStatsRow = {
	repositoryId: string
	subjectId: string
	pullRequestsCreatedCount: number
	avgPullRequestSizeLines: number
	medianPullRequestSizeLines: number
}
export type PullRequestTimingStatsRow = {
	repositoryId: string
	subjectId: string
	medianReviewResponseTimeSec: number
	p75ReviewResponseTimeSec: number
	timeToFirstReviewMedianSec: number
	timeToFirstReviewP75Sec: number
	pullRequestCycleTimeMedianSec: number
	pullRequestCycleTimeP75Sec: number
	issueLeadTimeMedianSec: number
	issueLeadTimeP75Sec: number
}

@Injectable()
export class MetricsReaderService {
	public constructor(private readonly prisma: PrismaService) {}

	public async getUserRows(input: {
		organizationId: string
		repositoryId: string
		bucket: Date | Date[] | null
	}) {
		const buckets = await this.resolveUserBuckets(input)

		if (buckets.length === 0) return []

		const rows = await this.prisma.$queryRawUnsafe<DbRow[]>(
			`
			WITH a AS (
				SELECT
					"bucket",
					"organization_id",
					"repository_id",
					"contributor_id",
					MAX("contributor_login") AS "contributor_login",
					SUM("events_total")::BIGINT AS "events_total",
					MAX("event_types_covered_count")::BIGINT AS "event_types_covered_count",
					MAX("active_days_count")::BIGINT AS "active_days_count",
					MAX("activity_consistency_score") AS "activity_consistency_score",
					SUM("activity_share_in_team") AS "activity_share_in_team"
				FROM "metrics"."metrics_user_activity_daily_with_team_share"
				WHERE ($2 = '' OR "repository_id" = $2)
					AND "bucket" = ANY($3::TIMESTAMPTZ[])
				GROUP BY 1, 2, 3, 4
			),
			p AS (
				SELECT
					"bucket",
					"organization_id",
					"repository_id",
					"contributor_id",
					SUM("code_additions")::BIGINT AS "code_additions",
					SUM("code_deletions")::BIGINT AS "code_deletions",
					SUM("code_churn")::BIGINT AS "code_churn",
					SUM("net_code_change")::BIGINT AS "net_code_change",
					ROUND(SUM("code_deletions")::NUMERIC / NULLIF(SUM("code_additions"), 0), 4) AS "deletion_to_addition_ratio",
					SUM("commits_count")::BIGINT AS "commits_count",
					SUM("pull_requests_created_count")::BIGINT AS "pull_requests_created_count",
					SUM("reviews_submitted_count")::BIGINT AS "reviews_submitted_count",
					ROUND(SUM("avg_commit_size_lines" * "commits_count")::NUMERIC / NULLIF(SUM("commits_count"), 0), 2) AS "avg_commit_size_lines",
					ROUND(SUM("avg_pull_request_size_lines" * "pull_requests_created_count")::NUMERIC / NULLIF(SUM("pull_requests_created_count"), 0), 2) AS "avg_pull_request_size_lines",
					AVG("median_commit_size_lines") AS "median_commit_size_lines",
					AVG("median_pull_request_size_lines") AS "median_pull_request_size_lines",
					ROUND(SUM("large_commit_ratio" * "commits_count")::NUMERIC / NULLIF(SUM("commits_count"), 0), 4) AS "large_commit_ratio",
					SUM("large_pull_requests_count")::BIGINT AS "large_pull_requests_count",
					SUM("small_pull_requests_count")::BIGINT AS "small_pull_requests_count",
					ROUND(SUM("large_pull_requests_count")::NUMERIC / NULLIF(SUM("pull_requests_created_count"), 0), 4) AS "large_pull_request_ratio",
					ROUND(SUM("small_pull_requests_count")::NUMERIC / NULLIF(SUM("pull_requests_created_count"), 0), 4) AS "small_pull_request_ratio",
					SUM("pull_requests_merged_count")::BIGINT AS "pull_requests_merged_count",
					AVG("merged_pull_requests_per_100_commits") AS "merged_pull_requests_per_100_commits",
					AVG("reviews_per_merged_pull_request") AS "reviews_per_merged_pull_request"
				FROM "metrics"."metrics_user_productivity_daily"
				WHERE ($2 = '' OR "repository_id" = $2)
					AND "bucket" = ANY($3::TIMESTAMPTZ[])
				GROUP BY 1, 2, 3, 4
			),
			c AS (
				SELECT
					"bucket",
					"organization_id",
					"repository_id",
					"contributor_id",
					SUM("communication_events_total")::BIGINT AS "communication_events_total",
					SUM("comments_total_count")::BIGINT AS "comments_total_count",
					SUM("issue_comments_count")::BIGINT AS "issue_comments_count",
					SUM("pull_request_comments_count")::BIGINT AS "pull_request_comments_count",
					SUM("reviews_count")::BIGINT AS "reviews_count",
					SUM("labels_changed_count")::BIGINT AS "labels_changed_count",
					SUM("assignees_changed_count")::BIGINT AS "assignees_changed_count",
					SUM("assignment_events_total")::BIGINT AS "assignment_events_total",
					AVG("comments_per_review_ratio") AS "comments_per_review_ratio",
					SUM("review_requests_count")::BIGINT AS "review_requests_count",
					ROUND(SUM("review_responses_count")::NUMERIC / NULLIF(SUM("review_requests_count"), 0), 4) AS "review_response_ratio",
					SUM("review_responses_count")::BIGINT AS "review_responses_count",
					AVG("median_review_response_time_sec") AS "median_review_response_time_sec",
					AVG("p75_review_response_time_sec") AS "p75_review_response_time_sec",
					AVG("cross_actor_interaction_ratio") AS "cross_actor_interaction_ratio",
					SUM("review_queue_pressure")::BIGINT AS "review_queue_pressure",
					ROUND(SUM("review_queue_pressure")::NUMERIC / NULLIF(SUM("review_requests_count"), 0), 4) AS "unanswered_review_request_ratio",
					SUM("pull_requests_with_first_review_count")::BIGINT AS "pull_requests_with_first_review_count",
					AVG("time_to_first_review_median_sec") AS "time_to_first_review_median_sec",
					AVG("time_to_first_review_p75_sec") AS "time_to_first_review_p75_sec"
				FROM "metrics"."metrics_user_communication_daily"
				WHERE ($2 = '' OR "repository_id" = $2)
					AND "bucket" = ANY($3::TIMESTAMPTZ[])
				GROUP BY 1, 2, 3, 4
			),
			q AS (
				SELECT
					"bucket",
					"organization_id",
					"repository_id",
					"contributor_id",
					SUM("issues_reopened_count")::BIGINT AS "issues_reopened_count",
					SUM("pull_requests_reopened_count")::BIGINT AS "pull_requests_reopened_count",
					SUM("pull_requests_reviewed_count")::BIGINT AS "pull_requests_reviewed_count",
					SUM("pull_requests_review_requested_count")::BIGINT AS "pull_requests_review_requested_count",
					SUM("merged_without_review_count")::BIGINT AS "merged_without_review_count",
					SUM("pull_requests_merged_count")::BIGINT AS "pull_requests_merged_count",
					SUM("pull_requests_merged_after_review_count")::BIGINT AS "pull_requests_merged_after_review_count",
					SUM("merged_with_review_count")::BIGINT AS "merged_with_review_count",
					AVG("issue_reopen_rate") AS "issue_reopen_rate",
					AVG("pull_request_reopen_rate") AS "pull_request_reopen_rate",
					AVG("review_coverage_rate") AS "review_coverage_rate",
					AVG("merged_without_review_ratio") AS "merged_without_review_ratio",
					SUM("reviews_on_pull_requests_count")::BIGINT AS "reviews_on_pull_requests_count",
					SUM("reviews_on_merged_pull_requests_count")::BIGINT AS "reviews_on_merged_pull_requests_count",
					SUM("self_reviews_count")::BIGINT AS "self_reviews_count",
					SUM("self_merged_pull_requests_count")::BIGINT AS "self_merged_pull_requests_count",
					AVG("self_review_ratio") AS "self_review_ratio",
					AVG("self_merge_ratio") AS "self_merge_ratio",
					AVG("post_review_change_ratio") AS "post_review_change_ratio",
					SUM("post_review_change_sample_count")::BIGINT AS "post_review_change_sample_count",
					AVG("review_iteration_count_avg") AS "review_iteration_count_avg",
					AVG("rework_intensity") AS "rework_intensity"
				FROM "metrics"."metrics_user_quality_daily"
				WHERE ($2 = '' OR "repository_id" = $2)
					AND "bucket" = ANY($3::TIMESTAMPTZ[])
				GROUP BY 1, 2, 3, 4
			),
			f AS (
				SELECT
					"bucket",
					"organization_id",
					"repository_id",
					"contributor_id",
					SUM("events_ingested_count")::BIGINT AS "events_ingested_count",
					SUM("incoming_work_count")::BIGINT AS "incoming_work_count",
					SUM("done_work_count")::BIGINT AS "done_work_count",
					SUM("work_balance_delta")::BIGINT AS "work_balance_delta",
					ROUND(SUM("done_work_count")::NUMERIC / NULLIF(SUM("incoming_work_count"), 0), 4) AS "throughput_ratio",
					ROUND(GREATEST(SUM("work_balance_delta"), 0)::NUMERIC / NULLIF(SUM("incoming_work_count"), 0), 4) AS "backlog_growth_ratio",
					ROUND(GREATEST(SUM("done_work_count") - SUM("incoming_work_count"), 0)::NUMERIC / NULLIF(SUM("done_work_count"), 0), 4) AS "backlog_reduction_ratio",
					SUM("pull_requests_merged_count")::BIGINT AS "pull_requests_merged_count",
					SUM("pull_requests_merged_after_review_count")::BIGINT AS "pull_requests_merged_after_review_count",
					AVG("pull_request_cycle_time_median_sec") AS "pull_request_cycle_time_median_sec",
					AVG("pull_request_cycle_time_p75_sec") AS "pull_request_cycle_time_p75_sec",
					SUM("issues_closed_count")::BIGINT AS "issues_closed_count",
					AVG("issue_lead_time_median_sec") AS "issue_lead_time_median_sec",
					AVG("issue_lead_time_p75_sec") AS "issue_lead_time_p75_sec",
					AVG("time_to_merge_after_first_review_median_sec") AS "time_to_merge_after_first_review_median_sec"
				FROM "metrics"."metrics_user_flow_daily"
				WHERE ($2 = '' OR "repository_id" = $2)
					AND "bucket" = ANY($3::TIMESTAMPTZ[])
				GROUP BY 1, 2, 3, 4
			),
			h AS (
				SELECT
					"bucket",
					"organization_id",
					"repository_id",
					"contributor_id",
					SUM("issues_created_count")::BIGINT AS "issues_created_count",
					SUM("pull_requests_created_count")::BIGINT AS "health_pull_requests_created_count",
					SUM("issue_backlog_delta")::BIGINT AS "issue_backlog_delta",
					SUM("pull_request_backlog_delta")::BIGINT AS "pull_request_backlog_delta",
					SUM("issues_closed_count")::BIGINT AS "issues_closed_count",
					SUM("created_work_count")::BIGINT AS "created_work_count",
					ROUND((SUM("issues_created_count") - SUM("issue_backlog_delta"))::NUMERIC / NULLIF(SUM("issues_created_count"), 0), 4) AS "issue_close_rate",
					ROUND((SUM("pull_requests_created_count") - SUM("pull_request_backlog_delta"))::NUMERIC / NULLIF(SUM("pull_requests_created_count"), 0), 4) AS "pull_request_merge_rate",
					ROUND(GREATEST(SUM("issue_backlog_delta") + SUM("pull_request_backlog_delta"), 0)::NUMERIC / NULLIF(SUM("issues_created_count") + SUM("pull_requests_created_count"), 0), 4) AS "stale_open_work_ratio",
					AVG("reopen_pressure_index") AS "reopen_pressure_index",
					AVG("issue_resolution_ratio") AS "issue_resolution_ratio",
					AVG("label_coverage_ratio") AS "label_coverage_ratio",
					AVG("assignment_coverage_ratio") AS "assignment_coverage_ratio",
					AVG("typed_issue_ratio") AS "typed_issue_ratio"
				FROM "metrics"."metrics_user_repository_health_daily"
				WHERE ($2 = '' OR "repository_id" = $2)
					AND "bucket" = ANY($3::TIMESTAMPTZ[])
				GROUP BY 1, 2, 3, 4
			)
			SELECT
				a."bucket" AS "bucket",
				a."organization_id" AS "organizationId",
				a."repository_id" AS "repositoryId",
				a."contributor_id" AS "subjectId",
				COALESCE(NULLIF(u."login", ''), a."contributor_login") AS "subjectLabel",

				a."events_total" AS "events_total",
				a."event_types_covered_count" AS "event_types_covered_count",
				a."active_days_count" AS "active_days_count",
				a."activity_consistency_score" AS "activity_consistency_score",
				a."activity_share_in_team" AS "activity_share_in_team",

				p."code_additions" AS "code_additions",
				p."code_deletions" AS "code_deletions",
				p."code_churn" AS "code_churn",
					p."net_code_change" AS "net_code_change",
					p."deletion_to_addition_ratio" AS "deletion_to_addition_ratio",
					p."commits_count" AS "commits_count",
					p."pull_requests_created_count" AS "pull_requests_created_count",
					p."reviews_submitted_count" AS "reviews_submitted_count",
					p."avg_commit_size_lines" AS "avg_commit_size_lines",
					p."avg_pull_request_size_lines" AS "avg_pull_request_size_lines",
					p."median_commit_size_lines" AS "median_commit_size_lines",
					p."median_pull_request_size_lines" AS "median_pull_request_size_lines",
					p."large_commit_ratio" AS "large_commit_ratio",
					p."large_pull_request_ratio" AS "large_pull_request_ratio",
					p."small_pull_request_ratio" AS "small_pull_request_ratio",
					ROUND(p."commits_count"::NUMERIC / NULLIF(p."pull_requests_created_count", 0), 4) AS "commit_to_pr_ratio",
					ROUND(p."code_churn"::NUMERIC / NULLIF(p."pull_requests_created_count", 0), 4) AS "code_churn_per_pr",
					p."merged_pull_requests_per_100_commits" AS "merged_pull_requests_per_100_commits",
					p."reviews_per_merged_pull_request" AS "reviews_per_merged_pull_request",

					c."communication_events_total" AS "communication_events_total",
					c."comments_total_count" AS "comments_total_count",
					c."issue_comments_count" AS "issue_comments_count",
					c."pull_request_comments_count" AS "pull_request_comments_count",
					c."reviews_count" AS "reviews_count",
					c."labels_changed_count" AS "labels_changed_count",
					c."assignees_changed_count" AS "assignees_changed_count",
					c."assignment_events_total" AS "assignment_events_total",
					c."comments_per_review_ratio" AS "comments_per_review_ratio",
					c."review_requests_count" AS "review_requests_count",
					c."review_response_ratio" AS "review_response_ratio",
					c."review_responses_count" AS "review_responses_count",
					c."median_review_response_time_sec" AS "median_review_response_time_sec",
					c."p75_review_response_time_sec" AS "p75_review_response_time_sec",
					c."cross_actor_interaction_ratio" AS "cross_actor_interaction_ratio",
					c."review_queue_pressure" AS "review_queue_pressure",
					c."unanswered_review_request_ratio" AS "unanswered_review_request_ratio",

					q."issues_reopened_count" AS "issues_reopened_count",
					q."pull_requests_reopened_count" AS "pull_requests_reopened_count",
					q."pull_requests_reviewed_count" AS "pull_requests_reviewed_count",
					q."pull_requests_review_requested_count" AS "pull_requests_review_requested_count",
					q."merged_without_review_count" AS "merged_without_review_count",
					q."merged_with_review_count" AS "merged_with_review_count",
					q."issue_reopen_rate" AS "issue_reopen_rate",
					q."pull_request_reopen_rate" AS "pull_request_reopen_rate",
					q."review_coverage_rate" AS "review_coverage_rate",
					q."merged_without_review_ratio" AS "merged_without_review_ratio",
					q."reviews_on_pull_requests_count" AS "reviews_on_pull_requests_count",
					q."reviews_on_merged_pull_requests_count" AS "reviews_on_merged_pull_requests_count",
					q."self_reviews_count" AS "self_reviews_count",
					q."self_merged_pull_requests_count" AS "self_merged_pull_requests_count",
					q."self_review_ratio" AS "self_review_ratio",
					q."self_merge_ratio" AS "self_merge_ratio",
					q."post_review_change_ratio" AS "post_review_change_ratio",
					q."post_review_change_sample_count" AS "post_review_change_sample_count",
					q."review_iteration_count_avg" AS "review_iteration_count_avg",
					q."rework_intensity" AS "rework_intensity",

					f."events_ingested_count" AS "events_ingested_count",
					f."incoming_work_count" AS "incoming_work_count",
					f."done_work_count" AS "done_work_count",
					f."work_balance_delta" AS "work_balance_delta",

					h."issues_created_count" AS "issues_created_count",
					h."health_pull_requests_created_count" AS "health_pull_requests_created_count",
					h."issue_backlog_delta" AS "issue_backlog_delta",
					h."pull_request_backlog_delta" AS "pull_request_backlog_delta",
					h."created_work_count" AS "created_work_count",
					h."issue_close_rate" AS "issue_close_rate",
					h."pull_request_merge_rate" AS "pull_request_merge_rate",
					h."stale_open_work_ratio" AS "stale_open_work_ratio",
					h."reopen_pressure_index" AS "reopen_pressure_index",
					h."label_coverage_ratio" AS "label_coverage_ratio",
					h."assignment_coverage_ratio" AS "assignment_coverage_ratio",
					h."typed_issue_ratio" AS "typed_issue_ratio",

					f."pull_requests_merged_count" AS "pull_requests_merged_count",
					c."pull_requests_with_first_review_count" AS "pull_requests_with_first_review_count",
					q."pull_requests_merged_after_review_count" AS "pull_requests_merged_after_review_count",
					f."pull_request_cycle_time_median_sec" AS "pull_request_cycle_time_median_sec",
					f."pull_request_cycle_time_p75_sec" AS "pull_request_cycle_time_p75_sec",
					c."time_to_first_review_median_sec" AS "time_to_first_review_median_sec",
					c."time_to_first_review_p75_sec" AS "time_to_first_review_p75_sec",
					p."large_pull_requests_count" AS "large_pull_requests_count",
					p."small_pull_requests_count" AS "small_pull_requests_count",
					h."issues_closed_count" AS "issues_closed_count",
					f."issue_lead_time_median_sec" AS "issue_lead_time_median_sec",
					f."issue_lead_time_p75_sec" AS "issue_lead_time_p75_sec",
					f."time_to_merge_after_first_review_median_sec" AS "time_to_merge_after_first_review_median_sec",
					h."issue_resolution_ratio" AS "issue_resolution_ratio"
			FROM a
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = a."organization_id"
			LEFT JOIN "metrics"."users" u
				ON u."id" = a."contributor_id"
			LEFT JOIN p
				ON p."bucket" = a."bucket"
				AND p."organization_id" = a."organization_id"
				AND p."repository_id" = a."repository_id"
				AND p."contributor_id" = a."contributor_id"
			LEFT JOIN c
				ON c."bucket" = a."bucket"
				AND c."organization_id" = a."organization_id"
				AND c."repository_id" = a."repository_id"
				AND c."contributor_id" = a."contributor_id"
			LEFT JOIN q
				ON q."bucket" = a."bucket"
				AND q."organization_id" = a."organization_id"
				AND q."repository_id" = a."repository_id"
				AND q."contributor_id" = a."contributor_id"
				LEFT JOIN f
					ON f."bucket" = a."bucket"
					AND f."organization_id" = a."organization_id"
					AND f."repository_id" = a."repository_id"
					AND f."contributor_id" = a."contributor_id"
				LEFT JOIN h
					ON h."bucket" = a."bucket"
					AND h."organization_id" = a."organization_id"
					AND h."repository_id" = a."repository_id"
					AND h."contributor_id" = a."contributor_id"
				WHERE (
				$1 = ''
				OR a."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
			ORDER BY COALESCE(NULLIF(u."login", ''), a."contributor_login") ASC
			`,
			input.organizationId,
			input.repositoryId,
			buckets
		)

		return this.mapRows(rows)
	}

	public async getRepositoryRows(input: {
		organizationId: string
		bucket: Date | Date[] | null
	}) {
		const buckets = await this.resolveRepositoryBuckets(input)

		if (buckets.length === 0) return []

		const rows = await this.prisma.$queryRawUnsafe<DbRow[]>(
			`
			SELECT
				a."bucket" AS "bucket",
				a."organization_id" AS "organizationId",
				a."repository_id" AS "repositoryId",
				a."repository_id" AS "subjectId",
				COALESCE(r."name", a."repository_id") AS "subjectLabel",
				COALESCE(r."url", '') AS "repositoryUrl",

				a."events_total" AS "events_total",
				a."active_contributors_count" AS "active_contributors_count",
				a."events_per_active_contributor" AS "events_per_active_contributor",
				a."contributors_with_commits_count" AS "contributors_with_commits_count",
				a."contributors_with_reviews_count" AS "contributors_with_reviews_count",
				a."event_types_covered_count" AS "event_types_covered_count",
				a."active_days_count" AS "active_days_count",
				a."activity_consistency_score" AS "activity_consistency_score",

				p."code_additions" AS "code_additions",
				p."code_deletions" AS "code_deletions",
				p."code_churn" AS "code_churn",
				p."net_code_change" AS "net_code_change",
				p."deletion_to_addition_ratio" AS "deletion_to_addition_ratio",
				p."commits_count" AS "commits_count",
				p."pull_requests_created_count" AS "pull_requests_created_count",
				p."reviews_submitted_count" AS "reviews_submitted_count",
				p."avg_commit_size_lines" AS "avg_commit_size_lines",
				p."avg_pull_request_size_lines" AS "avg_pull_request_size_lines",
				p."median_commit_size_lines" AS "median_commit_size_lines",
				p."median_pull_request_size_lines" AS "median_pull_request_size_lines",
				p."large_commit_ratio" AS "large_commit_ratio",
				p."large_pull_request_ratio" AS "large_pull_request_ratio",
				p."small_pull_request_ratio" AS "small_pull_request_ratio",
				ROUND(p."commits_count"::NUMERIC / NULLIF(p."pull_requests_created_count", 0), 4) AS "commit_to_pr_ratio",
				ROUND(p."code_churn"::NUMERIC / NULLIF(p."pull_requests_created_count", 0), 4) AS "code_churn_per_pr",
				p."merged_pull_requests_per_100_commits" AS "merged_pull_requests_per_100_commits",
				p."reviews_per_merged_pull_request" AS "reviews_per_merged_pull_request",

				c."communication_events_total" AS "communication_events_total",
				c."comments_total_count" AS "comments_total_count",
				c."issue_comments_count" AS "issue_comments_count",
				c."pull_request_comments_count" AS "pull_request_comments_count",
				c."reviews_count" AS "reviews_count",
				c."labels_changed_count" AS "labels_changed_count",
				c."assignees_changed_count" AS "assignees_changed_count",
				c."assignment_events_total" AS "assignment_events_total",
				c."comments_per_review_ratio" AS "comments_per_review_ratio",
				c."review_requests_count" AS "review_requests_count",
				c."review_response_ratio" AS "review_response_ratio",
				c."review_responses_count" AS "review_responses_count",
				c."median_review_response_time_sec" AS "median_review_response_time_sec",
				c."p75_review_response_time_sec" AS "p75_review_response_time_sec",
				c."cross_actor_interaction_ratio" AS "cross_actor_interaction_ratio",
				c."review_queue_pressure" AS "review_queue_pressure",
				c."unanswered_review_request_ratio" AS "unanswered_review_request_ratio",
				c."active_communicators_count" AS "active_communicators_count",

				q."issues_reopened_count" AS "issues_reopened_count",
				q."pull_requests_reopened_count" AS "pull_requests_reopened_count",
				q."pull_requests_reviewed_count" AS "pull_requests_reviewed_count",
				q."pull_requests_review_requested_count" AS "pull_requests_review_requested_count",
				q."large_changes_count" AS "large_changes_count",
				q."merged_without_review_count" AS "merged_without_review_count",
				q."merged_with_review_count" AS "merged_with_review_count",
				q."issue_reopen_rate" AS "issue_reopen_rate",
				q."pull_request_reopen_rate" AS "pull_request_reopen_rate",
				q."large_change_ratio" AS "large_change_ratio",
				q."review_coverage_rate" AS "review_coverage_rate",
				q."merged_without_review_ratio" AS "merged_without_review_ratio",
				q."reviews_on_pull_requests_count" AS "reviews_on_pull_requests_count",
				q."reviews_on_merged_pull_requests_count" AS "reviews_on_merged_pull_requests_count",
				q."self_reviews_count" AS "self_reviews_count",
				q."self_merged_pull_requests_count" AS "self_merged_pull_requests_count",
				q."self_review_ratio" AS "self_review_ratio",
				q."self_merge_ratio" AS "self_merge_ratio",
				q."post_review_change_ratio" AS "post_review_change_ratio",
				q."post_review_change_sample_count" AS "post_review_change_sample_count",
				q."review_iteration_count_avg" AS "review_iteration_count_avg",
				q."rework_intensity" AS "rework_intensity",

				f."events_ingested_count" AS "events_ingested_count",
				f."incoming_work_count" AS "incoming_work_count",
				f."done_work_count" AS "done_work_count",
				f."work_balance_delta" AS "work_balance_delta",
				f."throughput_ratio" AS "throughput_ratio",
				f."backlog_growth_ratio" AS "backlog_growth_ratio",

				h."issues_created_count" AS "issues_created_count",
				h."pull_requests_created_count" AS "health_pull_requests_created_count",
				h."issue_backlog_delta" AS "issue_backlog_delta",
				h."pull_request_backlog_delta" AS "pull_request_backlog_delta",
				h."total_backlog_delta" AS "total_backlog_delta",
				h."created_work_count" AS "created_work_count",
				h."issue_close_rate" AS "issue_close_rate",
				h."pull_request_merge_rate" AS "pull_request_merge_rate",
				h."stale_open_work_ratio" AS "stale_open_work_ratio",
				h."reopen_pressure_index" AS "reopen_pressure_index",
				h."queue_stability_index" AS "queue_stability_index",
				h."discussion_intensity_ratio" AS "discussion_intensity_ratio",
				h."label_coverage_ratio" AS "label_coverage_ratio",
				h."assignment_coverage_ratio" AS "assignment_coverage_ratio",
				h."typed_issue_ratio" AS "typed_issue_ratio",
				h."repository_members_count" AS "repository_members_count",
				h."inactive_members_ratio" AS "inactive_members_ratio",
				h."bus_factor_risk_index" AS "bus_factor_risk_index",
				c."review_load_balance_index" AS "review_load_balance_index",
				h."open_issues_count" AS "open_issues_count",
				h."stale_issues_count" AS "stale_issues_count",
				h."open_issue_aging_p75_sec" AS "open_issue_aging_p75_sec",
				h."stale_issue_ratio" AS "stale_issue_ratio",
				h."open_pull_requests_count" AS "open_pull_requests_count",
				h."stale_pull_requests_count" AS "stale_pull_requests_count",
				h."open_pull_request_aging_p75_sec" AS "open_pull_request_aging_p75_sec",
				h."stale_pull_request_ratio" AS "stale_pull_request_ratio",

				f."pull_requests_merged_count" AS "pull_requests_merged_count",
				c."pull_requests_with_first_review_count" AS "pull_requests_with_first_review_count",
				q."pull_requests_merged_after_review_count" AS "pull_requests_merged_after_review_count",
				f."pull_request_cycle_time_median_sec" AS "pull_request_cycle_time_median_sec",
				f."pull_request_cycle_time_p75_sec" AS "pull_request_cycle_time_p75_sec",
				c."time_to_first_review_median_sec" AS "time_to_first_review_median_sec",
				c."time_to_first_review_p75_sec" AS "time_to_first_review_p75_sec",
				p."large_pull_requests_count" AS "large_pull_requests_count",
				p."small_pull_requests_count" AS "small_pull_requests_count",
				h."issues_closed_count" AS "issues_closed_count",
				f."issue_lead_time_median_sec" AS "issue_lead_time_median_sec",
				f."issue_lead_time_p75_sec" AS "issue_lead_time_p75_sec",
				f."time_to_merge_after_first_review_median_sec" AS "time_to_merge_after_first_review_median_sec",
				h."issue_resolution_ratio" AS "issue_resolution_ratio"
			FROM "metrics"."metrics_team_activity_daily" a
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = a."organization_id"
			LEFT JOIN "metrics"."repositories" r
				ON r."id" = a."repository_id"
			LEFT JOIN "metrics"."metrics_team_productivity_daily" p
				ON p."bucket" = a."bucket"
				AND p."organization_id" = a."organization_id"
				AND p."repository_id" = a."repository_id"
			LEFT JOIN "metrics"."metrics_team_communication_daily" c
				ON c."bucket" = a."bucket"
				AND c."organization_id" = a."organization_id"
				AND c."repository_id" = a."repository_id"
			LEFT JOIN "metrics"."metrics_team_quality_daily" q
				ON q."bucket" = a."bucket"
				AND q."organization_id" = a."organization_id"
				AND q."repository_id" = a."repository_id"
			LEFT JOIN "metrics"."metrics_team_flow_daily" f
				ON f."bucket" = a."bucket"
				AND f."organization_id" = a."organization_id"
				AND f."repository_id" = a."repository_id"
			LEFT JOIN "metrics"."metrics_team_repository_health_daily" h
				ON h."bucket" = a."bucket"
				AND h."organization_id" = a."organization_id"
				AND h."repository_id" = a."repository_id"
			WHERE (
				$1 = ''
				OR a."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
				AND a."bucket" = ANY($2::TIMESTAMPTZ[])
			ORDER BY r."name" ASC NULLS LAST, a."repository_id" ASC
			`,
			input.organizationId,
			buckets
		)

		return this.mapRows(rows)
	}

	public async listSemesters(input: {
		organizationId: string
		repositoryId?: string
		limit?: number
	}): Promise<SemesterOption[]> {
		const rows = await this.prisma.$queryRawUnsafe<SemesterRow[]>(
			`
			SELECT
				LOWER(s."season"::TEXT) AS "semester",
				s."year" AS "year",
				s."label" AS "label",
				s."start_date" AS "dateFrom",
				s."end_date" AS "dateTo"
			FROM "metrics"."semesters" s
			WHERE EXISTS (
				SELECT 1
				FROM "metrics"."metric_events" e
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = e."organization_id"
				WHERE e."event_at" >= s."start_date"
					AND e."event_at" < s."end_date"
					AND (
						$1 = ''
						OR e."organization_id" = $1
						OR o."external_id" = $1
						OR LOWER(o."name") = LOWER($1)
						OR LOWER(o."url") = LOWER($1)
					)
					AND ($2 = '' OR e."repository_id" = $2)
			)
			ORDER BY s."start_date" DESC
			LIMIT $3
			`,
			input.organizationId,
			input.repositoryId?.trim() ?? "",
			this.queryLimit(input.limit)
		)

		return rows.map(row => this.toSemesterOption(row))
	}

	public async getUserEventTypeCounts(input: {
		organizationId: string
		repositoryId: string
		dateFrom: Date
		dateTo: Date
	}): Promise<EventTypeCountRow[]> {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{
				repositoryId: string
				subjectId: string
				eventTypesCoveredCount: bigint | number
			}>
		>(
			`
			SELECT
				e."repository_id" AS "repositoryId",
				COALESCE(
					NULLIF(e."payload" -> 'actor' ->> 'id', ''),
					NULLIF(e."payload" -> 'author' ->> 'id', '')
				) AS "subjectId",
				COUNT(DISTINCT e."type")::BIGINT AS "eventTypesCoveredCount"
			FROM "metrics"."metric_events" e
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = e."organization_id"
			WHERE (
				$1 = ''
				OR e."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
				AND ($2 = '' OR e."repository_id" = $2)
				AND e."event_at" >= $3
				AND e."event_at" < $4
				AND COALESCE(
					NULLIF(e."payload" -> 'actor' ->> 'id', ''),
					NULLIF(e."payload" -> 'author' ->> 'id', '')
				) IS NOT NULL
			GROUP BY 1, 2
			`,
			input.organizationId,
			input.repositoryId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => ({
			repositoryId: String(row.repositoryId),
			subjectId: String(row.subjectId),
			eventTypesCoveredCount: this.numberValue(row.eventTypesCoveredCount)
		}))
	}

	public async getRepositoryEventTypeCounts(input: {
		organizationId: string
		dateFrom: Date
		dateTo: Date
	}): Promise<EventTypeCountRow[]> {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{
				repositoryId: string
				subjectId: string
				eventTypesCoveredCount: bigint | number
			}>
		>(
			`
			SELECT
				e."repository_id" AS "repositoryId",
				e."repository_id" AS "subjectId",
				COUNT(DISTINCT e."type")::BIGINT AS "eventTypesCoveredCount"
			FROM "metrics"."metric_events" e
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = e."organization_id"
			WHERE (
				$1 = ''
				OR e."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
				AND e."event_at" >= $2
				AND e."event_at" < $3
			GROUP BY 1, 2
			`,
			input.organizationId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => ({
			repositoryId: String(row.repositoryId),
			subjectId: String(row.subjectId),
			eventTypesCoveredCount: this.numberValue(row.eventTypesCoveredCount)
		}))
	}

	public async getUserPullRequestSizeStats(input: {
		organizationId: string
		repositoryId: string
		dateFrom: Date
		dateTo: Date
	}): Promise<PullRequestSizeStatsRow[]> {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{
				repositoryId: string
				subjectId: string
				pullRequestsCreatedCount: bigint | number
				avgPullRequestSizeLines: number
				medianPullRequestSizeLines: number
			}>
		>(
			`
			WITH pull_requests AS (
				SELECT
					e."repository_id" AS "repositoryId",
					COALESCE(
						NULLIF(e."payload" -> 'author' ->> 'id', ''),
						NULLIF(e."payload" -> 'actor' ->> 'id', '')
					) AS "subjectId",
					(
						COALESCE(
							NULLIF(e."payload" ->> 'additions', '')::INT,
							NULLIF(e."payload" #>> '{stats,additions}', '')::INT,
							0
						) +
						COALESCE(
							NULLIF(e."payload" ->> 'deletions', '')::INT,
							NULLIF(e."payload" #>> '{stats,deletions}', '')::INT,
							0
						)
					) AS "sizeLines"
				FROM "metrics"."metric_events" e
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = e."organization_id"
				WHERE (
					$1 = ''
					OR e."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND ($2 = '' OR e."repository_id" = $2)
					AND e."event_at" >= $3
					AND e."event_at" < $4
					AND e."type" = 'pull_request.created'
			)
			SELECT
				"repositoryId",
				"subjectId",
				COUNT(*)::BIGINT AS "pullRequestsCreatedCount",
				ROUND(AVG("sizeLines")::NUMERIC, 2) AS "avgPullRequestSizeLines",
				ROUND(
					(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "sizeLines"))::NUMERIC,
					2
				) AS "medianPullRequestSizeLines"
			FROM pull_requests
			WHERE "subjectId" IS NOT NULL
			GROUP BY 1, 2
			`,
			input.organizationId,
			input.repositoryId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => ({
			repositoryId: String(row.repositoryId),
			subjectId: String(row.subjectId),
			pullRequestsCreatedCount: this.numberValue(row.pullRequestsCreatedCount),
			avgPullRequestSizeLines: this.numberValue(row.avgPullRequestSizeLines),
			medianPullRequestSizeLines: this.numberValue(
				row.medianPullRequestSizeLines
			)
		}))
	}

	public async getRepositoryPullRequestSizeStats(input: {
		organizationId: string
		dateFrom: Date
		dateTo: Date
	}): Promise<PullRequestSizeStatsRow[]> {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{
				repositoryId: string
				subjectId: string
				pullRequestsCreatedCount: bigint | number
				avgPullRequestSizeLines: number
				medianPullRequestSizeLines: number
			}>
		>(
			`
			WITH pull_requests AS (
				SELECT
					e."repository_id" AS "repositoryId",
					e."repository_id" AS "subjectId",
					(
						COALESCE(
							NULLIF(e."payload" ->> 'additions', '')::INT,
							NULLIF(e."payload" #>> '{stats,additions}', '')::INT,
							0
						) +
						COALESCE(
							NULLIF(e."payload" ->> 'deletions', '')::INT,
							NULLIF(e."payload" #>> '{stats,deletions}', '')::INT,
							0
						)
					) AS "sizeLines"
				FROM "metrics"."metric_events" e
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = e."organization_id"
				WHERE (
					$1 = ''
					OR e."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND e."event_at" >= $2
					AND e."event_at" < $3
					AND e."type" = 'pull_request.created'
			)
			SELECT
				"repositoryId",
				"subjectId",
				COUNT(*)::BIGINT AS "pullRequestsCreatedCount",
				ROUND(AVG("sizeLines")::NUMERIC, 2) AS "avgPullRequestSizeLines",
				ROUND(
					(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "sizeLines"))::NUMERIC,
					2
				) AS "medianPullRequestSizeLines"
			FROM pull_requests
			GROUP BY 1, 2
			`,
			input.organizationId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => ({
			repositoryId: String(row.repositoryId),
			subjectId: String(row.subjectId),
			pullRequestsCreatedCount: this.numberValue(row.pullRequestsCreatedCount),
			avgPullRequestSizeLines: this.numberValue(row.avgPullRequestSizeLines),
			medianPullRequestSizeLines: this.numberValue(
				row.medianPullRequestSizeLines
			)
		}))
	}

	public async getUserPullRequestTimingStats(input: {
		organizationId: string
		repositoryId: string
		dateFrom: Date
		dateTo: Date
	}): Promise<PullRequestTimingStatsRow[]> {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{
				repositoryId: string
				subjectId: string
				medianReviewResponseTimeSec: number | null
				p75ReviewResponseTimeSec: number | null
				timeToFirstReviewMedianSec: number | null
				timeToFirstReviewP75Sec: number | null
				pullRequestCycleTimeMedianSec: number | null
				pullRequestCycleTimeP75Sec: number | null
				issueLeadTimeMedianSec: number | null
				issueLeadTimeP75Sec: number | null
			}>
		>(
			`
			WITH review_requests AS (
				SELECT
					request."repository_id" AS "repositoryId",
					NULLIF(request."payload" -> 'requestedReviewer' ->> 'id', '') AS "subjectId",
					request."event_at" AS "requestAt",
					response."event_at" AS "responseAt"
				FROM "metrics"."metric_events" request
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = request."organization_id"
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
				WHERE (
					$1 = ''
					OR request."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND ($2 = '' OR request."repository_id" = $2)
					AND request."event_at" >= $3
					AND request."event_at" < $4
					AND request."type" = 'pull_request.review_requested'
					AND NULLIF(request."payload" ->> 'prId', '') IS NOT NULL
					AND NULLIF(request."payload" -> 'requestedReviewer' ->> 'id', '') IS NOT NULL
			),
			review_response_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("responseAt" - "requestAt"))
							) FILTER (WHERE "responseAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "medianReviewResponseTimeSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("responseAt" - "requestAt"))
							) FILTER (WHERE "responseAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "p75ReviewResponseTimeSec"
				FROM review_requests
				GROUP BY 1, 2
			),
			pull_requests AS (
				SELECT
					created."repository_id" AS "repositoryId",
					NULLIF(created."payload" -> 'author' ->> 'id', '') AS "subjectId",
					created."event_at" AS "createdAt",
					merged."event_at" AS "mergedAt",
					first_review."event_at" AS "firstReviewAt"
				FROM "metrics"."metric_events" created
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = created."organization_id"
				LEFT JOIN LATERAL (
					SELECT state_changed."event_at"
					FROM "metrics"."metric_events" state_changed
					WHERE state_changed."type" = 'pull_request.state_changed'
						AND state_changed."organization_id" = created."organization_id"
						AND state_changed."repository_id" = created."repository_id"
						AND NULLIF(state_changed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
						AND state_changed."payload" ->> 'event' = 'merged'
						AND state_changed."event_at" >= created."event_at"
					ORDER BY state_changed."event_at" ASC
					LIMIT 1
				) merged ON TRUE
				LEFT JOIN LATERAL (
					SELECT reviewed."event_at"
					FROM "metrics"."metric_events" reviewed
					WHERE reviewed."type" = 'pull_request.reviewed'
						AND reviewed."organization_id" = created."organization_id"
						AND reviewed."repository_id" = created."repository_id"
						AND NULLIF(reviewed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
						AND reviewed."event_at" >= created."event_at"
					ORDER BY reviewed."event_at" ASC
					LIMIT 1
				) first_review ON TRUE
				WHERE (
					$1 = ''
					OR created."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND ($2 = '' OR created."repository_id" = $2)
					AND created."event_at" >= $3
					AND created."event_at" < $4
					AND created."type" = 'pull_request.created'
					AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
					AND NULLIF(created."payload" -> 'author' ->> 'id', '') IS NOT NULL
			),
			first_review_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("firstReviewAt" - "createdAt"))
							) FILTER (WHERE "firstReviewAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "timeToFirstReviewMedianSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("firstReviewAt" - "createdAt"))
							) FILTER (WHERE "firstReviewAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "timeToFirstReviewP75Sec"
				FROM pull_requests
				GROUP BY 1, 2
			),
			pull_request_cycle_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("mergedAt" - "createdAt"))
							) FILTER (WHERE "mergedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "pullRequestCycleTimeMedianSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("mergedAt" - "createdAt"))
							) FILTER (WHERE "mergedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "pullRequestCycleTimeP75Sec"
				FROM pull_requests
				GROUP BY 1, 2
			),
			issues AS (
				SELECT
					created."repository_id" AS "repositoryId",
					NULLIF(created."payload" -> 'author' ->> 'id', '') AS "subjectId",
					created."event_at" AS "createdAt",
					closed."event_at" AS "closedAt"
				FROM "metrics"."metric_events" created
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = created."organization_id"
				LEFT JOIN LATERAL (
					SELECT state_changed."event_at"
					FROM "metrics"."metric_events" state_changed
					WHERE state_changed."type" = 'issue.state_changed'
						AND state_changed."organization_id" = created."organization_id"
						AND state_changed."repository_id" = created."repository_id"
						AND NULLIF(state_changed."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
						AND state_changed."payload" ->> 'event' = 'closed'
						AND state_changed."event_at" >= created."event_at"
					ORDER BY state_changed."event_at" ASC
					LIMIT 1
				) closed ON TRUE
				WHERE (
					$1 = ''
					OR created."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND ($2 = '' OR created."repository_id" = $2)
					AND created."event_at" >= $3
					AND created."event_at" < $4
					AND created."type" = 'issue.created'
					AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
					AND NULLIF(created."payload" -> 'author' ->> 'id', '') IS NOT NULL
			),
			issue_lead_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("closedAt" - "createdAt"))
							) FILTER (WHERE "closedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "issueLeadTimeMedianSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("closedAt" - "createdAt"))
							) FILTER (WHERE "closedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "issueLeadTimeP75Sec"
				FROM issues
				GROUP BY 1, 2
			),
			keys AS (
				SELECT "repositoryId", "subjectId" FROM review_response_stats
				UNION
				SELECT "repositoryId", "subjectId" FROM first_review_stats
				UNION
				SELECT "repositoryId", "subjectId" FROM pull_request_cycle_stats
				UNION
				SELECT "repositoryId", "subjectId" FROM issue_lead_stats
			)
			SELECT
				k."repositoryId",
				k."subjectId",
				r."medianReviewResponseTimeSec",
				r."p75ReviewResponseTimeSec",
				f."timeToFirstReviewMedianSec",
				f."timeToFirstReviewP75Sec",
				p."pullRequestCycleTimeMedianSec",
				p."pullRequestCycleTimeP75Sec",
				i."issueLeadTimeMedianSec",
				i."issueLeadTimeP75Sec"
			FROM keys k
			LEFT JOIN review_response_stats r USING ("repositoryId", "subjectId")
			LEFT JOIN first_review_stats f USING ("repositoryId", "subjectId")
			LEFT JOIN pull_request_cycle_stats p USING ("repositoryId", "subjectId")
			LEFT JOIN issue_lead_stats i USING ("repositoryId", "subjectId")
			`,
			input.organizationId,
			input.repositoryId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => this.toPullRequestTimingStatsRow(row))
	}

	public async getRepositoryPullRequestTimingStats(input: {
		organizationId: string
		dateFrom: Date
		dateTo: Date
	}): Promise<PullRequestTimingStatsRow[]> {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{
				repositoryId: string
				subjectId: string
				medianReviewResponseTimeSec: number | null
				p75ReviewResponseTimeSec: number | null
				timeToFirstReviewMedianSec: number | null
				timeToFirstReviewP75Sec: number | null
				pullRequestCycleTimeMedianSec: number | null
				pullRequestCycleTimeP75Sec: number | null
				issueLeadTimeMedianSec: number | null
				issueLeadTimeP75Sec: number | null
			}>
		>(
			`
			WITH review_requests AS (
				SELECT
					request."repository_id" AS "repositoryId",
					request."repository_id" AS "subjectId",
					request."event_at" AS "requestAt",
					response."event_at" AS "responseAt"
				FROM "metrics"."metric_events" request
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = request."organization_id"
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
				WHERE (
					$1 = ''
					OR request."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND request."event_at" >= $2
					AND request."event_at" < $3
					AND request."type" = 'pull_request.review_requested'
					AND NULLIF(request."payload" ->> 'prId', '') IS NOT NULL
					AND NULLIF(request."payload" -> 'requestedReviewer' ->> 'id', '') IS NOT NULL
			),
			review_response_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("responseAt" - "requestAt"))
							) FILTER (WHERE "responseAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "medianReviewResponseTimeSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("responseAt" - "requestAt"))
							) FILTER (WHERE "responseAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "p75ReviewResponseTimeSec"
				FROM review_requests
				GROUP BY 1, 2
			),
			pull_requests AS (
				SELECT
					created."repository_id" AS "repositoryId",
					created."repository_id" AS "subjectId",
					created."event_at" AS "createdAt",
					merged."event_at" AS "mergedAt",
					first_review."event_at" AS "firstReviewAt"
				FROM "metrics"."metric_events" created
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = created."organization_id"
				LEFT JOIN LATERAL (
					SELECT state_changed."event_at"
					FROM "metrics"."metric_events" state_changed
					WHERE state_changed."type" = 'pull_request.state_changed'
						AND state_changed."organization_id" = created."organization_id"
						AND state_changed."repository_id" = created."repository_id"
						AND NULLIF(state_changed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
						AND state_changed."payload" ->> 'event' = 'merged'
						AND state_changed."event_at" >= created."event_at"
					ORDER BY state_changed."event_at" ASC
					LIMIT 1
				) merged ON TRUE
				LEFT JOIN LATERAL (
					SELECT reviewed."event_at"
					FROM "metrics"."metric_events" reviewed
					WHERE reviewed."type" = 'pull_request.reviewed'
						AND reviewed."organization_id" = created."organization_id"
						AND reviewed."repository_id" = created."repository_id"
						AND NULLIF(reviewed."payload" ->> 'prId', '') = NULLIF(created."payload" ->> 'id', '')
						AND reviewed."event_at" >= created."event_at"
					ORDER BY reviewed."event_at" ASC
					LIMIT 1
				) first_review ON TRUE
				WHERE (
					$1 = ''
					OR created."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND created."event_at" >= $2
					AND created."event_at" < $3
					AND created."type" = 'pull_request.created'
					AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
			),
			first_review_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("firstReviewAt" - "createdAt"))
							) FILTER (WHERE "firstReviewAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "timeToFirstReviewMedianSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("firstReviewAt" - "createdAt"))
							) FILTER (WHERE "firstReviewAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "timeToFirstReviewP75Sec"
				FROM pull_requests
				GROUP BY 1, 2
			),
			pull_request_cycle_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("mergedAt" - "createdAt"))
							) FILTER (WHERE "mergedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "pullRequestCycleTimeMedianSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("mergedAt" - "createdAt"))
							) FILTER (WHERE "mergedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "pullRequestCycleTimeP75Sec"
				FROM pull_requests
				GROUP BY 1, 2
			),
			issues AS (
				SELECT
					created."repository_id" AS "repositoryId",
					created."repository_id" AS "subjectId",
					created."event_at" AS "createdAt",
					closed."event_at" AS "closedAt"
				FROM "metrics"."metric_events" created
				LEFT JOIN "metrics"."organizations" o
					ON o."id" = created."organization_id"
				LEFT JOIN LATERAL (
					SELECT state_changed."event_at"
					FROM "metrics"."metric_events" state_changed
					WHERE state_changed."type" = 'issue.state_changed'
						AND state_changed."organization_id" = created."organization_id"
						AND state_changed."repository_id" = created."repository_id"
						AND NULLIF(state_changed."payload" ->> 'issueId', '') = NULLIF(created."payload" ->> 'id', '')
						AND state_changed."payload" ->> 'event' = 'closed'
						AND state_changed."event_at" >= created."event_at"
					ORDER BY state_changed."event_at" ASC
					LIMIT 1
				) closed ON TRUE
				WHERE (
					$1 = ''
					OR created."organization_id" = $1
					OR o."external_id" = $1
					OR LOWER(o."name") = LOWER($1)
					OR LOWER(o."url") = LOWER($1)
				)
					AND created."event_at" >= $2
					AND created."event_at" < $3
					AND created."type" = 'issue.created'
					AND NULLIF(created."payload" ->> 'id', '') IS NOT NULL
			),
			issue_lead_stats AS (
				SELECT
					"repositoryId",
					"subjectId",
					ROUND(
						(
							PERCENTILE_CONT(0.5) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("closedAt" - "createdAt"))
							) FILTER (WHERE "closedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "issueLeadTimeMedianSec",
					ROUND(
						(
							PERCENTILE_CONT(0.75) WITHIN GROUP (
								ORDER BY EXTRACT(EPOCH FROM ("closedAt" - "createdAt"))
							) FILTER (WHERE "closedAt" IS NOT NULL)
						)::NUMERIC,
						2
					) AS "issueLeadTimeP75Sec"
				FROM issues
				GROUP BY 1, 2
			),
			keys AS (
				SELECT "repositoryId", "subjectId" FROM review_response_stats
				UNION
				SELECT "repositoryId", "subjectId" FROM first_review_stats
				UNION
				SELECT "repositoryId", "subjectId" FROM pull_request_cycle_stats
				UNION
				SELECT "repositoryId", "subjectId" FROM issue_lead_stats
			)
			SELECT
				k."repositoryId",
				k."subjectId",
				r."medianReviewResponseTimeSec",
				r."p75ReviewResponseTimeSec",
				f."timeToFirstReviewMedianSec",
				f."timeToFirstReviewP75Sec",
				p."pullRequestCycleTimeMedianSec",
				p."pullRequestCycleTimeP75Sec",
				i."issueLeadTimeMedianSec",
				i."issueLeadTimeP75Sec"
			FROM keys k
			LEFT JOIN review_response_stats r USING ("repositoryId", "subjectId")
			LEFT JOIN first_review_stats f USING ("repositoryId", "subjectId")
			LEFT JOIN pull_request_cycle_stats p USING ("repositoryId", "subjectId")
			LEFT JOIN issue_lead_stats i USING ("repositoryId", "subjectId")
			`,
			input.organizationId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => this.toPullRequestTimingStatsRow(row))
	}

	public async getSemesterRange(input: {
		semester: SemesterName
		year: number
	}) {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{ dateFrom: Date; dateTo: Date }>
		>(
			`
			SELECT
				s."start_date" AS "dateFrom",
				s."end_date" AS "dateTo"
			FROM "metrics"."semesters" s
			WHERE LOWER(s."season"::TEXT) = $1
				AND s."year" = $2
			LIMIT 1
			`,
			input.semester,
			input.year
		)
		const range = rows[0]

		if (!range) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "Semester was not found"
			})
		}

		return {
			dateFrom: this.asDate(range.dateFrom),
			dateTo: this.asDate(range.dateTo)
		}
	}

	public async listUserBuckets(input: {
		organizationId: string
		repositoryId: string
		dateFrom: Date
		dateTo: Date
	}) {
		const rows = await this.prisma.$queryRawUnsafe<Array<{ bucket: Date }>>(
			`
			SELECT DISTINCT a."bucket"
			FROM "metrics"."metrics_user_activity_daily_with_team_share" a
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = a."organization_id"
			WHERE (
				$1 = ''
				OR a."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
				AND ($2 = '' OR a."repository_id" = $2)
				AND a."bucket" >= $3
				AND a."bucket" < $4
			ORDER BY a."bucket" ASC
			`,
			input.organizationId,
			input.repositoryId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => this.asDate(row.bucket))
	}

	public async listRepositoryBuckets(input: {
		organizationId: string
		dateFrom: Date
		dateTo: Date
	}) {
		const rows = await this.prisma.$queryRawUnsafe<Array<{ bucket: Date }>>(
			`
			SELECT DISTINCT a."bucket"
			FROM "metrics"."metrics_team_activity_daily" a
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = a."organization_id"
			WHERE (
				$1 = ''
				OR a."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
				AND a."bucket" >= $2
				AND a."bucket" < $3
			ORDER BY a."bucket" ASC
			`,
			input.organizationId,
			input.dateFrom,
			input.dateTo
		)

		return rows.map(row => this.asDate(row.bucket))
	}

	public async getLatestUserBucket(input: {
		organizationId: string
		repositoryId: string
	}) {
		return await this.findLatestUserBucket(input)
	}

	public async getLatestRepositoryBucket(input: { organizationId: string }) {
		return await this.findLatestRepositoryBucket(input)
	}

	private async resolveUserBuckets(input: {
		organizationId: string
		repositoryId: string
		bucket: Date | Date[] | null
	}) {
		if (Array.isArray(input.bucket)) return input.bucket
		if (input.bucket) return [input.bucket]

		return [
			await this.findLatestUserBucket({
				organizationId: input.organizationId,
				repositoryId: input.repositoryId
			})
		]
	}

	private async resolveRepositoryBuckets(input: {
		organizationId: string
		bucket: Date | Date[] | null
	}) {
		if (Array.isArray(input.bucket)) return input.bucket
		if (input.bucket) return [input.bucket]

		return [
			await this.findLatestRepositoryBucket({
				organizationId: input.organizationId
			})
		]
	}

	private async findLatestUserBucket(input: {
		organizationId: string
		repositoryId: string
	}) {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{ bucket: Date | null }>
		>(
			`
			SELECT MAX("bucket") AS "bucket"
			FROM "metrics"."metrics_user_activity_daily_with_team_share" a
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = a."organization_id"
			WHERE (
				$1 = ''
				OR a."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
				AND ($2 = '' OR a."repository_id" = $2)
			`,
			input.organizationId,
			input.repositoryId
		)

		return this.requireBucket(rows[0]?.bucket)
	}

	private async findLatestRepositoryBucket(input: { organizationId: string }) {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{ bucket: Date | null }>
		>(
			`
			SELECT MAX("bucket") AS "bucket"
			FROM "metrics"."metrics_team_activity_daily" a
			LEFT JOIN "metrics"."organizations" o
				ON o."id" = a."organization_id"
			WHERE (
				$1 = ''
				OR a."organization_id" = $1
				OR o."external_id" = $1
				OR LOWER(o."name") = LOWER($1)
				OR LOWER(o."url") = LOWER($1)
			)
			`,
			input.organizationId
		)

		return this.requireBucket(rows[0]?.bucket)
	}

	private requireBucket(bucket: Date | null | undefined) {
		if (!bucket) {
			throw new RpcException({
				code: RpcStatus.NOT_FOUND,
				details: "No metric buckets found for the requested scope"
			})
		}

		return bucket
	}

	private toSemesterOption(row: SemesterRow): SemesterOption {
		const semester = this.semesterName(row.semester)
		const dateTo = this.addUtcDays(this.asDate(row.dateTo), -1)

		return {
			semester,
			year: Number(row.year),
			label:
				row.label ||
				`${semester === "autumn" ? "Осенний" : "Весенний"} ${row.year}`,
			dateFrom: this.dateInputValue(this.asDate(row.dateFrom)),
			dateTo: this.dateInputValue(dateTo)
		}
	}

	private toPullRequestTimingStatsRow(row: {
		repositoryId: string
		subjectId: string
		medianReviewResponseTimeSec: number | null
		p75ReviewResponseTimeSec: number | null
		timeToFirstReviewMedianSec: number | null
		timeToFirstReviewP75Sec: number | null
		pullRequestCycleTimeMedianSec: number | null
		pullRequestCycleTimeP75Sec: number | null
		issueLeadTimeMedianSec: number | null
		issueLeadTimeP75Sec: number | null
	}): PullRequestTimingStatsRow {
		return {
			repositoryId: String(row.repositoryId),
			subjectId: String(row.subjectId),
			medianReviewResponseTimeSec: this.numberValue(
				row.medianReviewResponseTimeSec
			),
			p75ReviewResponseTimeSec: this.numberValue(row.p75ReviewResponseTimeSec),
			timeToFirstReviewMedianSec: this.numberValue(
				row.timeToFirstReviewMedianSec
			),
			timeToFirstReviewP75Sec: this.numberValue(row.timeToFirstReviewP75Sec),
			pullRequestCycleTimeMedianSec: this.numberValue(
				row.pullRequestCycleTimeMedianSec
			),
			pullRequestCycleTimeP75Sec: this.numberValue(
				row.pullRequestCycleTimeP75Sec
			),
			issueLeadTimeMedianSec: this.numberValue(row.issueLeadTimeMedianSec),
			issueLeadTimeP75Sec: this.numberValue(row.issueLeadTimeP75Sec)
		}
	}

	private semesterName(value: string): SemesterName {
		return value.toLowerCase() === "spring" ? "spring" : "autumn"
	}

	private queryLimit(limit: number | undefined) {
		if (!limit || limit <= 0) return 50

		return Math.min(limit, 100)
	}

	private mapRows(rows: DbRow[]): RawRatingRow[] {
		return rows.map(row => {
			const {
				bucket,
				organizationId,
				repositoryId,
				subjectId,
				subjectLabel,
				...values
			} = row

			return {
				bucket: this.asDate(bucket),
				organizationId: String(organizationId),
				repositoryId: String(repositoryId),
				subjectId: String(subjectId),
				subjectLabel: String(subjectLabel),
				metadata: {
					repositoryUrl: String(values.repositoryUrl ?? "")
				},
				values: this.mapValues(values)
			}
		})
	}

	private mapValues(values: Record<string, unknown>) {
		const mapped = Object.entries(values).reduce<Record<string, number>>(
			(acc, [key, value]) => {
				if (key === "repositoryUrl") return acc

				acc[key] = this.numberValue(value)

				return acc
			},
			{}
		)

		return this.deriveValues(mapped)
	}

	private deriveValues(values: Record<string, number>) {
		const next = { ...values }
		const value = (metric: string) => this.numberValue(next[metric])
		const ratio = (numerator: number, denominator: number) =>
			denominator > 0 ? this.round(numerator / denominator) : 0
		const boundedRatio = (numerator: number, denominator: number) =>
			this.clampRatio(ratio(numerator, denominator))

		if ("review_requests_count" in next) {
			next.review_response_ratio = boundedRatio(
				value("review_responses_count"),
				value("review_requests_count")
			)
			next.unanswered_review_request_ratio = boundedRatio(
				value("review_queue_pressure"),
				value("review_requests_count")
			)
		}

		if ("pull_requests_created_count" in next) {
			next.commit_to_pr_ratio = ratio(
				value("commits_count"),
				value("pull_requests_created_count")
			)
			next.code_churn_per_pr = ratio(
				value("code_churn"),
				value("pull_requests_created_count")
			)
			next.large_pull_request_ratio = boundedRatio(
				value("large_pull_requests_count"),
				value("pull_requests_created_count")
			)
			next.small_pull_request_ratio = boundedRatio(
				value("small_pull_requests_count"),
				value("pull_requests_created_count")
			)
		}

		if ("reviews_count" in next) {
			next.comments_per_review_ratio = ratio(
				value("issue_comments_count") + value("pull_request_comments_count"),
				value("reviews_count")
			)
		}

		if ("done_work_count" in next) {
			next.throughput_ratio = boundedRatio(
				value("done_work_count"),
				value("incoming_work_count")
			)
			next.backlog_growth_ratio = boundedRatio(
				Math.max(value("work_balance_delta"), 0),
				value("incoming_work_count")
			)
			next.backlog_reduction_ratio = boundedRatio(
				Math.max(value("done_work_count") - value("incoming_work_count"), 0),
				value("done_work_count")
			)
		}

		if ("merged_without_review_count" in next) {
			next.merged_without_review_ratio = boundedRatio(
				value("merged_without_review_count"),
				value("pull_requests_merged_count")
			)
		}

		if ("review_coverage_rate" in next) {
			next.review_coverage_rate = boundedRatio(
				value("merged_with_review_count"),
				value("pull_requests_merged_count")
			)
		}

		if ("self_review_ratio" in next) {
			next.self_review_ratio = boundedRatio(
				value("self_reviews_count"),
				value("reviews_on_merged_pull_requests_count")
			)
		}

		if ("self_merge_ratio" in next) {
			next.self_merge_ratio = boundedRatio(
				value("self_merged_pull_requests_count"),
				value("pull_requests_merged_count")
			)
		}

		if ("reviews_per_merged_pull_request" in next) {
			next.reviews_per_merged_pull_request = ratio(
				value("reviews_on_merged_pull_requests_count"),
				value("pull_requests_merged_count")
			)
		}

		if ("review_iteration_count_avg" in next) {
			next.review_iteration_count_avg = ratio(
				value("reviews_on_pull_requests_count"),
				value("pull_requests_with_first_review_count")
			)
		}

		if ("issue_resolution_ratio" in next) {
			next.issue_resolution_ratio = boundedRatio(
				value("issues_closed_count"),
				value("issues_created_count")
			)
		}

		if ("created_work_count" in next) {
			next.created_work_count =
				value("issues_created_count") +
				value("health_pull_requests_created_count")
		}

		if ("stale_issue_ratio" in next) {
			next.stale_issue_ratio = boundedRatio(
				value("stale_issues_count"),
				value("open_issues_count")
			)
		}

		if ("stale_pull_request_ratio" in next) {
			next.stale_pull_request_ratio = boundedRatio(
				value("stale_pull_requests_count"),
				value("open_pull_requests_count")
			)
		}

		if ("issue_close_rate" in next) {
			const issuesCreated = value("issues_created_count")

			next.issue_close_rate = boundedRatio(
				issuesCreated - value("issue_backlog_delta"),
				issuesCreated
			)
		}

		if ("pull_request_merge_rate" in next) {
			const pullRequestsCreated = value("health_pull_requests_created_count")

			next.pull_request_merge_rate = boundedRatio(
				pullRequestsCreated - value("pull_request_backlog_delta"),
				pullRequestsCreated
			)
		}

		if ("stale_open_work_ratio" in next) {
			const created =
				value("issues_created_count") +
				value("health_pull_requests_created_count")
			const backlog =
				"total_backlog_delta" in next
					? value("total_backlog_delta")
					: value("issue_backlog_delta") + value("pull_request_backlog_delta")

			next.stale_open_work_ratio = boundedRatio(Math.max(backlog, 0), created)
		}

		if ("reopen_pressure_index" in next) {
			const created =
				value("issues_created_count") +
				value("health_pull_requests_created_count")

			next.reopen_pressure_index = boundedRatio(
				value("issues_reopened_count") + value("pull_requests_reopened_count"),
				created
			)
		}

		if ("issue_backlog_delta" in next || "pull_request_backlog_delta" in next) {
			const backlog =
				"total_backlog_delta" in next
					? value("total_backlog_delta")
					: value("issue_backlog_delta") + value("pull_request_backlog_delta")

			next.queue_stability_index = this.round(1 / (1 + Math.max(backlog, 0)))
		}

		return this.clampBoundedRatios(next)
	}

	private clampBoundedRatios(values: Record<string, number>) {
		const next = { ...values }

		for (const metric of BOUNDED_RATIO_METRICS) {
			if (metric in next) next[metric] = this.clampRatio(next[metric])
		}

		return next
	}

	private clampRatio(value: number) {
		return this.round(Math.max(0, Math.min(1, this.numberValue(value))))
	}

	private round(value: number) {
		return Math.round(value * 10000) / 10000
	}

	private asDate(value: unknown) {
		if (value instanceof Date) return value

		return new Date(String(value))
	}

	private addUtcDays(value: Date, days: number) {
		const date = new Date(
			Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
		)

		date.setUTCDate(date.getUTCDate() + days)

		return date
	}

	private dateInputValue(date: Date) {
		return date.toISOString().slice(0, 10)
	}

	private numberValue(value: unknown) {
		if (typeof value === "number") return Number.isFinite(value) ? value : 0
		if (typeof value === "bigint") return Number(value)
		if (value === null || value === undefined) return 0

		const parsed = Number(value)

		return Number.isFinite(parsed) ? parsed : 0
	}
}
