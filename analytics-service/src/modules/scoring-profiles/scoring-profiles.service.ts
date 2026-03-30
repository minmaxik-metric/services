import { Injectable, OnModuleInit } from "@nestjs/common"
import { randomUUID } from "node:crypto"

import { PrismaService } from "@/infrastructure/prisma/prisma.service"
import { RatingSubjectType } from "@/modules/ratings/rating.types"
import {
	ALGORITHM_VERSION,
	DEFAULT_SCORING_PROFILES
} from "@/modules/scoring/scoring.config"
import { ScoreCategory, ScoringProfile } from "@/modules/scoring/scoring.types"

import {
	ScoringProfileStatusName,
	ScoringProfileView,
	UpsertScoringProfileInput
} from "./scoring-profile.types"

interface DbScoringProfile {
	id: string
	name: string
	subjectType: string
	algorithmVersion: string
	categoryWeights: unknown
	metricWeights: unknown
	optimalRanges: unknown
	isDefault: boolean
	status: string
}

@Injectable()
export class ScoringProfilesService implements OnModuleInit {
	public constructor(private readonly prisma: PrismaService) {}

	public async onModuleInit() {
		await this.seedDefaultProfiles()
	}

	public async listProfiles(input: {
		subjectType: RatingSubjectType | null
		includeArchived: boolean
	}): Promise<ScoringProfileView[]> {
		const rows = await this.prisma.$queryRawUnsafe<DbScoringProfile[]>(
			`
			SELECT
				"id",
				"name",
				"subject_type" AS "subjectType",
				"algorithm_version" AS "algorithmVersion",
				"category_weights" AS "categoryWeights",
				"metric_weights" AS "metricWeights",
				"optimal_ranges" AS "optimalRanges",
				"is_default" AS "isDefault",
				"status"
			FROM "analytics"."scoring_profiles"
			WHERE ($1::TEXT IS NULL OR "subject_type" = $1)
				AND ($2::BOOLEAN = TRUE OR "status" = 'ACTIVE')
			ORDER BY "subject_type" ASC, "is_default" DESC, "name" ASC
			`,
			input.subjectType,
			input.includeArchived
		)

		return rows.map(row => this.mapRow(row))
	}

	public async getDefaultProfile(
		subjectType: RatingSubjectType
	): Promise<ScoringProfile> {
		const profile = await this.getDefaultProfileView(subjectType)

		return {
			id: profile.id,
			name: profile.name,
			subjectType: profile.subjectType,
			algorithmVersion: profile.algorithmVersion,
			categoryWeights: profile.categoryWeights,
			metricWeights: profile.metricWeights,
			optimalRanges: profile.optimalRanges
		}
	}

	public async getDefaultProfileView(
		subjectType: RatingSubjectType
	): Promise<ScoringProfileView> {
		const rows = await this.prisma.$queryRawUnsafe<DbScoringProfile[]>(
			`
			SELECT
				"id",
				"name",
				"subject_type" AS "subjectType",
				"algorithm_version" AS "algorithmVersion",
				"category_weights" AS "categoryWeights",
				"metric_weights" AS "metricWeights",
				"optimal_ranges" AS "optimalRanges",
				"is_default" AS "isDefault",
				"status"
			FROM "analytics"."scoring_profiles"
			WHERE "subject_type" = $1
				AND "is_default" = TRUE
				AND "status" = 'ACTIVE'
			ORDER BY "updated_at" DESC
			LIMIT 1
			`,
			subjectType
		)

		const row = rows[0]

		if (!row) {
			return {
				...DEFAULT_SCORING_PROFILES[subjectType],
				isDefault: true,
				status: "ACTIVE"
			}
		}

		return this.mapRow(row)
	}

	public async upsertProfile(
		input: UpsertScoringProfileInput
	): Promise<ScoringProfileView> {
		const id = input.id?.trim() || randomUUID()
		const defaults = DEFAULT_SCORING_PROFILES[input.subjectType]
		const status = input.status
		const isDefault = status === "ACTIVE" && input.isDefault

		await this.prisma.$transaction(async tx => {
			if (isDefault) {
				await tx.$executeRawUnsafe(
					`
					UPDATE "analytics"."scoring_profiles"
					SET
						"is_default" = FALSE,
						"updated_at" = CURRENT_TIMESTAMP
					WHERE "subject_type" = $1
						AND "id" <> $2
						AND "status" = 'ACTIVE'
					`,
					input.subjectType,
					id
				)
			}

			await tx.$executeRawUnsafe(
				`
				INSERT INTO "analytics"."scoring_profiles" (
					"id",
					"name",
					"subject_type",
					"algorithm_version",
					"category_weights",
					"metric_weights",
					"optimal_ranges",
					"is_default",
					"status",
					"updated_at"
				)
				VALUES (
					$1, $2, $3, $4,
					CAST($5 AS JSONB),
					CAST($6 AS JSONB),
					CAST($7 AS JSONB),
					$8,
					$9,
					CURRENT_TIMESTAMP
				)
				ON CONFLICT ("id")
				DO UPDATE SET
					"name" = EXCLUDED."name",
					"subject_type" = EXCLUDED."subject_type",
					"algorithm_version" = EXCLUDED."algorithm_version",
					"category_weights" = EXCLUDED."category_weights",
					"metric_weights" = EXCLUDED."metric_weights",
					"optimal_ranges" = EXCLUDED."optimal_ranges",
					"is_default" = EXCLUDED."is_default",
					"status" = EXCLUDED."status",
					"updated_at" = CURRENT_TIMESTAMP
				`,
				id,
				input.name?.trim() || defaults.name,
				input.subjectType,
				input.algorithmVersion?.trim() || ALGORITHM_VERSION,
				JSON.stringify({
					...defaults.categoryWeights,
					...input.categoryWeights
				}),
				JSON.stringify(input.metricWeights),
				JSON.stringify({
					...defaults.optimalRanges,
					...input.optimalRanges
				}),
				isDefault,
				status
			)
		})

		return await this.getProfileById(id)
	}

	private async getProfileById(id: string): Promise<ScoringProfileView> {
		const rows = await this.prisma.$queryRawUnsafe<DbScoringProfile[]>(
			`
			SELECT
				"id",
				"name",
				"subject_type" AS "subjectType",
				"algorithm_version" AS "algorithmVersion",
				"category_weights" AS "categoryWeights",
				"metric_weights" AS "metricWeights",
				"optimal_ranges" AS "optimalRanges",
				"is_default" AS "isDefault",
				"status"
			FROM "analytics"."scoring_profiles"
			WHERE "id" = $1
			LIMIT 1
			`,
			id
		)

		const row = rows[0]

		if (!row) throw new Error(`Scoring profile not found: ${id}`)

		return this.mapRow(row)
	}

	private async seedDefaultProfiles() {
		for (const profile of Object.values(DEFAULT_SCORING_PROFILES)) {
			await this.prisma.$executeRawUnsafe(
				`
				INSERT INTO "analytics"."scoring_profiles" (
					"id",
					"name",
					"subject_type",
					"algorithm_version",
					"category_weights",
					"metric_weights",
					"optimal_ranges",
					"is_default",
					"status",
					"updated_at"
				)
				VALUES (
					$1, $2, $3, $4,
					CAST($5 AS JSONB),
					CAST($6 AS JSONB),
					CAST($7 AS JSONB),
					NOT EXISTS (
						SELECT 1
						FROM "analytics"."scoring_profiles"
						WHERE "subject_type" = $3
							AND "is_default" = TRUE
							AND "status" = 'ACTIVE'
					),
					'ACTIVE',
					CURRENT_TIMESTAMP
				)
				ON CONFLICT ("id") DO NOTHING
				`,
				profile.id,
				profile.name,
				profile.subjectType,
				profile.algorithmVersion,
				JSON.stringify(profile.categoryWeights),
				JSON.stringify(profile.metricWeights),
				JSON.stringify(profile.optimalRanges)
			)
		}
	}

	private mapRow(row: DbScoringProfile): ScoringProfileView {
		const subjectType = row.subjectType as RatingSubjectType

		return {
			id: row.id,
			name: row.name,
			subjectType,
			algorithmVersion: row.algorithmVersion,
			categoryWeights: this.categoryWeights(
				row.categoryWeights,
				DEFAULT_SCORING_PROFILES[subjectType].categoryWeights
			),
			metricWeights: this.numberMap(row.metricWeights),
			optimalRanges: this.optimalRanges(row.optimalRanges),
			isDefault: Boolean(row.isDefault),
			status: this.status(row.status)
		}
	}

	private categoryWeights(
		value: unknown,
		defaults: Record<ScoreCategory, number>
	): Record<ScoreCategory, number> {
		return {
			...defaults,
			...this.numberMap(value)
		}
	}

	private numberMap(value: unknown) {
		if (!this.isRecord(value)) return {}

		return Object.entries(value).reduce<Record<string, number>>(
			(acc, [key, raw]) => {
				const parsed = Number(raw)

				if (Number.isFinite(parsed)) acc[key] = parsed

				return acc
			},
			{}
		)
	}

	private optimalRanges(value: unknown) {
		if (!this.isRecord(value)) return {}

		return Object.entries(value).reduce<
			Record<string, { min: number; max: number }>
		>((acc, [metric, raw]) => {
			if (!this.isRecord(raw)) return acc

			const min = Number(raw.min)
			const max = Number(raw.max)

			if (Number.isFinite(min) && Number.isFinite(max)) {
				acc[metric] = { min, max }
			}

			return acc
		}, {})
	}

	private isRecord(value: unknown): value is Record<string, unknown> {
		return typeof value === "object" && value !== null && !Array.isArray(value)
	}

	private status(value: string): ScoringProfileStatusName {
		return value === "ARCHIVED" ? "ARCHIVED" : "ACTIVE"
	}
}
