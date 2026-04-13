import { RpcStatus } from "@citec-spbu/common"
import {
	ANALYTICS_SERVICE_NAME,
	AnalyticsServiceController,
	AnalyticsServiceControllerMethods,
	GetDefaultScoringProfileRequest,
	GetRepositoryRatingsRequest,
	GetRepositoryRatingsResponse,
	GetUserRatingsRequest,
	GetUserRatingsResponse,
	ListScoringProfilesRequest,
	ListScoringProfilesResponse,
	MetricOptimalRange,
	RatingSubjectType as ProtoRatingSubjectType,
	ScoringProfileStatus as ProtoScoringProfileStatus,
	ScoreWeight,
	ScoringProfile,
	ScoringProfileResponse,
	UpsertScoringProfileRequest
} from "@citec-spbu/contracts/gen/ts/analytics"
import { Controller } from "@nestjs/common"
import { GrpcMethod, RpcException } from "@nestjs/microservices"

import type {
	RatingSubjectType,
	ListSemestersRequest,
	ListSemestersResponse
} from "@/modules/ratings/rating.types"
import {
	ScoringProfileStatusName,
	ScoringProfileView
} from "@/modules/scoring-profiles/scoring-profile.types"
import { ScoringProfilesService } from "@/modules/scoring-profiles/scoring-profiles.service"
import { listMetricMetadata } from "@/modules/metric-metadata/metric-metadata"

import { RatingsService } from "./ratings.service"

@Controller()
@AnalyticsServiceControllerMethods()
export class RatingsController implements AnalyticsServiceController {
	public constructor(
		private readonly ratingsService: RatingsService,
		private readonly scoringProfilesService: ScoringProfilesService
	) {}

	public async getUserRatings(
		request: GetUserRatingsRequest
	): Promise<GetUserRatingsResponse> {
		return await this.ratingsService.getUserRatings(request)
	}

	public async getRepositoryRatings(
		request: GetRepositoryRatingsRequest
	): Promise<GetRepositoryRatingsResponse> {
		return await this.ratingsService.getRepositoryRatings(request)
	}

	@GrpcMethod(ANALYTICS_SERVICE_NAME, "ListSemesters")
	public async listSemesters(
		request: ListSemestersRequest
	): Promise<ListSemestersResponse> {
		return await this.ratingsService.listSemesters(request)
	}

	public async listScoringProfiles(
		request: ListScoringProfilesRequest
	): Promise<ListScoringProfilesResponse> {
		const subjectType = this.resolveSubjectType(request.subjectType, false)
		const profiles = await this.scoringProfilesService.listProfiles({
			subjectType,
			includeArchived: request.includeArchived
		})

		return {
			profiles: profiles.map(profile => this.toProtoProfile(profile))
		}
	}

	public async getDefaultScoringProfile(
		request: GetDefaultScoringProfileRequest
	): Promise<ScoringProfileResponse> {
		const profile = await this.scoringProfilesService.getDefaultProfileView(
			this.resolveSubjectType(request.subjectType, true)
		)

		return {
			profile: this.toProtoProfile(profile)
		}
	}

	public async upsertScoringProfile(
		request: UpsertScoringProfileRequest
	): Promise<ScoringProfileResponse> {
		const profile = await this.scoringProfilesService.upsertProfile({
			id: request.id,
			name: request.name,
			subjectType: this.resolveSubjectType(request.subjectType, true),
			algorithmVersion: request.algorithmVersion,
			categoryWeights: this.scoreWeightMap(request.categoryWeights),
			metricWeights: this.scoreWeightMap(request.metricWeights),
			optimalRanges: this.optimalRanges(request.optimalRanges),
			isDefault: request.isDefault,
			status: this.resolveStatus(request.status)
		})

		return {
			profile: this.toProtoProfile(profile)
		}
	}

	@GrpcMethod(ANALYTICS_SERVICE_NAME, "ListMetricMetadata")
	public listMetricMetadata() {
		return { metrics: listMetricMetadata() }
	}

	private resolveSubjectType(
		value: ProtoRatingSubjectType | string | number,
		required: true
	): RatingSubjectType
	private resolveSubjectType(
		value: ProtoRatingSubjectType | string | number,
		required: false
	): RatingSubjectType | null
	private resolveSubjectType(
		value: ProtoRatingSubjectType | string | number,
		required: boolean
	) {
		if (
			value === ProtoRatingSubjectType.RATING_SUBJECT_TYPE_USER ||
			value === "RATING_SUBJECT_TYPE_USER" ||
			value === "USER" ||
			value === 1
		) {
			return "USER"
		}

		if (
			value === ProtoRatingSubjectType.RATING_SUBJECT_TYPE_REPOSITORY ||
			value === "RATING_SUBJECT_TYPE_REPOSITORY" ||
			value === "REPOSITORY" ||
			value === 2
		) {
			return "REPOSITORY"
		}

		if (!required) return null

		throw new RpcException({
			code: RpcStatus.INVALID_ARGUMENT,
			details: "Rating subject type must be USER or REPOSITORY"
		})
	}

	private resolveStatus(
		value: ProtoScoringProfileStatus | string | number
	): ScoringProfileStatusName {
		if (
			value === ProtoScoringProfileStatus.SCORING_PROFILE_STATUS_ARCHIVED ||
			value === "SCORING_PROFILE_STATUS_ARCHIVED" ||
			value === "ARCHIVED" ||
			value === 2
		) {
			return "ARCHIVED"
		}

		return "ACTIVE"
	}

	private scoreWeightMap(
		weights: ScoreWeight[] | undefined
	): Record<string, number> {
		return (weights ?? []).reduce<Record<string, number>>((acc, weight) => {
			const parsed = Number(weight.weight)

			if (weight.metric && Number.isFinite(parsed)) {
				acc[weight.metric] = Math.max(0, parsed)
			}

			return acc
		}, {})
	}

	private optimalRanges(ranges: MetricOptimalRange[] | undefined) {
		return (ranges ?? []).reduce<Record<string, { min: number; max: number }>>(
			(acc, range) => {
				const min = Number(range.min)
				const max = Number(range.max)

				if (range.metric && Number.isFinite(min) && Number.isFinite(max)) {
					acc[range.metric] = { min, max }
				}

				return acc
			},
			{}
		)
	}

	private toProtoProfile(profile: ScoringProfileView): ScoringProfile {
		return {
			id: profile.id,
			name: profile.name,
			subjectType:
				profile.subjectType === "USER"
					? ProtoRatingSubjectType.RATING_SUBJECT_TYPE_USER
					: ProtoRatingSubjectType.RATING_SUBJECT_TYPE_REPOSITORY,
			algorithmVersion: profile.algorithmVersion,
			categoryWeights: this.toScoreWeights(profile.categoryWeights),
			metricWeights: this.toScoreWeights(profile.metricWeights),
			optimalRanges: Object.entries(profile.optimalRanges).map(
				([metric, range]) => ({
					metric,
					min: range.min,
					max: range.max
				})
			),
			isDefault: profile.isDefault,
			status:
				profile.status === "ACTIVE"
					? ProtoScoringProfileStatus.SCORING_PROFILE_STATUS_ACTIVE
					: ProtoScoringProfileStatus.SCORING_PROFILE_STATUS_ARCHIVED
		}
	}

	private toScoreWeights(weights: Record<string, number>): ScoreWeight[] {
		return Object.entries(weights).map(([metric, weight]) => ({
			metric,
			weight
		}))
	}
}
