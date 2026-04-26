import type {
	RepositoryUserRating,
	ScoreComponent,
	UserRating
} from "@/entities/rating/model/types"
import { toFiniteNumber } from "@/shared/lib/utils"

export function aggregateRepositoryUserRatings(
	ratings: RepositoryUserRating[]
): UserRating[] {
	const grouped = ratings.reduce<Map<string, RepositoryUserRating[]>>(
		(acc, rating) => {
			const key = rating.contributorId || rating.contributorLogin
			const group = acc.get(key) ?? []

			group.push(rating)
			acc.set(key, group)

			return acc
		},
		new Map()
	)
	const aggregated = [...grouped.values()].map((group) => {
		const first = group[0]
		const average = (read: (rating: RepositoryUserRating) => number) =>
			group.reduce((sum, rating) => sum + toFiniteNumber(read(rating)), 0) /
			group.length

		return {
			contributorId: first.contributorId,
			contributorLogin: first.contributorLogin,
			eventsTotal: group.reduce(
				(sum, rating) => sum + toFiniteNumber(rating.eventsTotal),
				0
			),
			score: average((rating) => rating.score),
			rank: 0,
			scoreComponents: averageComponents(
				group.flatMap((rating) => rating.scoreComponents ?? [])
			),
			activityScore: average((rating) => rating.activityScore),
			productivityScore: average((rating) => rating.productivityScore),
			communicationScore: average((rating) => rating.communicationScore),
			qualityScore: average((rating) => rating.qualityScore),
			flowScore: average((rating) => rating.flowScore),
			repositoryHealthScore: average((rating) => rating.repositoryHealthScore)
		}
	})

	return rankByScore(aggregated)
}

export function rankByScore<T extends { score: number; rank: number }>(
	ratings: T[]
) {
	return [...ratings]
		.sort((a, b) => toFiniteNumber(b.score) - toFiniteNumber(a.score))
		.map((rating, index) => ({ ...rating, rank: index + 1 }))
}

function averageComponents(components: ScoreComponent[]) {
	const grouped = components.reduce<Map<string, ScoreComponent[]>>(
		(acc, component) => {
			const key = `${component.category}:${component.metric}`
			const group = acc.get(key) ?? []

			group.push(component)
			acc.set(key, group)

			return acc
		},
		new Map()
	)

	return [...grouped.values()].map((group) => {
		const first = group[0]
		const average = (read: (component: ScoreComponent) => number) =>
			group.reduce(
				(sum, component) => sum + toFiniteNumber(read(component)),
				0
			) / group.length

		return {
			...first,
			rawValue: average((component) => component.rawValue),
			normalizedValue: average((component) => component.normalizedValue),
			weight: average((component) => component.weight),
			weightedScore: average((component) => component.weightedScore)
		}
	})
}
