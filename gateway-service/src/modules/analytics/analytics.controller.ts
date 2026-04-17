import { Role } from "@citec-spbu/contracts/gen/ts/account"
import {
	type Semester as AnalyticsSemester,
	RatingPeriod,
	type RepositoryRating,
	RatingSubjectType,
	type ScoreWeight,
	ScoringProfileStatus,
	type UserRating
} from "@citec-spbu/contracts/gen/ts/analytics"
import {
	BadRequestException,
	Body,
	Controller,
	Get,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Put,
	Query
} from "@nestjs/common"
import { ApiBearerAuth, ApiOperation, ApiQuery } from "@nestjs/swagger"

import { Protected } from "@/shared/decorators"
import { CurrentUser } from "@/shared/decorators/current-user.decorator"

import { AccountClientGrpc } from "../account/account.grpc"

import { AnalyticsClientGrpc } from "./analytics.grpc"
import type {
	AddSupervisorToPoolBodyDto,
	RatingsQueryDto,
	ScoringProfileBodyDto,
	ScoringProfilesQueryDto,
	SemesterOptionResponseDto,
	SemestersQueryDto,
	SupervisorOrganizationOptionResponseDto
} from "./dto"
import type { RatingScope, Semester, SemesterRange } from "./types"

@Controller("analytics")
export class AnalyticsController {
	public constructor(
		private readonly analyticsClient: AnalyticsClientGrpc,
		private readonly accountClient: AccountClientGrpc
	) {}

	@ApiOperation({ summary: "Get user ratings from analytics-service." })
	@ApiBearerAuth()
	@ApiQuery({ name: "repositoryId", required: false })
	@ApiQuery({
		name: "semester",
		required: false,
		enum: ["autumn", "spring"]
	})
	@ApiQuery({ name: "year", required: false })
	@ApiQuery({ name: "dateFrom", required: false })
	@ApiQuery({ name: "dateTo", required: false })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "weights", required: false })
	@Protected()
	@Get("ratings/users")
	@HttpCode(HttpStatus.OK)
	public async getUserRatings(
		@CurrentUser() accountId: string,
		@Query() query: RatingsQueryDto
	) {
		const scope = await this.ratingScope(accountId, query.organizationId)
		const bucket = await this.semesterBucket(scope, query)
		const weights = this.weights(query.weights)
		const responses = await Promise.all(
			scope.organizationIds.map(organizationId =>
				this.analyticsClient.call("getUserRatings", {
					organizationId,
					repositoryId: query.repositoryId?.trim() ?? "",
					period: RatingPeriod.RATING_PERIOD_DAILY,
					bucket,
					limit: this.limit(query.limit),
					weights
				})
			)
		)
		const merged = this.mergeRatings(
			responses.flatMap(response => response?.ratings ?? []),
			responses.find(Boolean)?.bucket ?? ""
		)

		if (scope.isSupervisor) return this.userRatingsResponse(merged)

		if (query.repositoryId?.trim()) {
			const ownRatings = this.currentUserRatings(merged.ratings, scope)

			return this.userRatingsResponse({
				...merged,
				ratings: ownRatings.length > 0 ? ownRatings : []
			})
		}

		return this.userRatingsResponse({
			...merged,
			ratings: this.currentUserRatings(merged.ratings, scope)
		})
	}

	@ApiOperation({ summary: "Get repository ratings from analytics-service." })
	@ApiBearerAuth()
	@ApiQuery({
		name: "semester",
		required: false,
		enum: ["autumn", "spring"]
	})
	@ApiQuery({ name: "year", required: false })
	@ApiQuery({ name: "dateFrom", required: false })
	@ApiQuery({ name: "dateTo", required: false })
	@ApiQuery({ name: "limit", required: false })
	@ApiQuery({ name: "weights", required: false })
	@Protected()
	@Get("ratings/repositories")
	@HttpCode(HttpStatus.OK)
	public async getRepositoryRatings(
		@CurrentUser() accountId: string,
		@Query() query: RatingsQueryDto
	) {
		const scope = await this.ratingScope(accountId, query.organizationId)
		const bucket = await this.semesterBucket(scope, query)
		const limit = this.limit(query.limit)
		const weights = this.weights(query.weights)
		const merged = await this.repositoryRatingsForScope({
			scope,
			bucket,
			limit,
			weights
		})

		if (scope.isSupervisor) return this.repositoryRatingsResponse(merged)

		const visibleRepositoryIds = await this.currentUserRepositoryIds({
			scope,
			repositoryIds: merged.ratings.map(rating => rating.repositoryId),
			bucket,
			weights
		})

		return this.repositoryRatingsResponse({
			...merged,
			ratings: merged.ratings.filter(rating =>
				visibleRepositoryIds.has(rating.repositoryId)
			)
		})
	}

	@ApiOperation({ summary: "List semesters available for current user." })
	@ApiBearerAuth()
	@Protected()
	@Get("semesters")
	@HttpCode(HttpStatus.OK)
	public async listSemesters(
		@CurrentUser() accountId: string,
		@Query() query: SemestersQueryDto
	) {
		const scope = await this.ratingScope(accountId, query.organizationId)

		return {
			semesters: await this.semestersForScope(scope)
		}
	}

	@ApiOperation({
		summary: "List supervisor organizations available for scope."
	})
	@ApiBearerAuth()
	@Protected(Role.ROLE_SUPERVISOR, Role.ROLE_ADMIN)
	@Get("supervisor-organizations")
	@HttpCode(HttpStatus.OK)
	public async listSupervisorOrganizations(@CurrentUser() accountId: string) {
		const scope = await this.ratingScope(accountId)

		return { organizations: scope.organizations }
	}

	@ApiOperation({ summary: "List metric labels and descriptions." })
	@ApiBearerAuth()
	@Protected()
	@Get("metric-metadata")
	@HttpCode(HttpStatus.OK)
	public async listMetricMetadata() {
		return await this.analyticsClient.call("listMetricMetadata", {})
	}

	@ApiOperation({
		summary: "Add supervisor to current supervisor organization pool."
	})
	@ApiBearerAuth()
	@Protected(Role.ROLE_SUPERVISOR, Role.ROLE_ADMIN)
	@Post("supervisor-pool")
	@HttpCode(HttpStatus.OK)
	public async addSupervisorToPool(
		@CurrentUser() accountId: string,
		@Body() body: AddSupervisorToPoolBodyDto
	) {
		return await this.accountClient.call("addSupervisorToPool", {
			ownerAccountId: accountId,
			supervisorAccountId:
				body.supervisorIdentity?.trim() ??
				body.supervisorAccountId?.trim() ??
				""
		})
	}

	@ApiOperation({ summary: "List scoring profiles." })
	@ApiBearerAuth()
	@ApiQuery({
		name: "subjectType",
		required: false,
		enum: ["USER", "REPOSITORY"]
	})
	@ApiQuery({ name: "includeArchived", required: false })
	@Protected(Role.ROLE_SUPERVISOR, Role.ROLE_ADMIN)
	@Get("scoring-profiles")
	@HttpCode(HttpStatus.OK)
	public async listScoringProfiles(@Query() query: ScoringProfilesQueryDto) {
		return await this.analyticsClient.call("listScoringProfiles", {
			subjectType: this.subjectType(query.subjectType, false),
			includeArchived: query.includeArchived === "true"
		})
	}

	@ApiOperation({ summary: "Get default scoring profile." })
	@ApiBearerAuth()
	@ApiQuery({
		name: "subjectType",
		required: true,
		enum: ["USER", "REPOSITORY"]
	})
	@Protected(Role.ROLE_SUPERVISOR, Role.ROLE_ADMIN)
	@Get("scoring-profiles/default")
	@HttpCode(HttpStatus.OK)
	public async getDefaultScoringProfile(
		@Query() query: ScoringProfilesQueryDto
	) {
		return await this.analyticsClient.call("getDefaultScoringProfile", {
			subjectType: this.subjectType(query.subjectType, true)
		})
	}

	@ApiOperation({ summary: "Create or update scoring profile." })
	@ApiBearerAuth()
	@Protected(Role.ROLE_SUPERVISOR, Role.ROLE_ADMIN)
	@Put("scoring-profiles/:id")
	@HttpCode(HttpStatus.OK)
	public async upsertScoringProfile(
		@Param("id") id: string,
		@Body() body: ScoringProfileBodyDto
	) {
		return await this.analyticsClient.call("upsertScoringProfile", {
			id: body.id?.trim() || id,
			name: body.name?.trim() ?? "",
			subjectType: this.subjectType(body.subjectType, true),
			algorithmVersion: body.algorithmVersion?.trim() ?? "",
			categoryWeights: this.weightArray(body.categoryWeights),
			metricWeights: this.weightArray(body.metricWeights),
			optimalRanges: (body.optimalRanges ?? []).filter(range => range.metric),
			isDefault: Boolean(body.isDefault),
			status: this.profileStatus(body.status)
		})
	}

	private async ratingScope(
		accountId: string,
		selectedOrganizationId?: string
	): Promise<RatingScope> {
		const account = await this.accountClient.call("getAccount", {
			id: accountId
		})

		const isSupervisor =
			account.role === Role.ROLE_SUPERVISOR || account.role === Role.ROLE_ADMIN

		if (!isSupervisor) {
			return {
				accountId,
				isSupervisor,
				organizationIds: [""],
				organizations: []
			}
		}

		const response = await this.accountClient.call(
			"listSupervisorOrganizations",
			{
				accountId
			}
		)

		const organizations = this.supervisorOrganizations(
			response.organizations ?? []
		)
		const selected = selectedOrganizationId?.trim()
		const organizationIds = selected
			? organizations
					.filter(organization =>
						this.organizationMatches(organization, selected)
					)
					.map(organization => organization.key)
			: organizations.map(organization => organization.key)

		return {
			accountId,
			isSupervisor,
			organizations,
			organizationIds
		}
	}

	private supervisorOrganizations(
		organizations: Array<{ externalId?: string; login?: string; url?: string }>
	): SupervisorOrganizationOptionResponseDto[] {
		const unique = new Map<string, SupervisorOrganizationOptionResponseDto>()

		for (const organization of organizations) {
			const externalId = organization.externalId?.trim() ?? ""
			const login = organization.login?.trim() ?? ""
			const url = organization.url?.trim() ?? ""
			const key = login || url || externalId

			if (!key) continue

			const option = {
				externalId,
				login,
				url,
				key,
				label: login || url || externalId
			}

			unique.set(key.toLowerCase(), option)
		}

		return [...unique.values()].sort((a, b) => a.label.localeCompare(b.label))
	}

	private organizationMatches(
		organization: SupervisorOrganizationOptionResponseDto,
		value: string
	) {
		const normalized = value.trim().toLowerCase()

		return [
			organization.key,
			organization.login,
			organization.url,
			organization.externalId
		]
			.filter(Boolean)
			.some(candidate => candidate.toLowerCase() === normalized)
	}

	private async semestersForScope(scope: RatingScope) {
		if (scope.organizationIds.length === 0) return []

		const responses = await Promise.all(
			scope.organizationIds.map(organizationId =>
				this.analyticsClient.call("listSemesters", {
					organizationId,
					repositoryId: "",
					limit: 100
				})
			)
		)

		return this.mergeSemesters(
			responses.flatMap(response => response?.semesters ?? [])
		)
	}

	private mergeSemesters(semesters: AnalyticsSemester[]) {
		const unique = new Map<string, SemesterOptionResponseDto>()

		for (const semester of semesters) {
			const normalized = this.normalizeSemesterOption(semester)

			if (!normalized) continue

			unique.set(`${normalized.semester}:${normalized.year}`, normalized)
		}

		return [...unique.values()].sort((a, b) =>
			b.dateFrom.localeCompare(a.dateFrom)
		)
	}

	private normalizeSemesterOption(
		option: AnalyticsSemester
	): SemesterOptionResponseDto | null {
		const semester = this.semester(option.semester)
		const year = Number(option.year)
		const dateFrom = option.dateFrom?.trim()
		const dateTo = option.dateTo?.trim()

		if (
			!semester ||
			!Number.isInteger(year) ||
			!dateFrom ||
			!dateTo ||
			Number.isNaN(new Date(dateFrom).getTime()) ||
			Number.isNaN(new Date(dateTo).getTime())
		) {
			return null
		}

		return {
			semester,
			year,
			label: option.label?.trim() || this.semesterLabel(semester, year),
			dateFrom,
			dateTo
		}
	}

	private async repositoryRatingsForScope(input: {
		scope: RatingScope
		bucket: string
		limit: number
		weights: ScoreWeight[]
	}) {
		const responses = await Promise.all(
			input.scope.organizationIds.map(organizationId =>
				this.analyticsClient.call("getRepositoryRatings", {
					organizationId,
					period: RatingPeriod.RATING_PERIOD_DAILY,
					bucket: input.bucket,
					limit: input.limit,
					weights: input.weights
				})
			)
		)

		return this.mergeRatings(
			responses.flatMap(response => response?.ratings ?? []),
			responses.find(Boolean)?.bucket ?? input.bucket
		)
	}

	private async currentUserRepositoryIds(input: {
		scope: RatingScope
		repositoryIds: string[]
		bucket: string
		weights: ScoreWeight[]
	}) {
		const responses = await Promise.all(
			input.repositoryIds.map(async repositoryId => {
				const response = await this.analyticsClient.call("getUserRatings", {
					organizationId: "",
					repositoryId,
					period: RatingPeriod.RATING_PERIOD_DAILY,
					bucket: input.bucket,
					limit: 100,
					weights: input.weights
				})

				if (
					this.currentUserRatings(response?.ratings ?? [], input.scope)
						.length === 0
				) {
					return null
				}

				return repositoryId
			})
		)

		return new Set(responses.filter((id): id is string => Boolean(id)))
	}

	private currentUserRatings<T extends UserRating>(
		ratings: T[],
		scope: RatingScope
	) {
		return ratings.filter(rating => {
			if (rating.contributorId === scope.accountId) return true

			return !!scope.accountId && rating.contributorId === scope.accountId
		})
	}

	private subjectType(
		value: string | undefined,
		required: true
	): RatingSubjectType
	private subjectType(
		value: string | undefined,
		required: false
	): RatingSubjectType
	private subjectType(value: string | undefined, required: boolean) {
		const normalized = value?.trim().toUpperCase()

		if (!normalized && !required) {
			return RatingSubjectType.RATING_SUBJECT_TYPE_UNSPECIFIED
		}

		if (normalized === "USER" || normalized === "RATING_SUBJECT_TYPE_USER") {
			return RatingSubjectType.RATING_SUBJECT_TYPE_USER
		}

		if (
			normalized === "REPOSITORY" ||
			normalized === "RATING_SUBJECT_TYPE_REPOSITORY"
		) {
			return RatingSubjectType.RATING_SUBJECT_TYPE_REPOSITORY
		}

		throw new BadRequestException("subjectType must be USER or REPOSITORY")
	}

	private profileStatus(value: string | undefined) {
		const normalized = value?.trim().toUpperCase()

		if (
			normalized === "ARCHIVED" ||
			normalized === "SCORING_PROFILE_STATUS_ARCHIVED"
		) {
			return ScoringProfileStatus.SCORING_PROFILE_STATUS_ARCHIVED
		}

		return ScoringProfileStatus.SCORING_PROFILE_STATUS_ACTIVE
	}

	private limit(value: string | undefined) {
		if (!value) return 100

		const parsed = Number(value)

		if (!Number.isInteger(parsed) || parsed < 1) {
			throw new BadRequestException("limit must be a positive integer")
		}

		return Math.min(parsed, 100)
	}

	private async semesterBucket(scope: RatingScope, query: RatingsQueryDto) {
		const range = await this.selectedSemesterRange(scope, query)
		const requestedFrom = this.optionalDate(query.dateFrom)
		const requestedTo = this.optionalDate(query.dateTo)
		const from = requestedFrom ?? range.from
		const toExclusive = requestedTo
			? this.addDays(requestedTo, 1)
			: range.toExclusive

		this.validateDateInsideSemester(from, range, "dateFrom")
		this.validateDateInsideSemester(
			this.addDays(toExclusive, -1),
			range,
			"dateTo"
		)

		if (from >= toExclusive) {
			throw new BadRequestException("dateFrom must be before dateTo")
		}

		return this.serializeSemesterRange({ ...range, from, toExclusive })
	}

	private async selectedSemesterRange(
		scope: RatingScope,
		query: RatingsQueryDto
	): Promise<SemesterRange> {
		const requestedSemester = this.semester(query.semester ?? query.season)
		const requestedYear = this.semesterYear(query.year ?? query.semesterYear)
		const semesters = await this.semestersForScope(scope)

		if (requestedSemester || requestedYear) {
			if (!requestedSemester || !requestedYear) {
				throw new BadRequestException(
					"semester and year must be provided together"
				)
			}

			const option = semesters.find(
				semester =>
					semester.semester === requestedSemester &&
					semester.year === requestedYear
			)

			if (!option) {
				throw new BadRequestException(
					"Selected semester is not available for requested scope"
				)
			}

			return this.semesterRange(option)
		}

		const latest = semesters[0]

		if (!latest) {
			throw new BadRequestException(
				"No semesters are available for requested scope"
			)
		}

		return this.semesterRange(latest)
	}

	private semester(value: string | undefined): Semester | null {
		const normalized = value?.trim()

		if (!normalized) return null
		if (normalized === "autumn" || normalized === "spring") {
			return normalized
		}
		if (normalized === "autumn-winter") return "autumn"
		if (normalized === "spring-summer") return "spring"

		throw new BadRequestException("semester must be autumn or spring")
	}

	private semesterYear(value: string | undefined) {
		const normalized = value?.trim()

		if (!normalized) return null

		const year = Number(normalized)

		if (!Number.isInteger(year) || year < 2000 || year > 2100) {
			throw new BadRequestException("year must be a valid semester year")
		}

		return year
	}

	private semesterRange(option: SemesterOptionResponseDto): SemesterRange {
		const from = this.requiredDate(option.dateFrom, "dateFrom")
		const toInclusive = this.requiredDate(option.dateTo, "dateTo")

		return {
			semester: option.semester,
			year: option.year,
			label: option.label,
			from,
			toExclusive: this.addDays(toInclusive, 1)
		}
	}

	private serializeSemesterRange(range: SemesterRange) {
		return JSON.stringify({
			kind: "range",
			semester: range.semester,
			year: range.year,
			semesterYear: range.year,
			dateFrom: range.from.toISOString(),
			dateTo: range.toExclusive.toISOString()
		})
	}

	private validateDateInsideSemester(
		date: Date,
		range: SemesterRange,
		field: string
	) {
		if (date < range.from || date >= range.toExclusive) {
			throw new BadRequestException(`${field} must be inside selected semester`)
		}
	}

	private semesterLabel(semester: Semester, year: number) {
		return `${semester === "autumn" ? "Осенний" : "Весенний"} ${year}`
	}

	private optionalDate(value: string | undefined) {
		const trimmed = value?.trim()

		if (!trimmed) return null

		const date = new Date(trimmed)

		if (Number.isNaN(date.getTime())) {
			throw new BadRequestException("Dates must be ISO date strings")
		}

		return date
	}

	private requiredDate(value: string, field: string) {
		const date = new Date(value)

		if (Number.isNaN(date.getTime())) {
			throw new BadRequestException(`${field} must be an ISO date string`)
		}

		return date
	}

	private addDays(date: Date, days: number) {
		const next = new Date(date)
		next.setUTCDate(next.getUTCDate() + days)

		return next
	}

	private mergeRatings<
		T extends {
			score: number
			rank: number
			repositoryId?: string
			contributorId?: string
		}
	>(ratings: T[], bucket: string) {
		const uniqueRatings = new Map<string, T>()

		for (const rating of ratings) {
			const key = this.ratingKey(rating)
			const current = uniqueRatings.get(key)

			if (!current || rating.score > current.score) {
				uniqueRatings.set(key, rating)
			}
		}

		return {
			bucket,
			ratings: [...uniqueRatings.values()]
				.sort((a, b) => b.score - a.score)
				.map((rating, index) => ({ ...rating, rank: index + 1 }))
		}
	}

	private ratingKey(rating: { repositoryId?: string; contributorId?: string }) {
		return [rating.repositoryId ?? "", rating.contributorId ?? ""].join(":")
	}

	private weights(value: string | undefined): ScoreWeight[] {
		if (!value) return []

		return value
			.split(",")
			.map(item => {
				const [metric, rawWeight] = item.split(":")
				const weight = Number(rawWeight)

				if (!metric || !Number.isFinite(weight)) return null

				return { metric: metric.trim(), weight }
			})
			.filter((weight): weight is ScoreWeight => Boolean(weight?.metric))
	}

	private weightArray(value: ScoreWeight[] | undefined): ScoreWeight[] {
		return (value ?? [])
			.map(weight => ({
				metric: weight.metric?.trim(),
				weight: Number(weight.weight)
			}))
			.filter(
				(weight): weight is ScoreWeight =>
					Boolean(weight.metric) && Number.isFinite(weight.weight)
			)
	}

	private userRatingsResponse<T extends UserRating>(response: {
		bucket: string
		ratings: T[]
	}) {
		return {
			bucket: response.bucket,
			ratings: response.ratings.map(rating => ({
				contributorId: rating.contributorId,
				contributorLogin: rating.contributorLogin,
				eventsTotal: this.longNumber(rating.eventsTotal),
				score: Number(rating.score ?? 0),
				rank: Number(rating.rank ?? 0),
				scoreComponents: rating.scoreComponents ?? [],
				activityScore: Number(rating.activityScore ?? 0),
				productivityScore: Number(rating.productivityScore ?? 0),
				communicationScore: Number(rating.communicationScore ?? 0),
				qualityScore: Number(rating.qualityScore ?? 0),
				flowScore: Number(rating.flowScore ?? 0),
				repositoryHealthScore: Number(rating.repositoryHealthScore ?? 0)
			}))
		}
	}

	private repositoryRatingsResponse<T extends RepositoryRating>(response: {
		bucket: string
		ratings: T[]
	}) {
		return {
			bucket: response.bucket,
			ratings: response.ratings.map(rating => ({
				repositoryId: rating.repositoryId,
				repositoryName: rating.repositoryName,
				repositoryUrl: rating.repositoryUrl,
				eventsTotal: this.longNumber(rating.eventsTotal),
				activeContributorsCount: this.longNumber(
					rating.activeContributorsCount
				),
				score: Number(rating.score ?? 0),
				rank: Number(rating.rank ?? 0),
				scoreComponents: rating.scoreComponents ?? [],
				activityScore: Number(rating.activityScore ?? 0),
				productivityScore: Number(rating.productivityScore ?? 0),
				communicationScore: Number(rating.communicationScore ?? 0),
				qualityScore: Number(rating.qualityScore ?? 0),
				flowScore: Number(rating.flowScore ?? 0),
				repositoryHealthScore: Number(rating.repositoryHealthScore ?? 0)
			}))
		}
	}

	private longNumber(value: unknown) {
		if (typeof value === "number") {
			return Number.isFinite(value) ? value : 0
		}

		if (typeof value === "bigint") return Number(value)

		if (typeof value === "string") {
			const parsed = Number(value)

			return Number.isFinite(parsed) ? parsed : 0
		}

		if (value && typeof value === "object") {
			const long = value as {
				low?: unknown
				high?: unknown
				unsigned?: unknown
			}
			const low = Number(long.low ?? 0)
			const high = Number(long.high ?? 0)

			if (Number.isFinite(low) && Number.isFinite(high)) {
				const unsigned = Boolean(long.unsigned)
				const lowUnsigned = low >>> 0
				const combined = high * 4294967296 + lowUnsigned

				if (unsigned || high >= 0) return combined
			}
		}

		return 0
	}
}
