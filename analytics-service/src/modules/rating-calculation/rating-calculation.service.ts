import { Injectable } from "@nestjs/common"

import {
	type EventTypeCountRow,
	MetricsReaderService,
	type PullRequestSizeStatsRow,
	type PullRequestTimingStatsRow
} from "@/modules/metric-source/metrics-reader.service"
import { RawRatingRow } from "@/modules/metric-source/raw-rating-row"
import { RatingsRepository } from "@/modules/rating-storage/ratings.repository"
import type {
	RatingPeriodName,
	SemesterName,
	SemesterOption
} from "@/modules/ratings/rating.types"
import { ScoringProfilesService } from "@/modules/scoring-profiles/scoring-profiles.service"
import {
	BOUNDED_RATIO_METRICS,
	REPOSITORY_METRICS,
	USER_METRICS
} from "@/modules/scoring/scoring.config"
import { ScoringService } from "@/modules/scoring/scoring.service"
import {
	CalculatedRating,
	MetricStats,
	ScoreWeightInput,
	ScoringProfile
} from "@/modules/scoring/scoring.types"

interface CalculateUserRatingsInput {
	organizationId: string
	repositoryId: string
	period: RatingPeriodName
	bucket: Date | null
	weightOverrides: ScoreWeightInput[]
	persist: boolean
}

interface CalculateRepositoryRatingsInput {
	organizationId: string
	period: RatingPeriodName
	bucket: Date | null
	weightOverrides: ScoreWeightInput[]
	persist: boolean
}

interface CalculateUserRatingsRangeInput extends Omit<
	CalculateUserRatingsInput,
	"period" | "bucket" | "persist"
> {
	dateFrom: Date
	dateTo: Date
}

interface CalculateRepositoryRatingsRangeInput extends Omit<
	CalculateRepositoryRatingsInput,
	"period" | "bucket" | "persist"
> {
	dateFrom: Date
	dateTo: Date
}

const ADDITIVE_RANGE_METRICS = new Set([
	"events_total",
	"active_days_count",
	"communication_events_total",
	"issue_comments_count",
	"pull_request_comments_count",
	"review_requests_count",
	"reviews_count",
	"labels_changed_count",
	"assignees_changed_count",
	"comments_total_count",
	"assignment_events_total",
	"review_responses_count",
	"commits_count",
	"pull_requests_created_count",
	"reviews_submitted_count",
	"code_additions",
	"code_deletions",
	"code_churn",
	"net_code_change",
	"issues_reopened_count",
	"pull_requests_reopened_count",
	"pull_requests_reviewed_count",
	"pull_requests_review_requested_count",
	"large_changes_count",
	"large_pull_requests_count",
	"small_pull_requests_count",
	"pull_requests_with_first_review_count",
	"pull_requests_merged_after_review_count",
	"reviews_on_pull_requests_count",
	"reviews_on_merged_pull_requests_count",
	"self_reviews_count",
	"self_merged_pull_requests_count",
	"merged_with_review_count",
	"merged_without_review_count",
	"post_review_change_sample_count",
	"issue_close_reopen_balance",
	"pull_request_merge_reopen_balance",
	"events_ingested_count",
	"incoming_work_count",
	"done_work_count",
	"work_balance_delta",
	"issues_created_count",
	"health_pull_requests_created_count",
	"issue_backlog_delta",
	"pull_request_backlog_delta",
	"total_backlog_delta",
	"created_work_count",
	"review_queue_pressure",
	"pull_requests_merged_count",
	"issues_closed_count",
	"open_issues_count",
	"stale_issues_count",
	"open_pull_requests_count",
	"stale_pull_requests_count"
])

export interface RatingCalculationResult {
	bucket: Date | null
	ratings: CalculatedRating[]
	metricStats: MetricStats[]
}

@Injectable()
export class RatingCalculationService {
	public constructor(
		private readonly metricsReader: MetricsReaderService,
		private readonly scoringService: ScoringService,
		private readonly scoringProfiles: ScoringProfilesService,
		private readonly ratingsRepository: RatingsRepository
	) {}

	public async calculateUserRatings(
		input: CalculateUserRatingsInput
	): Promise<RatingCalculationResult> {
		const profile = await this.scoringProfiles.getDefaultProfile("USER")
		if (input.period === "WEEKLY") {
			const dateFrom = await this.resolveUserWeekBucket(input)
			const result = await this.calculateUserRatingsFromDailyRange({
				organizationId: input.organizationId,
				repositoryId: input.repositoryId,
				dateFrom,
				dateTo: this.addUtcDays(dateFrom, 7),
				weightOverrides: input.weightOverrides,
				profile
			})

			if (input.persist && result.ratings.length > 0) {
				await this.ratingsRepository.persist({
					subjectType: "USER",
					organizationId: input.organizationId,
					repositoryId: input.repositoryId,
					bucket: dateFrom,
					period: input.period,
					profile,
					weightOverrides: input.weightOverrides,
					ratings: result.ratings,
					metricStats: result.metricStats
				})
			}

			return {
				bucket: dateFrom,
				...result
			}
		}

		const rows = this.filterHumanRows(
			await this.metricsReader.getUserRows({
				organizationId: input.organizationId,
				repositoryId: input.repositoryId,
				bucket: input.bucket
			})
		)
		const statsRows = await this.userStatsRowsForBuckets(
			input.organizationId,
			rows
		)
		const result = this.scoringService.calculate({
			subjectType: "USER",
			rows,
			statsRows,
			metricDefinitions: USER_METRICS,
			profile,
			weightOverrides: input.weightOverrides
		})

		if (input.persist && result.ratings.length > 0) {
			await this.ratingsRepository.persist({
				subjectType: "USER",
				organizationId: input.organizationId,
				repositoryId: input.repositoryId,
				bucket: result.ratings[0].bucket,
				period: input.period,
				profile,
				weightOverrides: input.weightOverrides,
				ratings: result.ratings,
				metricStats: result.metricStats
			})
		}

		return {
			bucket: result.ratings[0]?.bucket ?? null,
			...result
		}
	}

	public async calculateRepositoryRatings(
		input: CalculateRepositoryRatingsInput
	): Promise<RatingCalculationResult> {
		const profile = await this.scoringProfiles.getDefaultProfile("REPOSITORY")
		if (input.period === "WEEKLY") {
			const dateFrom = await this.resolveRepositoryWeekBucket(input)
			const result = await this.calculateRepositoryRatingsFromDailyRange({
				organizationId: input.organizationId,
				dateFrom,
				dateTo: this.addUtcDays(dateFrom, 7),
				weightOverrides: input.weightOverrides,
				profile
			})

			if (input.persist && result.ratings.length > 0) {
				await this.ratingsRepository.persist({
					subjectType: "REPOSITORY",
					organizationId: input.organizationId,
					repositoryId: null,
					bucket: dateFrom,
					period: input.period,
					profile,
					weightOverrides: input.weightOverrides,
					ratings: result.ratings,
					metricStats: result.metricStats
				})
			}

			return {
				bucket: dateFrom,
				...result
			}
		}

		const rows = await this.metricsReader.getRepositoryRows({
			organizationId: input.organizationId,
			bucket: input.bucket
		})
		const result = this.scoringService.calculate({
			subjectType: "REPOSITORY",
			rows,
			metricDefinitions: REPOSITORY_METRICS,
			profile,
			weightOverrides: input.weightOverrides
		})

		if (input.persist && result.ratings.length > 0) {
			await this.ratingsRepository.persist({
				subjectType: "REPOSITORY",
				organizationId: input.organizationId,
				repositoryId: null,
				bucket: result.ratings[0].bucket,
				period: input.period,
				profile,
				weightOverrides: input.weightOverrides,
				ratings: result.ratings,
				metricStats: result.metricStats
			})
		}

		return {
			bucket: result.ratings[0]?.bucket ?? null,
			...result
		}
	}

	public async calculateUserRatingsRange(
		input: CalculateUserRatingsRangeInput
	): Promise<RatingCalculationResult> {
		const profile = await this.scoringProfiles.getDefaultProfile("USER")
		const result = await this.calculateUserRatingsFromDailyRange({
			...input,
			profile
		})

		return {
			bucket: input.dateFrom,
			...result
		}
	}

	public async calculateRepositoryRatingsRange(
		input: CalculateRepositoryRatingsRangeInput
	): Promise<RatingCalculationResult> {
		const profile = await this.scoringProfiles.getDefaultProfile("REPOSITORY")
		const result = await this.calculateRepositoryRatingsFromDailyRange({
			...input,
			profile
		})

		return {
			bucket: input.dateFrom,
			...result
		}
	}

	public async listSemesters(input: {
		organizationId: string
		repositoryId?: string
		limit?: number
	}): Promise<SemesterOption[]> {
		return await this.metricsReader.listSemesters(input)
	}

	public async getSemesterRange(input: {
		semester: SemesterName
		year: number
	}) {
		return await this.metricsReader.getSemesterRange(input)
	}

	private async calculateUserRatingsFromDailyRange(
		input: CalculateUserRatingsRangeInput & { profile: ScoringProfile }
	) {
		const [rows, statsRows] = await Promise.all([
			this.aggregateUserRowsForRange({
				organizationId: input.organizationId,
				repositoryId: input.repositoryId,
				dateFrom: input.dateFrom,
				dateTo: input.dateTo
			}),
			this.aggregateUserRowsForRange({
				organizationId: input.organizationId,
				repositoryId: "",
				dateFrom: input.dateFrom,
				dateTo: input.dateTo
			})
		])

		return this.scoringService.calculate({
			subjectType: "USER",
			rows,
			statsRows,
			metricDefinitions: USER_METRICS,
			profile: input.profile,
			weightOverrides: input.weightOverrides
		})
	}

	private async aggregateUserRowsForRange(input: {
		organizationId: string
		repositoryId: string
		dateFrom: Date
		dateTo: Date
	}) {
		const buckets = await this.metricsReader.listUserBuckets(input)
		const rows = this.filterHumanRows(
			await this.metricsReader.getUserRows({
				organizationId: input.organizationId,
				repositoryId: input.repositoryId,
				bucket: buckets
			})
		)
		const [eventTypeCounts, pullRequestSizeStats, pullRequestTimingStats] =
			await Promise.all([
				this.metricsReader.getUserEventTypeCounts(input),
				this.metricsReader.getUserPullRequestSizeStats(input),
				this.metricsReader.getUserPullRequestTimingStats(input)
			])

		return this.applyEventTypeCounts(
			this.aggregateRows(
				rows,
				input.dateFrom,
				input.dateTo,
				pullRequestSizeStats,
				pullRequestTimingStats
			),
			eventTypeCounts
		)
	}

	private async calculateRepositoryRatingsFromDailyRange(
		input: CalculateRepositoryRatingsRangeInput & { profile: ScoringProfile }
	) {
		const buckets = await this.metricsReader.listRepositoryBuckets({
			organizationId: input.organizationId,
			dateFrom: input.dateFrom,
			dateTo: input.dateTo
		})
		const rows = await this.metricsReader.getRepositoryRows({
			organizationId: input.organizationId,
			bucket: buckets
		})
		const [eventTypeCounts, pullRequestSizeStats, pullRequestTimingStats] =
			await Promise.all([
				this.metricsReader.getRepositoryEventTypeCounts({
					organizationId: input.organizationId,
					dateFrom: input.dateFrom,
					dateTo: input.dateTo
				}),
				this.metricsReader.getRepositoryPullRequestSizeStats({
					organizationId: input.organizationId,
					dateFrom: input.dateFrom,
					dateTo: input.dateTo
				}),
				this.metricsReader.getRepositoryPullRequestTimingStats({
					organizationId: input.organizationId,
					dateFrom: input.dateFrom,
					dateTo: input.dateTo
				})
			])

		return this.scoringService.calculate({
			subjectType: "REPOSITORY",
			rows: this.applyEventTypeCounts(
				this.aggregateRows(
					rows,
					input.dateFrom,
					input.dateTo,
					pullRequestSizeStats,
					pullRequestTimingStats
				),
				eventTypeCounts
			),
			metricDefinitions: REPOSITORY_METRICS,
			profile: input.profile,
			weightOverrides: input.weightOverrides
		})
	}

	private aggregateRows(
		rows: RawRatingRow[],
		bucket: Date,
		dateTo: Date,
		pullRequestSizeStats: PullRequestSizeStatsRow[] = [],
		pullRequestTimingStats: PullRequestTimingStatsRow[] = []
	) {
		const rangeDays = this.rangeDays(bucket, dateTo)
		const totalEventsByRepository = this.totalEventsByRepository(rows)
		const pullRequestSizeStatsBySubject =
			this.pullRequestSizeStatsBySubject(pullRequestSizeStats)
		const pullRequestTimingStatsBySubject =
			this.pullRequestTimingStatsBySubject(pullRequestTimingStats)
		const grouped = rows.reduce<Map<string, RawRatingRow[]>>((acc, rating) => {
			const key = `${rating.repositoryId}:${rating.subjectId}`
			const group = acc.get(key) ?? []

			group.push(rating)
			acc.set(key, group)

			return acc
		}, new Map<string, RawRatingRow[]>())
		return [...grouped.values()].map(group => {
			const first = group[0]
			const aggregatedValues = this.applyPullRequestSizeStats(
				this.aggregateNumberMap(group.map(rating => rating.values)),
				first.repositoryId,
				first.subjectId,
				pullRequestSizeStatsBySubject
			)
			const valuesWithTimingStats = this.applyPullRequestTimingStats(
				aggregatedValues,
				first.repositoryId,
				first.subjectId,
				pullRequestTimingStatsBySubject
			)
			const values = this.recalculateActivityShare(
				this.recalculateRangeDerivedMetrics(
					valuesWithTimingStats,
					rangeDays
				),
				first.repositoryId,
				totalEventsByRepository
			)

			return {
				...first,
				bucket,
				values
			}
		})
	}

	private pullRequestSizeStatsBySubject(
		stats: PullRequestSizeStatsRow[]
	): Map<string, PullRequestSizeStatsRow> {
		return new Map(
			stats.map(item => [`${item.repositoryId}:${item.subjectId}`, item])
		)
	}

	private applyPullRequestSizeStats(
		values: Record<string, number>,
		repositoryId: string,
		subjectId: string,
		statsBySubject: Map<string, PullRequestSizeStatsRow>
	) {
		const stats = statsBySubject.get(`${repositoryId}:${subjectId}`)

		if (!stats) return values

		return {
			...values,
			pull_requests_created_count: stats.pullRequestsCreatedCount,
			health_pull_requests_created_count: stats.pullRequestsCreatedCount,
			avg_pull_request_size_lines: stats.avgPullRequestSizeLines,
			median_pull_request_size_lines: stats.medianPullRequestSizeLines
		}
	}

	private pullRequestTimingStatsBySubject(
		stats: PullRequestTimingStatsRow[]
	): Map<string, PullRequestTimingStatsRow> {
		return new Map(
			stats.map(item => [`${item.repositoryId}:${item.subjectId}`, item])
		)
	}

	private applyPullRequestTimingStats(
		values: Record<string, number>,
		repositoryId: string,
		subjectId: string,
		statsBySubject: Map<string, PullRequestTimingStatsRow>
	) {
		const stats = statsBySubject.get(`${repositoryId}:${subjectId}`)

		if (!stats) return values

		return {
			...values,
			median_review_response_time_sec: stats.medianReviewResponseTimeSec,
			p75_review_response_time_sec: stats.p75ReviewResponseTimeSec,
			time_to_first_review_median_sec: stats.timeToFirstReviewMedianSec,
			time_to_first_review_p75_sec: stats.timeToFirstReviewP75Sec,
			pull_request_cycle_time_median_sec:
				stats.pullRequestCycleTimeMedianSec,
			pull_request_cycle_time_p75_sec: stats.pullRequestCycleTimeP75Sec,
			issue_lead_time_median_sec: stats.issueLeadTimeMedianSec,
			issue_lead_time_p75_sec: stats.issueLeadTimeP75Sec
		}
	}

	private applyEventTypeCounts(
		rows: RawRatingRow[],
		eventTypeCounts: EventTypeCountRow[]
	) {
		const countsBySubject = new Map(
			eventTypeCounts.map(item => [
				`${item.repositoryId}:${item.subjectId}`,
				item.eventTypesCoveredCount
			])
		)

		return rows.map(row => {
			const eventTypesCoveredCount = countsBySubject.get(
				`${row.repositoryId}:${row.subjectId}`
			)

			if (eventTypesCoveredCount === undefined) return row

			return {
				...row,
				values: {
					...row.values,
					event_types_covered_count: eventTypesCoveredCount
				}
			}
		})
	}

	private filterHumanRows(rows: RawRatingRow[]) {
		return rows.filter(row => !/\[bot\]$/i.test(row.subjectLabel.trim()))
	}

	private async userStatsRowsForBuckets(
		organizationId: string,
		rows: RawRatingRow[]
	) {
		const buckets = [
			...new Map(rows.map(row => [row.bucket.toISOString(), row.bucket])).values()
		]

		if (buckets.length === 0) return rows

		return this.filterHumanRows(
			await this.metricsReader.getUserRows({
				organizationId,
				repositoryId: "",
				bucket: buckets
			})
		)
	}

	private totalEventsByRepository(rows: RawRatingRow[]) {
		return rows.reduce<Map<string, number>>((acc, row) => {
			if (!("activity_share_in_team" in row.values)) return acc

			acc.set(
				row.repositoryId,
				(acc.get(row.repositoryId) ?? 0) +
					this.numberValue(row.values.events_total)
			)

			return acc
		}, new Map<string, number>())
	}

	private recalculateActivityShare(
		values: Record<string, number>,
		repositoryId: string,
		totalEventsByRepository: Map<string, number>
	) {
		if (!("activity_share_in_team" in values)) return values

		const repositoryEvents = totalEventsByRepository.get(repositoryId) ?? 0

		return {
			...values,
			activity_share_in_team: this.ratio(
				this.numberValue(values.events_total),
				repositoryEvents
			)
		}
	}

	private aggregateNumberMap(items: Array<Record<string, number>>) {
		const values = items.reduce<Record<string, number[]>>((acc, item) => {
			for (const [key, value] of Object.entries(item)) {
				acc[key] = [...(acc[key] ?? []), this.numberValue(value)]
			}

			return acc
		}, {})

		return Object.entries(values).reduce<Record<string, number>>(
			(acc, [key, value]) => {
				const sum = value.reduce(
					(total, current) => total + this.numberValue(current),
					0
				)

				acc[key] = this.isCounterMetric(key)
					? this.round(sum)
					: this.round(sum / value.length)

				return acc
			},
			{}
		)
	}

	private isCounterMetric(metric: string) {
		return ADDITIVE_RANGE_METRICS.has(metric)
	}

	private recalculateRangeDerivedMetrics(
		values: Record<string, number>,
		rangeDays: number
	) {
		const next = { ...values }
		const value = (metric: string) => this.numberValue(next[metric])
		const ratio = (numerator: number, denominator: number) =>
			denominator > 0 ? this.round(numerator / denominator) : 0
		const boundedRatio = (numerator: number, denominator: number) =>
			this.clampRatio(ratio(numerator, denominator))

		if ("activity_consistency_score" in next) {
			next.activity_consistency_score = this.round(
				Math.min(1, value("active_days_count") / rangeDays)
			)
		}

		if ("deletion_to_addition_ratio" in next) {
			next.deletion_to_addition_ratio = ratio(
				value("code_deletions"),
				value("code_additions")
			)
		}

		if ("commit_to_pr_ratio" in next) {
			next.commit_to_pr_ratio = ratio(
				value("commits_count"),
				value("pull_requests_created_count")
			)
		}

		if ("code_churn_per_pr" in next) {
			next.code_churn_per_pr = ratio(
				value("code_churn"),
				value("pull_requests_created_count")
			)
		}

		if ("comments_per_review_ratio" in next) {
			next.comments_per_review_ratio = ratio(
				value("issue_comments_count") + value("pull_request_comments_count"),
				value("reviews_count")
			)
		}

		if ("review_response_ratio" in next) {
			next.review_response_ratio = boundedRatio(
				value("review_responses_count"),
				value("review_requests_count")
			)
		}

		if ("unanswered_review_request_ratio" in next) {
			next.unanswered_review_request_ratio = boundedRatio(
				value("review_queue_pressure"),
				value("review_requests_count")
			)
		}

		if ("throughput_ratio" in next) {
			next.throughput_ratio = boundedRatio(
				value("done_work_count"),
				value("incoming_work_count")
			)
		}

		if ("backlog_growth_ratio" in next) {
			next.backlog_growth_ratio = boundedRatio(
				Math.max(value("work_balance_delta"), 0),
				value("incoming_work_count")
			)
		}

		if ("backlog_reduction_ratio" in next) {
			next.backlog_reduction_ratio = boundedRatio(
				Math.max(value("done_work_count") - value("incoming_work_count"), 0),
				value("done_work_count")
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

		if ("queue_stability_index" in next) {
			const backlog =
				"total_backlog_delta" in next
					? value("total_backlog_delta")
					: value("issue_backlog_delta") + value("pull_request_backlog_delta")

			next.queue_stability_index = this.round(1 / (1 + Math.max(backlog, 0)))
		}

		if ("rework_intensity" in next) {
			next.rework_intensity = ratio(
				value("issues_reopened_count") + value("pull_requests_reopened_count"),
				value("events_total")
			)
		}

		if ("merged_without_review_ratio" in next) {
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

		if ("large_pull_request_ratio" in next) {
			next.large_pull_request_ratio = boundedRatio(
				value("large_pull_requests_count"),
				value("pull_requests_created_count")
			)
		}

		if ("small_pull_request_ratio" in next) {
			next.small_pull_request_ratio = boundedRatio(
				value("small_pull_requests_count"),
				value("pull_requests_created_count")
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

		return this.clampBoundedRatios(next)
	}

	private async resolveUserWeekBucket(input: CalculateUserRatingsInput) {
		const bucket =
			input.bucket ??
			(await this.metricsReader.getLatestUserBucket({
				organizationId: input.organizationId,
				repositoryId: input.repositoryId
			}))

		return this.startOfUtcWeek(bucket)
	}

	private async resolveRepositoryWeekBucket(
		input: CalculateRepositoryRatingsInput
	) {
		const bucket =
			input.bucket ??
			(await this.metricsReader.getLatestRepositoryBucket({
				organizationId: input.organizationId
			}))

		return this.startOfUtcWeek(bucket)
	}

	private rangeDays(dateFrom: Date, dateTo: Date) {
		const dayMs = 24 * 60 * 60 * 1000
		const from = this.startOfUtcDay(dateFrom).getTime()
		const to = this.startOfUtcDay(dateTo).getTime()

		return Math.max(1, Math.ceil((to - from) / dayMs))
	}

	private startOfUtcWeek(value: Date) {
		const date = this.startOfUtcDay(value)
		const day = date.getUTCDay()
		const mondayOffset = day === 0 ? -6 : 1 - day

		date.setUTCDate(date.getUTCDate() + mondayOffset)

		return date
	}

	private startOfUtcDay(value: Date) {
		return new Date(
			Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
		)
	}

	private addUtcDays(value: Date, days: number) {
		const date = this.startOfUtcDay(value)

		date.setUTCDate(date.getUTCDate() + days)

		return date
	}

	private numberValue(value: unknown) {
		if (typeof value === "number") return Number.isFinite(value) ? value : 0
		if (typeof value === "bigint") return Number(value)
		if (value === null || value === undefined) return 0

		const parsed = Number(value)

		return Number.isFinite(parsed) ? parsed : 0
	}

	private round(value: number) {
		return Math.round(value * 10000) / 10000
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

	private ratio(numerator: number, denominator: number) {
		return denominator > 0 ? this.round(numerator / denominator) : 0
	}
}
