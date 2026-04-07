import { RawRatingRow } from "@/modules/metric-source/raw-rating-row"
import { RatingSubjectType } from "@/modules/ratings/rating.types"

export type ScoreCategory =
	| "activity"
	| "productivity"
	| "communication"
	| "quality"
	| "flow"
	| "repository_health"

export type ScoreDirection = "positive" | "negative" | "optimal"

export interface ScoreWeightInput {
	metric: string
	weight: number
}

export interface MetricDefinition {
	metric: string
	category: ScoreCategory
	direction: ScoreDirection
	weight: number
	sampleMetric?: string
	denominatorMetric?: string
	optimalMin?: number
	optimalMax?: number
}

export interface ScoreComponent {
	metric: string
	label: string
	description: string
	category: ScoreCategory
	rawValue: number
	normalizedValue: number
	weight: number
	weightedScore: number
	direction: ScoreDirection
}

export interface MetricStats {
	metric: string
	category: ScoreCategory
	sampleCount: number
	minValue: number
	p05Value: number
	p50Value: number
	p95Value: number
	maxValue: number
}

export interface CategoryScores {
	activityScore: number
	productivityScore: number
	communicationScore: number
	qualityScore: number
	flowScore: number
	repositoryHealthScore: number
}

export interface CalculatedRating extends CategoryScores {
	bucket: Date
	organizationId: string
	repositoryId: string
	subjectId: string
	subjectLabel: string
	metadata: Record<string, string>
	score: number
	rank: number
	confidenceScore: number
	sampleCount: number
	components: ScoreComponent[]
	rawValues: Record<string, number>
}

export interface ScoringProfile {
	id: string
	name: string
	subjectType: RatingSubjectType
	algorithmVersion: string
	categoryWeights: Record<ScoreCategory, number>
	metricWeights: Record<string, number>
	optimalRanges: Record<string, { min: number; max: number }>
}

export interface CalculateRatingsInput {
	subjectType: RatingSubjectType
	rows: RawRatingRow[]
	statsRows?: RawRatingRow[]
	metricDefinitions: MetricDefinition[]
	profile: ScoringProfile
	weightOverrides: ScoreWeightInput[]
}

export interface CalculateRatingsResult {
	ratings: CalculatedRating[]
	metricStats: MetricStats[]
}
