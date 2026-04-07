import { Injectable } from "@nestjs/common"

import { metricMetadata } from "@/modules/metric-metadata/metric-metadata"

import { BOUNDED_RATIO_METRICS } from "./scoring.config"
import {
	CalculatedRating,
	CalculateRatingsInput,
	CalculateRatingsResult,
	MetricDefinition,
	MetricStats,
	ScoreCategory,
	ScoreComponent
} from "./scoring.types"

interface PercentileStats {
	sampleCount: number
	min: number
	p05: number
	p50: number
	p95: number
	max: number
}

const ACTIVITY_EVENT_TYPE_COUNT = 14

@Injectable()
export class ScoringService {
	public calculate(input: CalculateRatingsInput): CalculateRatingsResult {
		const statsRows = input.statsRows?.length ? input.statsRows : input.rows
		const stats = this.calculateStats(statsRows, input.metricDefinitions)
		const ratings = input.rows.map(row => {
			const components = input.metricDefinitions.map(definition => {
				const rawValue = this.numberValue(row.values[definition.metric])
				const metadata = metricMetadata(definition.metric)
				const applicable = this.isMetricApplicable(row.values, definition)
				const normalizedValue = applicable
					? this.normalize(
							rawValue,
							definition,
							stats[definition.metric],
							input.profile.optimalRanges[definition.metric]
						)
					: 0
				const weight = applicable ? this.metricWeight(definition, input) : 0

				return {
					metric: definition.metric,
					label: metadata.label,
					description: metadata.description,
					category: definition.category,
					rawValue,
					normalizedValue: this.round(normalizedValue),
					weight,
					weightedScore: this.round(normalizedValue * weight),
					direction: definition.direction
				}
			})

			const categoryScores = {
				activityScore: this.categoryScore("activity", components),
				productivityScore: this.categoryScore("productivity", components),
				communicationScore: this.categoryScore("communication", components),
				qualityScore: this.categoryScore("quality", components),
				flowScore: this.categoryScore("flow", components),
				repositoryHealthScore: this.categoryScore(
					"repository_health",
					components
				)
			}

			const confidenceScore = this.confidenceScore(row.values)
			const score = this.weightedAverage([
				[categoryScores.activityScore, this.categoryWeight("activity", input)],
				[
					categoryScores.productivityScore,
					this.categoryWeight("productivity", input)
				],
				[
					categoryScores.communicationScore,
					this.categoryWeight("communication", input)
				],
				[categoryScores.qualityScore, this.categoryWeight("quality", input)],
				[categoryScores.flowScore, this.categoryWeight("flow", input)],
				[
					categoryScores.repositoryHealthScore,
					this.categoryWeight("repository_health", input)
				]
			])

			return {
				bucket: row.bucket,
				organizationId: row.organizationId,
				repositoryId: row.repositoryId,
				subjectId: row.subjectId,
				subjectLabel: row.subjectLabel,
				metadata: row.metadata,
				rawValues: row.values,
				components,
				score: this.round(score * confidenceScore),
				rank: 0,
				confidenceScore: this.round(confidenceScore),
				sampleCount: Math.trunc(this.numberValue(row.values.events_total)),
				...categoryScores
			}
		})

		return {
			ratings: this.rank(ratings),
			metricStats: this.toMetricStats(input.metricDefinitions, stats)
		}
	}

	private calculateStats(
		rows: CalculateRatingsInput["rows"],
		definitions: MetricDefinition[]
	) {
		return definitions.reduce<Record<string, PercentileStats>>(
			(acc, definition) => {
				const values = rows
					.filter(row => this.isMetricApplicable(row.values, definition))
					.map(row => this.numberValue(row.values[definition.metric]))
					.filter(value => Number.isFinite(value))
					.sort((a, b) => a - b)

				acc[definition.metric] = {
					sampleCount: values.length,
					min: values[0] ?? 0,
					p05: this.percentile(values, 0.05),
					p50: this.percentile(values, 0.5),
					p95: this.percentile(values, 0.95),
					max: values[values.length - 1] ?? 0
				}

				return acc
			},
			{}
		)
	}

	private normalize(
		value: number,
		definition: MetricDefinition,
		stats: PercentileStats | undefined,
		profileRange: { min: number; max: number } | undefined
	) {
		if (!Number.isFinite(value) || !stats) return 0

		if (definition.metric === "event_types_covered_count") {
			return this.normalizePositive(value, 0, ACTIVITY_EVENT_TYPE_COUNT)
		}

		if (BOUNDED_RATIO_METRICS.has(definition.metric)) {
			return this.normalizeBoundedRatio(value, definition.direction)
		}

		if (definition.direction === "optimal") {
			return this.normalizeOptimal(value, definition, stats, profileRange)
		}

		const base = this.normalizePositive(value, stats.p05, stats.p95)

		if (definition.direction === "negative") return 100 - base

		return base
	}

	private normalizeOptimal(
		value: number,
		definition: MetricDefinition,
		stats: PercentileStats,
		profileRange: { min: number; max: number } | undefined
	) {
		const min = profileRange?.min ?? definition.optimalMin ?? stats.p05
		const max = profileRange?.max ?? definition.optimalMax ?? stats.p95

		if (value >= min && value <= max) return 100

		if (value < min) return this.normalizePositive(value, stats.p05, min)

		return 100 - this.normalizePositive(value, max, stats.p95)
	}

	private normalizePositive(value: number, min: number, max: number) {
		if (!Number.isFinite(min) || !Number.isFinite(max)) return 0
		if (max === min) return max <= 0 ? 0 : 50

		const normalized = ((value - min) / (max - min)) * 100

		return Math.max(0, Math.min(100, normalized))
	}

	private normalizeBoundedRatio(
		value: number,
		direction: MetricDefinition["direction"]
	) {
		const ratio = this.clamp(value, 0, 1)

		if (direction === "negative") return (1 - ratio) * 100

		return ratio * 100
	}

	private categoryScore(category: ScoreCategory, components: ScoreComponent[]) {
		const pairs = components
			.filter(component => component.category === category)
			.map(
				component =>
					[component.normalizedValue, component.weight] as [number, number]
			)

		return this.round(this.weightedAverage(pairs))
	}

	private weightedAverage(pairs: Array<[number, number]>) {
		const totalWeight = pairs.reduce((acc, [, weight]) => acc + weight, 0)

		if (totalWeight === 0) return 0

		return (
			pairs.reduce((acc, [value, weight]) => acc + value * weight, 0) /
			totalWeight
		)
	}

	private rank(ratings: CalculatedRating[]) {
		const sorted = [...ratings].sort((a, b) => {
			if (b.score !== a.score) return b.score - a.score

			return a.subjectLabel.localeCompare(b.subjectLabel)
		})

		let previousScore: number | null = null
		let previousRank = 0

		return sorted.map((rating, index) => {
			const rank = previousScore === rating.score ? previousRank : index + 1

			previousScore = rating.score
			previousRank = rank

			return { ...rating, rank }
		})
	}

	private categoryWeight(
		category: ScoreCategory,
		input: CalculateRatingsInput
	) {
		const override = input.weightOverrides.find(
			weight => weight.metric === category
		)

		if (override) return Math.max(0, override.weight)

		return input.profile.categoryWeights[category] ?? 0
	}

	private metricWeight(
		definition: MetricDefinition,
		input: CalculateRatingsInput
	) {
		const override = input.weightOverrides.find(
			weight => weight.metric === definition.metric
		)

		if (override) return Math.max(0, override.weight)

		return input.profile.metricWeights[definition.metric] ?? definition.weight
	}

	private isMetricApplicable(
		values: Record<string, number>,
		definition: MetricDefinition
	) {
		if (definition.sampleMetric) {
			return this.numberValue(values[definition.sampleMetric]) > 0
		}

		if (definition.denominatorMetric) {
			return this.numberValue(values[definition.denominatorMetric]) > 0
		}

		return definition.metric in values
	}

	private confidenceScore(values: Record<string, number>) {
		const events = this.numberValue(values.events_total)
		const activeDays = this.numberValue(values.active_days_count)
		const activityConfidence = Math.min(
			1,
			Math.log10(events + 1) / Math.log10(25)
		)
		const cadenceConfidence = Math.min(1, activeDays / 2)

		return Math.max(
			0.25,
			Math.min(1, (activityConfidence + cadenceConfidence) / 2)
		)
	}

	private toMetricStats(
		definitions: MetricDefinition[],
		stats: Record<string, PercentileStats>
	): MetricStats[] {
		return definitions.map(definition => {
			const metricStats = stats[definition.metric]

			return {
				metric: definition.metric,
				category: definition.category,
				sampleCount: metricStats.sampleCount,
				minValue: this.round(metricStats.min),
				p05Value: this.round(metricStats.p05),
				p50Value: this.round(metricStats.p50),
				p95Value: this.round(metricStats.p95),
				maxValue: this.round(metricStats.max)
			}
		})
	}

	private percentile(values: number[], quantile: number) {
		if (values.length === 0) return 0
		if (values.length === 1) return values[0]

		const index = (values.length - 1) * quantile
		const lower = Math.floor(index)
		const upper = Math.ceil(index)

		if (lower === upper) return values[lower]

		const ratio = index - lower

		return values[lower] * (1 - ratio) + values[upper] * ratio
	}

	private numberValue(value: unknown) {
		if (typeof value === "number") return Number.isFinite(value) ? value : 0
		if (typeof value === "bigint") return Number(value)
		if (value === null || value === undefined) return 0

		const parsed = Number(value)

		return Number.isFinite(parsed) ? parsed : 0
	}

	private round(value: number) {
		return Math.round(value * 10000) / 10000
	}

	private clamp(value: number, min: number, max: number) {
		return Math.max(min, Math.min(max, value))
	}
}
