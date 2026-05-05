import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
	return twMerge(clsx(inputs))
}

export function toFiniteNumber(
	value: number | string | bigint | null | undefined,
	fallback = 0
) {
	if (typeof value === "number") {
		return Number.isFinite(value) ? value : fallback
	}
	if (typeof value === "bigint") return Number(value)

	const parsed = Number(value ?? fallback)

	return Number.isFinite(parsed) ? parsed : fallback
}

export function formatNumber(value: number | string | null | undefined) {
	const parsed = toFiniteNumber(value)

	return new Intl.NumberFormat("ru-RU", {
		maximumFractionDigits: parsed > 10 ? 0 : 2
	}).format(parsed)
}

export function formatDurationSeconds(
	value: number | string | null | undefined
) {
	const totalSeconds = Math.max(0, Math.round(toFiniteNumber(value)))
	const hours = Math.floor(totalSeconds / 3600)
	const minutes = Math.floor((totalSeconds % 3600) / 60)
	const seconds = totalSeconds % 60

	return [
		String(hours),
		String(minutes).padStart(2, "0"),
		String(seconds).padStart(2, "0")
	].join(":")
}

export function formatMetricValue(
	metric: string,
	value: number | string | null | undefined
) {
	if (metric.endsWith("_sec")) return formatDurationSeconds(value)

	return formatNumber(value)
}

export function formatPercent(value: number | string | null | undefined) {
	const parsed = toFiniteNumber(value)

	return new Intl.NumberFormat("ru-RU", {
		style: "percent",
		maximumFractionDigits: 1
	}).format(parsed)
}

export function compactDate(value?: string) {
	if (!value) return "последний бакет"

	const date = new Date(value)

	if (Number.isNaN(date.getTime())) return value

	return new Intl.DateTimeFormat("ru-RU", {
		day: "2-digit",
		month: "short",
		year: "numeric"
	}).format(date)
}
