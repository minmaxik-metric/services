import type { ScoreWeight } from "@citec-spbu/contracts/gen/ts/analytics"

export type ScoringProfileBodyDto = {
	id?: string
	name?: string
	subjectType?: string
	algorithmVersion?: string
	categoryWeights?: ScoreWeight[]
	metricWeights?: ScoreWeight[]
	optimalRanges?: Array<{ metric: string; min: number; max: number }>
	isDefault?: boolean
	status?: string
}
