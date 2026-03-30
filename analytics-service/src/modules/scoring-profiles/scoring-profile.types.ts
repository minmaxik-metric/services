import { RatingSubjectType } from "@/modules/ratings/rating.types"
import { ScoreCategory, ScoringProfile } from "@/modules/scoring/scoring.types"

export type ScoringProfileStatusName = "ACTIVE" | "ARCHIVED"

export interface ScoringProfileView extends ScoringProfile {
	isDefault: boolean
	status: ScoringProfileStatusName
}

export interface UpsertScoringProfileInput {
	id: string
	name: string
	subjectType: RatingSubjectType
	algorithmVersion: string
	categoryWeights: Partial<Record<ScoreCategory, number>>
	metricWeights: Record<string, number>
	optimalRanges: Record<string, { min: number; max: number }>
	isDefault: boolean
	status: ScoringProfileStatusName
}
