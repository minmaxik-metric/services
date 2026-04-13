import {
	GetRepositoryRatingsRequest,
	GetRepositoryRatingsResponse,
	GetUserRatingsRequest,
	GetUserRatingsResponse,
	RepositoryRating,
	ScoreWeight,
	UserRating
} from "@citec-spbu/contracts/gen/ts/analytics"
import { RpcStatus } from "@citec-spbu/common"
import { Injectable } from "@nestjs/common"
import { RpcException } from "@nestjs/microservices"

import { RatingCalculationService } from "@/modules/rating-calculation/rating-calculation.service"
import { RatingsRepository } from "@/modules/rating-storage/ratings.repository"
import { ScoringProfilesService } from "@/modules/scoring-profiles/scoring-profiles.service"
import {
	CalculatedRating,
	ScoreWeightInput
} from "@/modules/scoring/scoring.types"

import {
	parseBucket,
	parseRatingRange,
	resolveRatingPeriod
} from "./rating-period"
import type {
	ListSemestersRequest,
	ListSemestersResponse,
	RatingPeriodName
} from "./rating.types"

@Injectable()
export class RatingsService {
	public constructor(
		private readonly ratingCalculation: RatingCalculationService,
		private readonly scoringProfiles: ScoringProfilesService,
		private readonly ratingsRepository: RatingsRepository
	) {}

	public async getUserRatings(
		request: GetUserRatingsRequest
	): Promise<GetUserRatingsResponse> {
		const period = resolveRatingPeriod(request.period)
		const range = await this.resolveRange(parseRatingRange(request.bucket))
		const weightOverrides = this.weightOverrides(request.weights)

		if (range) {
			const calculated = await this.ratingCalculation.calculateUserRatingsRange(
				{
					organizationId: request.organizationId,
					repositoryId: request.repositoryId,
					dateFrom: range.dateFrom,
					dateTo: range.dateTo,
					weightOverrides
				}
			)

			return {
				bucket: request.bucket,
				ratings: this.limitRatings(calculated.ratings, request.limit).map(
					rating => this.toUserRating(rating)
				)
			}
		}

		const bucket = parseBucket(request.bucket)

		if (weightOverrides.length > 0) {
			const calculated = await this.ratingCalculation.calculateUserRatings({
				organizationId: request.organizationId,
				repositoryId: request.repositoryId,
				period,
				bucket,
				weightOverrides,
				persist: false
			})

			return {
				bucket: calculated.bucket?.toISOString() ?? request.bucket,
				ratings: this.limitRatings(calculated.ratings, request.limit).map(
					rating => this.toUserRating(rating)
				)
			}
		}

		const profile = await this.scoringProfiles.getDefaultProfile("USER")
		const stored = await this.ratingsRepository.findRatings({
			subjectType: "USER",
			organizationId: request.organizationId,
			repositoryId: request.repositoryId,
			bucket: this.storedBucket(period, bucket),
			period,
			profileId: profile.id,
			limit: request.limit
		})

		if (stored.length > 0) {
			return {
				bucket: stored[0].bucket.toISOString(),
				ratings: stored.map(rating => this.toUserRating(rating))
			}
		}

		const calculated = await this.ratingCalculation.calculateUserRatings({
			organizationId: request.organizationId,
			repositoryId: request.repositoryId,
			period,
			bucket,
			weightOverrides: [],
			persist: true
		})

		return {
			bucket: calculated.bucket?.toISOString() ?? request.bucket,
			ratings: this.limitRatings(calculated.ratings, request.limit).map(
				rating => this.toUserRating(rating)
			)
		}
	}

	public async getRepositoryRatings(
		request: GetRepositoryRatingsRequest
	): Promise<GetRepositoryRatingsResponse> {
		const period = resolveRatingPeriod(request.period)
		const range = await this.resolveRange(parseRatingRange(request.bucket))
		const weightOverrides = this.weightOverrides(request.weights)

		if (range) {
			const calculated =
				await this.ratingCalculation.calculateRepositoryRatingsRange({
					organizationId: request.organizationId,
					dateFrom: range.dateFrom,
					dateTo: range.dateTo,
					weightOverrides
				})

			return {
				bucket: request.bucket,
				ratings: this.limitRatings(calculated.ratings, request.limit).map(
					rating => this.toRepositoryRating(rating)
				)
			}
		}

		const bucket = parseBucket(request.bucket)

		if (weightOverrides.length > 0) {
			const calculated =
				await this.ratingCalculation.calculateRepositoryRatings({
					organizationId: request.organizationId,
					period,
					bucket,
					weightOverrides,
					persist: false
				})

			return {
				bucket: calculated.bucket?.toISOString() ?? request.bucket,
				ratings: this.limitRatings(calculated.ratings, request.limit).map(
					rating => this.toRepositoryRating(rating)
				)
			}
		}

		const profile = await this.scoringProfiles.getDefaultProfile("REPOSITORY")
		const stored = await this.ratingsRepository.findRatings({
			subjectType: "REPOSITORY",
			organizationId: request.organizationId,
			repositoryId: null,
			bucket: this.storedBucket(period, bucket),
			period,
			profileId: profile.id,
			limit: request.limit
		})

		if (stored.length > 0) {
			return {
				bucket: stored[0].bucket.toISOString(),
				ratings: stored.map(rating => this.toRepositoryRating(rating))
			}
		}

		const calculated = await this.ratingCalculation.calculateRepositoryRatings({
			organizationId: request.organizationId,
			period,
			bucket,
			weightOverrides: [],
			persist: true
		})

		return {
			bucket: calculated.bucket?.toISOString() ?? request.bucket,
			ratings: this.limitRatings(calculated.ratings, request.limit).map(
				rating => this.toRepositoryRating(rating)
			)
		}
	}

	public async listSemesters(
		request: ListSemestersRequest
	): Promise<ListSemestersResponse> {
		return {
			semesters: await this.ratingCalculation.listSemesters({
				organizationId: request.organizationId?.trim() ?? "",
				repositoryId: request.repositoryId?.trim() ?? "",
				limit: request.limit
			})
		}
	}

	private limitRatings<T>(ratings: T[], limit: number) {
		if (!limit || limit <= 0) return ratings

		return ratings.slice(0, Math.min(limit, 100))
	}

	private weightOverrides(
		weights: ScoreWeight[] | undefined
	): ScoreWeightInput[] {
		return (weights ?? [])
			.map(weight => ({
				metric: weight.metric,
				weight: Number(weight.weight)
			}))
			.filter(weight => weight.metric && Number.isFinite(weight.weight))
	}

	private async resolveRange(range: ReturnType<typeof parseRatingRange>) {
		if (!range) return null

		if (range.dateFrom && range.dateTo) {
			return {
				dateFrom: range.dateFrom,
				dateTo: range.dateTo
			}
		}

		if (range.semester && range.semesterYear) {
			return await this.ratingCalculation.getSemesterRange({
				semester: range.semester,
				year: range.semesterYear
			})
		}

		throw new RpcException({
			code: RpcStatus.INVALID_ARGUMENT,
			details: "Rating range must include semester dates or semester year"
		})
	}

	private storedBucket(period: RatingPeriodName, bucket: Date | null) {
		if (!bucket || period !== "WEEKLY") return bucket

		return this.startOfUtcWeek(bucket)
	}

	private startOfUtcWeek(value: Date) {
		const date = new Date(
			Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
		)
		const day = date.getUTCDay()
		const mondayOffset = day === 0 ? -6 : 1 - day

		date.setUTCDate(date.getUTCDate() + mondayOffset)

		return date
	}

	private toUserRating(rating: CalculatedRating): UserRating {
		return {
			contributorId: rating.subjectId,
			contributorLogin: rating.subjectLabel,
			eventsTotal: rating.rawValues.events_total ?? 0,
			eventTypesCoveredCount: rating.rawValues.event_types_covered_count ?? 0,
			activeDaysCount: rating.rawValues.active_days_count ?? 0,
			activityConsistencyScore:
				rating.rawValues.activity_consistency_score ?? 0,
			activityShareInTeam: rating.rawValues.activity_share_in_team ?? 0,
			score: rating.score,
			rank: rating.rank,
			scoreComponents: rating.components,
			activityScore: rating.activityScore,
			productivityScore: rating.productivityScore,
			communicationScore: rating.communicationScore,
			qualityScore: rating.qualityScore,
			flowScore: rating.flowScore,
			repositoryHealthScore: rating.repositoryHealthScore
		}
	}

	private toRepositoryRating(rating: CalculatedRating): RepositoryRating {
		return {
			repositoryId: rating.subjectId,
			repositoryName: rating.subjectLabel,
			repositoryUrl: rating.metadata.repositoryUrl ?? "",
			eventsTotal: rating.rawValues.events_total ?? 0,
			activeContributorsCount: rating.rawValues.active_contributors_count ?? 0,
			eventsPerActiveContributor:
				rating.rawValues.events_per_active_contributor ?? 0,
			contributorsWithCommitsCount:
				rating.rawValues.contributors_with_commits_count ?? 0,
			contributorsWithReviewsCount:
				rating.rawValues.contributors_with_reviews_count ?? 0,
			eventTypesCoveredCount: rating.rawValues.event_types_covered_count ?? 0,
			activeDaysCount: rating.rawValues.active_days_count ?? 0,
			activityConsistencyScore:
				rating.rawValues.activity_consistency_score ?? 0,
			score: rating.score,
			rank: rating.rank,
			scoreComponents: rating.components,
			activityScore: rating.activityScore,
			productivityScore: rating.productivityScore,
			communicationScore: rating.communicationScore,
			qualityScore: rating.qualityScore,
			flowScore: rating.flowScore,
			repositoryHealthScore: rating.repositoryHealthScore
		}
	}
}
