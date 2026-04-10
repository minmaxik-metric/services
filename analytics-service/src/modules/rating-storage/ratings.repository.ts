import { Injectable } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { PrismaService } from "@/infrastructure/prisma/prisma.service"
import {
	CalculatedRating,
	ScoreComponent
} from "@/modules/scoring/scoring.types"
import { metricMetadata } from "@/modules/metric-metadata/metric-metadata"

import {
	FindRatingsInput,
	PersistRatingsInput,
	StoredRating
} from "./rating-storage.types"

type RatingRow = Record<string, unknown> & { id: string }
type ComponentRow = Record<string, unknown> & { ratingId: string }
type UpsertedRatingRow = {
	id: string
	repositoryId: string
	subjectId: string
}
type PersistedRating = {
	id: string
	rating: CalculatedRating
}

const ORGANIZATION_REPOSITORY_SCOPE = "__all__"

@Injectable()
export class RatingsRepository {
	public constructor(private readonly prisma: PrismaService) {}

	public async findRatings(input: FindRatingsInput): Promise<StoredRating[]> {
		const bucket =
			input.bucket ??
			(await this.findLatestRatingBucket({
				subjectType: input.subjectType,
				organizationId: input.organizationId,
				repositoryId: input.repositoryId,
				period: input.period,
				profileId: input.profileId
			}))

		if (!bucket) return []

		const limit = this.queryLimit(input.limit)
		const ratings = await this.prisma.$queryRawUnsafe<RatingRow[]>(
			`
			SELECT
				r."id",
				r."bucket",
				r."organization_id" AS "organizationId",
				r."repository_id" AS "repositoryId",
				r."subject_id" AS "subjectId",
				COALESCE(NULLIF(u."login", ''), r."subject_label") AS "subjectLabel",
				r."score",
				r."rank",
				r."activity_score" AS "activityScore",
				r."productivity_score" AS "productivityScore",
				r."communication_score" AS "communicationScore",
				r."quality_score" AS "qualityScore",
				r."flow_score" AS "flowScore",
				r."repository_health_score" AS "repositoryHealthScore",
				r."confidence_score" AS "confidenceScore",
				r."sample_count" AS "sampleCount",
				r."raw_metrics" AS "rawValues",
				r."metadata"
			FROM "analytics"."ratings" r
			LEFT JOIN "metrics"."users" u
				ON $2 = 'USER'
				AND u."id" = r."subject_id"
			WHERE r."scoring_profile_id" = $1
				AND r."subject_type" = $2
				AND r."organization_id" = $3
				AND ($4::TEXT IS NULL OR r."repository_id" = $4)
				AND r."bucket" = $5
				AND r."period" = $6
			ORDER BY r."rank" ASC, COALESCE(NULLIF(u."login", ''), r."subject_label") ASC
			LIMIT $7
			`,
			input.profileId,
			input.subjectType,
			input.organizationId,
			input.repositoryId,
			bucket,
			input.period,
			limit
		)

		const componentMap = await this.findComponents(
			ratings.map(rating => rating.id)
		)

		return ratings.map(rating => ({
			id: rating.id,
			bucket: this.asDate(rating.bucket),
			organizationId: String(rating.organizationId),
			repositoryId: String(rating.repositoryId),
			subjectId: String(rating.subjectId),
			subjectLabel: String(rating.subjectLabel),
			metadata: this.stringMap(rating.metadata),
			rawValues: this.numberMap(rating.rawValues),
			score: this.numberValue(rating.score),
			rank: this.numberValue(rating.rank),
			activityScore: this.numberValue(rating.activityScore),
			productivityScore: this.numberValue(rating.productivityScore),
			communicationScore: this.numberValue(rating.communicationScore),
			qualityScore: this.numberValue(rating.qualityScore),
			flowScore: this.numberValue(rating.flowScore),
			repositoryHealthScore: this.numberValue(rating.repositoryHealthScore),
			confidenceScore: this.numberValue(rating.confidenceScore),
			sampleCount: this.numberValue(rating.sampleCount),
			components: componentMap.get(rating.id) ?? []
		}))
	}

	public async findLatestRatingBucket(
		input: Omit<FindRatingsInput, "bucket" | "limit">
	) {
		const rows = await this.prisma.$queryRawUnsafe<
			Array<{ bucket: Date | null }>
		>(
			`
			SELECT MAX("bucket") AS "bucket"
			FROM "analytics"."ratings"
			WHERE "scoring_profile_id" = $1
				AND "subject_type" = $2
				AND "organization_id" = $3
				AND ($4::TEXT IS NULL OR "repository_id" = $4)
				AND "period" = $5
			`,
			input.profileId,
			input.subjectType,
			input.organizationId,
			input.repositoryId,
			input.period
		)

		return rows[0]?.bucket ?? null
	}

	public async persist(input: PersistRatingsInput) {
		const scoreRunId = randomUUID()

		await this.createScoreRun(scoreRunId, input)

		try {
			await this.deleteStaleRatings(input)

			const ratings = await this.upsertRatings(scoreRunId, input)
			await this.replaceComponents(scoreRunId, input, ratings)
			await this.replaceMetricStats(scoreRunId, input)
			await this.finishScoreRun(scoreRunId, "COMPLETED", null)
		} catch (error) {
			await this.finishScoreRun(
				scoreRunId,
				"FAILED",
				error instanceof Error ? error.message : String(error)
			)

			throw error
		}
	}

	private async findComponents(ratingIds: string[]) {
		if (ratingIds.length === 0) return new Map<string, ScoreComponent[]>()

		const rows = await this.prisma.$queryRawUnsafe<ComponentRow[]>(
			`
			SELECT
				"rating_id" AS "ratingId",
				"category",
				"metric",
				"raw_value" AS "rawValue",
				"normalized_value" AS "normalizedValue",
				"weight",
				"weighted_score" AS "weightedScore",
				"direction"
			FROM "analytics"."score_components"
			WHERE "rating_id" = ANY($1::TEXT[])
			ORDER BY "category" ASC, "metric" ASC
			`,
			ratingIds
		)

		return rows.reduce<Map<string, ScoreComponent[]>>((acc, row) => {
			const components = acc.get(row.ratingId) ?? []

			components.push({
				category: String(row.category) as ScoreComponent["category"],
				metric: String(row.metric),
				label: metricMetadata(String(row.metric)).label,
				description: metricMetadata(String(row.metric)).description,
				rawValue: this.numberValue(row.rawValue),
				normalizedValue: this.numberValue(row.normalizedValue),
				weight: this.numberValue(row.weight),
				weightedScore: this.numberValue(row.weightedScore),
				direction: String(row.direction) as ScoreComponent["direction"]
			})
			acc.set(row.ratingId, components)

			return acc
		}, new Map<string, ScoreComponent[]>())
	}

	private async deleteStaleRatings(input: PersistRatingsInput) {
		const subjectIds = input.ratings.map(rating => rating.subjectId)

		if (subjectIds.length === 0) return

		await this.prisma.$executeRawUnsafe(
			`
			DELETE FROM "analytics"."ratings"
			WHERE "scoring_profile_id" = $1
				AND "subject_type" = $2
				AND "organization_id" = $3
				AND ($4::TEXT IS NULL OR "repository_id" = $4)
				AND "bucket" = $5
				AND "period" = $6
				AND NOT ("subject_id" = ANY($7::TEXT[]))
			`,
			input.profile.id,
			input.subjectType,
			input.organizationId,
			input.repositoryId,
			input.bucket,
			input.period,
			subjectIds
		)
	}

	private async createScoreRun(id: string, input: PersistRatingsInput) {
		await this.prisma.$executeRawUnsafe(
			`
			INSERT INTO "analytics"."score_runs" (
				"id",
				"subject_type",
				"organization_id",
				"repository_id",
				"bucket",
				"period",
				"scoring_profile_id",
				"algorithm_version",
				"weights",
				"status"
			)
			VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CAST($9 AS JSONB), 'RUNNING')
			`,
			id,
			input.subjectType,
			input.organizationId,
			input.repositoryId,
			input.bucket,
			input.period,
			input.profile.id,
			input.profile.algorithmVersion,
			JSON.stringify({
				categoryWeights: input.profile.categoryWeights,
				metricWeights: input.profile.metricWeights,
				overrides: input.weightOverrides
			})
		)
	}

	private async upsertRatings(
		scoreRunId: string,
		input: PersistRatingsInput
	): Promise<PersistedRating[]> {
		if (input.ratings.length === 0) return []

		const payload = input.ratings.map(rating => ({
			id: randomUUID(),
			organization_id: rating.organizationId,
			repository_id: rating.repositoryId,
			subject_id: rating.subjectId,
			subject_label: rating.subjectLabel,
			bucket: rating.bucket.toISOString(),
			score: rating.score,
			rank: rating.rank,
			activity_score: rating.activityScore,
			productivity_score: rating.productivityScore,
			communication_score: rating.communicationScore,
			quality_score: rating.qualityScore,
			flow_score: rating.flowScore,
			repository_health_score: rating.repositoryHealthScore,
			confidence_score: rating.confidenceScore,
			sample_count: rating.sampleCount,
			raw_metrics: rating.rawValues,
			metadata: rating.metadata
		}))

		const rows = await this.prisma.$queryRawUnsafe<UpsertedRatingRow[]>(
			`
			WITH payload AS (
				SELECT *
				FROM jsonb_to_recordset(CAST($1 AS JSONB)) AS item (
					"id" TEXT,
					"organization_id" TEXT,
					"repository_id" TEXT,
					"subject_id" TEXT,
					"subject_label" TEXT,
					"bucket" TIMESTAMPTZ,
					"score" NUMERIC,
					"rank" INTEGER,
					"activity_score" NUMERIC,
					"productivity_score" NUMERIC,
					"communication_score" NUMERIC,
					"quality_score" NUMERIC,
					"flow_score" NUMERIC,
					"repository_health_score" NUMERIC,
					"confidence_score" NUMERIC,
					"sample_count" INTEGER,
					"raw_metrics" JSONB,
					"metadata" JSONB
				)
			),
			upserted AS (
			INSERT INTO "analytics"."ratings" (
				"id",
				"score_run_id",
				"scoring_profile_id",
				"subject_type",
				"organization_id",
				"repository_id",
				"subject_id",
				"subject_label",
				"bucket",
				"period",
				"score",
				"rank",
				"activity_score",
				"productivity_score",
				"communication_score",
				"quality_score",
				"flow_score",
				"repository_health_score",
				"confidence_score",
				"sample_count",
				"raw_metrics",
				"metadata",
				"updated_at"
			)
			SELECT
				"id",
				$2,
				$3,
				$4,
				"organization_id",
				"repository_id",
				"subject_id",
				"subject_label",
				"bucket",
				$5,
				"score",
				"rank",
				"activity_score",
				"productivity_score",
				"communication_score",
				"quality_score",
				"flow_score",
				"repository_health_score",
				"confidence_score",
				"sample_count",
				"raw_metrics",
				"metadata",
				CURRENT_TIMESTAMP
			FROM payload
			ON CONFLICT (
				"scoring_profile_id",
				"subject_type",
				"organization_id",
				"repository_id",
				"subject_id",
				"bucket",
				"period"
			)
			DO UPDATE SET
				"score_run_id" = EXCLUDED."score_run_id",
				"subject_label" = EXCLUDED."subject_label",
				"score" = EXCLUDED."score",
				"rank" = EXCLUDED."rank",
				"activity_score" = EXCLUDED."activity_score",
				"productivity_score" = EXCLUDED."productivity_score",
				"communication_score" = EXCLUDED."communication_score",
				"quality_score" = EXCLUDED."quality_score",
				"flow_score" = EXCLUDED."flow_score",
				"repository_health_score" = EXCLUDED."repository_health_score",
				"confidence_score" = EXCLUDED."confidence_score",
				"sample_count" = EXCLUDED."sample_count",
				"raw_metrics" = EXCLUDED."raw_metrics",
				"metadata" = EXCLUDED."metadata",
				"updated_at" = CURRENT_TIMESTAMP
			RETURNING
				"id",
				"repository_id" AS "repositoryId",
				"subject_id" AS "subjectId"
			)
			SELECT "id", "repositoryId", "subjectId"
			FROM upserted
			`,
			JSON.stringify(payload),
			scoreRunId,
			input.profile.id,
			input.subjectType,
			input.period
		)

		const idByRatingKey = rows.reduce<Map<string, string>>((acc, row) => {
			acc.set(this.ratingKey(row.repositoryId, row.subjectId), row.id)

			return acc
		}, new Map<string, string>())

		return input.ratings.map(rating => {
			const id = idByRatingKey.get(
				this.ratingKey(rating.repositoryId, rating.subjectId)
			)

			if (!id) {
				throw new Error(`Rating id was not returned for ${rating.subjectId}`)
			}

			return { id, rating }
		})
	}

	private async replaceComponents(
		scoreRunId: string,
		input: PersistRatingsInput,
		ratings: PersistedRating[]
	) {
		const ratingIds = ratings.map(rating => rating.id)
		if (ratingIds.length === 0) return

		await this.prisma.$executeRawUnsafe(
			`DELETE FROM "analytics"."score_components" WHERE "rating_id" = ANY($1::TEXT[])`,
			ratingIds
		)

		const payload = ratings.flatMap(({ id: ratingId, rating }) =>
			rating.components.map(component => ({
				id: randomUUID(),
				rating_id: ratingId,
				organization_id: rating.organizationId,
				repository_id: rating.repositoryId,
				subject_id: rating.subjectId,
				bucket: rating.bucket.toISOString(),
				category: component.category,
				metric: component.metric,
				raw_value: component.rawValue,
				normalized_value: component.normalizedValue,
				weight: component.weight,
				weighted_score: component.weightedScore,
				direction: component.direction
			}))
		)

		if (payload.length === 0) return

		await this.prisma.$executeRawUnsafe(
			`
			INSERT INTO "analytics"."score_components" (
				"id",
				"rating_id",
				"score_run_id",
				"subject_type",
				"organization_id",
				"repository_id",
				"subject_id",
				"bucket",
				"period",
				"category",
				"metric",
				"raw_value",
				"normalized_value",
				"weight",
				"weighted_score",
				"direction"
			)
			SELECT
				"id",
				"rating_id",
				$2,
				$3,
				"organization_id",
				"repository_id",
				"subject_id",
				"bucket",
				$4,
				"category",
				"metric",
				"raw_value",
				"normalized_value",
				"weight",
				"weighted_score",
				"direction"
			FROM jsonb_to_recordset(CAST($1 AS JSONB)) AS item (
				"id" TEXT,
				"rating_id" TEXT,
				"organization_id" TEXT,
				"repository_id" TEXT,
				"subject_id" TEXT,
				"bucket" TIMESTAMPTZ,
				"category" TEXT,
				"metric" TEXT,
				"raw_value" DOUBLE PRECISION,
				"normalized_value" DOUBLE PRECISION,
				"weight" DOUBLE PRECISION,
				"weighted_score" DOUBLE PRECISION,
				"direction" TEXT
			)
			`,
			JSON.stringify(payload),
			scoreRunId,
			input.subjectType,
			input.period
		)
	}

	private async replaceMetricStats(
		scoreRunId: string,
		input: PersistRatingsInput
	) {
		const repositoryId = input.repositoryId ?? ORGANIZATION_REPOSITORY_SCOPE
		const metrics = input.metricStats.map(stats => stats.metric)

		await this.prisma.$executeRawUnsafe(
			`
			DELETE FROM "analytics"."metric_stats"
			WHERE "scoring_profile_id" = $1
				AND "subject_type" = $2
				AND "organization_id" = $3
				AND "repository_id" = $4
				AND "bucket" = $5
				AND "period" = $6
				AND (
					cardinality($7::TEXT[]) = 0
					OR NOT ("metric" = ANY($7::TEXT[]))
				)
			`,
			input.profile.id,
			input.subjectType,
			input.organizationId,
			repositoryId,
			input.bucket,
			input.period,
			metrics
		)

		if (input.metricStats.length === 0) return

		const payload = input.metricStats.map(stats => ({
			id: randomUUID(),
			category: stats.category,
			metric: stats.metric,
			sample_count: stats.sampleCount,
			min_value: stats.minValue,
			p05_value: stats.p05Value,
			p50_value: stats.p50Value,
			p95_value: stats.p95Value,
			max_value: stats.maxValue
		}))

		await this.prisma.$executeRawUnsafe(
			`
			INSERT INTO "analytics"."metric_stats" (
				"id",
				"score_run_id",
				"scoring_profile_id",
				"subject_type",
				"organization_id",
				"repository_id",
				"bucket",
				"period",
				"category",
				"metric",
				"sample_count",
				"min_value",
				"p05_value",
				"p50_value",
				"p95_value",
				"max_value"
			)
			SELECT
				"id",
				$2,
				$3,
				$4,
				$5,
				$6,
				$7,
				$8,
				"category",
				"metric",
				"sample_count",
				"min_value",
				"p05_value",
				"p50_value",
				"p95_value",
				"max_value"
			FROM jsonb_to_recordset(CAST($1 AS JSONB)) AS item (
				"id" TEXT,
				"category" TEXT,
				"metric" TEXT,
				"sample_count" INTEGER,
				"min_value" DOUBLE PRECISION,
				"p05_value" DOUBLE PRECISION,
				"p50_value" DOUBLE PRECISION,
				"p95_value" DOUBLE PRECISION,
				"max_value" DOUBLE PRECISION
			)
			ON CONFLICT (
				"scoring_profile_id",
				"subject_type",
				"organization_id",
				"repository_id",
				"bucket",
				"period",
				"metric"
			)
			DO UPDATE SET
				"score_run_id" = EXCLUDED."score_run_id",
				"category" = EXCLUDED."category",
				"sample_count" = EXCLUDED."sample_count",
				"min_value" = EXCLUDED."min_value",
				"p05_value" = EXCLUDED."p05_value",
				"p50_value" = EXCLUDED."p50_value",
				"p95_value" = EXCLUDED."p95_value",
				"max_value" = EXCLUDED."max_value"
			`,
			JSON.stringify(payload),
			scoreRunId,
			input.profile.id,
			input.subjectType,
			input.organizationId,
			repositoryId,
			input.bucket,
			input.period
		)
	}

	private async finishScoreRun(
		id: string,
		status: "COMPLETED" | "FAILED",
		error: string | null
	) {
		await this.prisma.$executeRawUnsafe(
			`
			UPDATE "analytics"."score_runs"
			SET
				"status" = $2,
				"finished_at" = CURRENT_TIMESTAMP,
				"error" = $3
			WHERE "id" = $1
			`,
			id,
			status,
			error
		)
	}

	private queryLimit(limit: number) {
		if (!limit || limit <= 0) return 100

		return Math.min(limit, 100)
	}

	private ratingKey(repositoryId: string, subjectId: string) {
		return `${repositoryId}:${subjectId}`
	}

	private asDate(value: unknown) {
		if (value instanceof Date) return value

		return new Date(String(value))
	}

	private stringMap(value: unknown) {
		if (!this.isRecord(value)) return {}

		return Object.entries(value).reduce<Record<string, string>>(
			(acc, [key, raw]) => {
				acc[key] = String(raw ?? "")

				return acc
			},
			{}
		)
	}

	private numberMap(value: unknown) {
		if (!this.isRecord(value)) return {}

		return Object.entries(value).reduce<Record<string, number>>(
			(acc, [key, raw]) => {
				acc[key] = this.numberValue(raw)

				return acc
			},
			{}
		)
	}

	private numberValue(value: unknown) {
		if (typeof value === "number") return Number.isFinite(value) ? value : 0
		if (typeof value === "bigint") return Number(value)
		if (value === null || value === undefined) return 0

		const parsed = Number(value)

		return Number.isFinite(parsed) ? parsed : 0
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null && !Array.isArray(value)
	}
}
