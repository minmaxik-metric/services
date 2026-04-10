import {
	RatingPeriodName,
	RatingSubjectType
} from "@/modules/ratings/rating.types"
import {
	CalculatedRating,
	MetricStats,
	ScoreComponent,
	ScoreWeightInput,
	ScoringProfile
} from "@/modules/scoring/scoring.types"

export interface PersistRatingsInput {
	subjectType: RatingSubjectType
	organizationId: string
	repositoryId: string | null
	bucket: Date
	period: RatingPeriodName
	profile: ScoringProfile
	weightOverrides: ScoreWeightInput[]
	ratings: CalculatedRating[]
	metricStats: MetricStats[]
}

export interface FindRatingsInput {
	subjectType: RatingSubjectType
	organizationId: string
	repositoryId: string | null
	bucket: Date | null
	period: RatingPeriodName
	profileId: string
	limit: number
}

export interface StoredRating extends CalculatedRating {
	id: string
	components: ScoreComponent[]
}
