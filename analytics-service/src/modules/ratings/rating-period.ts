import { RpcStatus } from "@citec-spbu/common"
import { RatingPeriod } from "@citec-spbu/contracts/gen/ts/analytics"
import { RpcException } from "@nestjs/microservices"

import { RatingPeriodName } from "./rating.types"

export interface RatingRange {
	semester?: "autumn" | "spring"
	semesterYear?: number
	season?: "autumn-winter" | "spring-summer"
	dateFrom?: Date
	dateTo?: Date
}

export function resolveRatingPeriod(
	period: RatingPeriod | string | number
): RatingPeriodName {
	if (
		period === RatingPeriod.RATING_PERIOD_DAILY ||
		period === "RATING_PERIOD_DAILY" ||
		period === "DAILY" ||
		period === 1
	) {
		return "DAILY"
	}

	if (
		period === RatingPeriod.RATING_PERIOD_WEEKLY ||
		period === "RATING_PERIOD_WEEKLY" ||
		period === "WEEKLY" ||
		period === 2
	) {
		return "WEEKLY"
	}

	throw new RpcException({
		code: RpcStatus.INVALID_ARGUMENT,
		details: "Rating period must be DAILY or WEEKLY"
	})
}

export function parseBucket(bucket: string): Date | null {
	if (!bucket) return null

	const date = new Date(bucket)

	if (Number.isNaN(date.getTime())) {
		throw new RpcException({
			code: RpcStatus.INVALID_ARGUMENT,
			details: "Bucket must be an ISO date string"
		})
	}

	return date
}

export function parseRatingRange(bucket: string): RatingRange | null {
	if (!bucket?.trim().startsWith("{")) return null

	try {
		const parsed = JSON.parse(bucket) as Partial<{
			kind: string
			semester: RatingRange["semester"]
			year: number | string
			semesterYear: number | string
			season: RatingRange["season"]
			dateFrom: string
			dateTo: string
		}>

		if (parsed.kind !== "range") return null
		const hasSemester =
			parsed.semester === "autumn" || parsed.semester === "spring"
		const hasLegacySeason =
			parsed.season === "autumn-winter" || parsed.season === "spring-summer"

		if (!hasSemester && !hasLegacySeason) {
			return null
		}

		const dateFrom = parsed.dateFrom
			? new Date(String(parsed.dateFrom))
			: null
		const dateTo = parsed.dateTo ? new Date(String(parsed.dateTo)) : null

		if (
			(dateFrom && Number.isNaN(dateFrom.getTime())) ||
			(dateTo && Number.isNaN(dateTo.getTime())) ||
			((dateFrom && !dateTo) || (!dateFrom && dateTo)) ||
			(dateFrom && dateTo && dateFrom >= dateTo)
		) {
			throw new Error("Invalid range dates")
		}

		return {
			semester: hasSemester ? parsed.semester : undefined,
			semesterYear: Number(parsed.semesterYear ?? parsed.year) || undefined,
			season: hasLegacySeason ? parsed.season : undefined,
			dateFrom: dateFrom ?? undefined,
			dateTo: dateTo ?? undefined
		}
	} catch {
		throw new RpcException({
			code: RpcStatus.INVALID_ARGUMENT,
			details: "Rating range bucket is invalid"
		})
	}
}
