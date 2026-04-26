export type RatingPeriod = "daily" | "weekly"

export type ScoreWeight = {
	metric: string
	weight: number
}

export type ScoreComponent = {
	metric: string
	label?: string
	description?: string
	category: ScoreCategory
	rawValue: number
	normalizedValue: number
	weight: number
	weightedScore: number
	direction: MetricDirection
}

export type ScoreCategory =
	| "activity"
	| "productivity"
	| "communication"
	| "quality"
	| "flow"
	| "repository_health"

export type MetricDirection = "positive" | "negative" | "optimal"

export type UserRating = {
	contributorId: string
	contributorLogin: string
	eventsTotal: number
	score: number
	rank: number
	scoreComponents: ScoreComponent[]
	activityScore: number
	productivityScore: number
	communicationScore: number
	qualityScore: number
	flowScore: number
	repositoryHealthScore: number
}

export type RepositoryUserRating = UserRating & {
	repositoryId: string
	repositoryName: string
	repositoryUrl?: string
}

export type RepositoryRating = {
	repositoryId: string
	repositoryName: string
	repositoryUrl?: string
	eventsTotal: number
	activeContributorsCount: number
	score: number
	rank: number
	scoreComponents: ScoreComponent[]
	activityScore: number
	productivityScore: number
	communicationScore: number
	qualityScore: number
	flowScore: number
	repositoryHealthScore: number
}

export type UserRatingsResponse = {
	bucket: string
	ratings: UserRating[]
}

export type RepositoryRatingsResponse = {
	bucket: string
	ratings: RepositoryRating[]
}
