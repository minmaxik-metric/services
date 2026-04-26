import type {
	RepositoryRating,
	RepositoryRatingsResponse,
	RepositoryUserRating,
	ScoreWeight,
	UserRatingsResponse
} from "@/entities/rating/model/types"
import { ApiError, apiRequest } from "@/shared/api/client"

import type { RatingsFilters } from "../model/ratings-filter-store"

const DEFAULT_LIMIT = 100

type RatingRequest = {
	organizationId?: string
	repositoryId?: string
	semester: RatingsFilters["semester"]
	year: RatingsFilters["year"]
	dateFrom: string
	dateTo: string
	limit: number
	weights?: ScoreWeight[]
}

export type AvailableSemester = {
	semester: RatingsFilters["semester"]
	year: number
	label: string
	dateFrom: string
	dateTo: string
}

export type SupervisorOrganization = {
	externalId: string
	login: string
	url: string
	key: string
	label: string
}

export type MetricMetadata = {
	metric: string
	label: string
	description: string
}

export function getMetricMetadata() {
	return apiRequest<{ metrics: MetricMetadata[] }>("/analytics/metric-metadata")
}

export function getUserRatings(params: RatingRequest) {
	return apiRequest<UserRatingsResponse>(
		`/analytics/ratings/users?${buildQuery(params)}`
	)
}

export function getRepositoryRatings(
	params: Omit<RatingRequest, "repositoryId">
) {
	return apiRequest<RepositoryRatingsResponse>(
		`/analytics/ratings/repositories?${buildQuery(params)}`
	)
}

export function getAvailableSemesters(organizationId?: string) {
	const query = organizationId
		? `?${new URLSearchParams({ organizationId }).toString()}`
		: ""

	return apiRequest<{ semesters: AvailableSemester[] }>(
		`/analytics/semesters${query}`
	)
}

export function getSupervisorOrganizations() {
	return apiRequest<{ organizations: SupervisorOrganization[] }>(
		"/analytics/supervisor-organizations"
	)
}

export function getRepositoryRatingsByFilters(filters: RatingsFilters) {
	return getRepositoryRatings(buildBaseRequest(filters))
}

export async function getRepositoryUserRatingsByFilters(
	filters: RatingsFilters,
	repositories: RepositoryRating[],
	_bucket?: string
): Promise<RepositoryUserRating[]> {
	const request = buildBaseRequest(filters)

	const responses = await Promise.all(
		repositories.map(async (repository) => {
			try {
				const response = await getUserRatings({
					...request,
					repositoryId: repository.repositoryId
				})

				return response.ratings.map((rating) => ({
					...rating,
					repositoryId: repository.repositoryId,
					repositoryName: repository.repositoryName,
					repositoryUrl: repository.repositoryUrl
				}))
			} catch (error) {
				if (
					error instanceof ApiError &&
					[404, 500, 502, 503, 504].includes(error.status)
				) {
					return []
				}

				throw error
			}
		})
	)

	return responses.flat()
}

function buildBaseRequest(filters: RatingsFilters): RatingRequest {
	return {
		organizationId: filters.organizationId,
		semester: filters.semester,
		year: filters.year,
		dateFrom: filters.dateFrom,
		dateTo: filters.dateTo,
		limit: DEFAULT_LIMIT
	}
}

function buildQuery(params: Partial<RatingRequest>) {
	const query = new URLSearchParams()

	if (params.organizationId) query.set("organizationId", params.organizationId)
	if (params.repositoryId) query.set("repositoryId", params.repositoryId)
	if (params.semester) query.set("semester", params.semester)
	if (params.year) query.set("year", String(params.year))
	if (params.dateFrom) query.set("dateFrom", params.dateFrom)
	if (params.dateTo) query.set("dateTo", params.dateTo)
	if (params.limit) query.set("limit", String(params.limit))
	if (params.weights?.length) {
		query.set(
			"weights",
			params.weights
				.filter((weight) => weight.metric)
				.map((weight) => `${weight.metric}:${weight.weight}`)
				.join(",")
		)
	}

	return query.toString()
}
