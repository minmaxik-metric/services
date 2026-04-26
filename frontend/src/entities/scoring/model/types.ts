import type {
	ScoreCategory,
	ScoreWeight
} from "@/entities/rating/model/types"

export type RatingSubjectType = "USER" | "REPOSITORY"

export type MetricOptimalRange = {
	metric: string
	min: number
	max: number
}

export type ScoringProfileStatus = "ACTIVE" | "ARCHIVED"

export type ScoringProfile = {
	id: string
	name: string
	subjectType: RatingSubjectType
	algorithmVersion: string
	categoryWeights: ScoreWeight[]
	metricWeights: ScoreWeight[]
	optimalRanges: MetricOptimalRange[]
	isDefault: boolean
	status: ScoringProfileStatus
}

export const scoreCategories: ScoreCategory[] = [
	"activity",
	"productivity",
	"communication",
	"quality",
	"flow",
	"repository_health"
]
