import { keepPreviousData, useQuery } from "@tanstack/react-query"

import type { UserRating } from "@/entities/rating/model/types"
import { isSupervisor } from "@/entities/user/model/types"
import { useSessionStore } from "@/features/auth/model/session-store"
import {
	getRepositoryRatingsByFilters,
	getRepositoryUserRatingsByFilters
} from "@/features/ratings/api/ratings-api"
import { useRatingsFilterStore } from "@/features/ratings/model/ratings-filter-store"
import { AnomalyPanel } from "@/widgets/anomaly-panel/anomaly-panel"
import { LeaderboardTable } from "@/widgets/leaderboard-table/leaderboard-table"
import { RepositoryTable } from "@/pages/repositories/repositories-page"
import { toFiniteNumber } from "@/shared/lib/utils"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/shared/ui/card"
import { EmptyState } from "@/shared/ui/empty-state"
import { LoadingState } from "@/shared/ui/loading"

export function DashboardPage() {
	const user = useSessionStore((state) => state.user)
	const supervisor = isSupervisor(user?.role)
	const organizationId = useRatingsFilterStore((state) => state.organizationId)
	const semester = useRatingsFilterStore((state) => state.semester)
	const year = useRatingsFilterStore((state) => state.year)
	const dateFrom = useRatingsFilterStore((state) => state.dateFrom)
	const dateTo = useRatingsFilterStore((state) => state.dateTo)
	const filters = { organizationId, semester, year, dateFrom, dateTo }

	const repositoryRatingsQuery = useQuery({
		queryKey: ["ratings", "repositories", filters],
		queryFn: () => getRepositoryRatingsByFilters(filters),
		placeholderData: keepPreviousData
	})

	const repositories = repositoryRatingsQuery.data?.ratings ?? []
	const repositoryUserRatingsQuery = useQuery({
		queryKey: [
			"ratings",
			"repository-users",
			filters,
			repositoryRatingsQuery.data?.bucket,
			repositories.map((repository) => repository.repositoryId).join(",")
		],
		queryFn: () =>
			getRepositoryUserRatingsByFilters(
				filters,
				repositories,
				repositoryRatingsQuery.data?.bucket
			),
		enabled: repositories.length > 0,
		placeholderData: keepPreviousData
	})

	const allUserRatings = repositoryUserRatingsQuery.data ?? []
	const repositoryRatings = repositoryRatingsQuery.data?.ratings ?? []
	const repositoryStats = repositoryStatsById(allUserRatings)
	const ownRatings = allUserRatings.filter((rating) =>
		isCurrentUserRating(rating, user)
	)
	const visibleUserRatings = supervisor ? allUserRatings : ownRatings
	return (
		<div className="space-y-4">
			{repositoryRatingsQuery.isLoading ||
			repositoryUserRatingsQuery.isLoading ? (
				<LoadingState className="surface rounded-3xl p-6" />
			) : repositoryRatingsQuery.isError ||
			  repositoryUserRatingsQuery.isError ? (
				<EmptyState
					title="Не удалось загрузить рейтинги"
					description="Проверьте доступность analytics endpoint'ов в gateway-service."
				/>
			) : (
				<>
					<div
						className={supervisor ? "grid gap-4 xl:grid-cols-2" : "grid gap-4"}
					>
						<Card className="surface min-w-0">
							<CardHeader>
								<CardTitle>
									{supervisor ? "Студенты" : "Ваши репозитории"}
								</CardTitle>
								<CardDescription>
									{supervisor
										? "Преподаватель видит всех студентов по всем репозиториям."
										: "Студент видит репозитории, где участвовал, и свою индивидуальную оценку."}
								</CardDescription>
							</CardHeader>
							<CardContent>
								{visibleUserRatings.length ? (
									<LeaderboardTable
										type="repositoryUsers"
										items={visibleUserRatings}
										audience={supervisor ? "teacher" : "student"}
										showDetails={supervisor}
									/>
								) : (
									<EmptyState title="Нет данных по участию" />
								)}
							</CardContent>
						</Card>

						<Card className="surface min-w-0">
							<CardHeader>
								<CardTitle>Репозитории</CardTitle>
								<CardDescription>
									Откройте репозиторий для детальной информации и локального
									leaderboard.
								</CardDescription>
							</CardHeader>
							<CardContent>
								{repositoryRatings.length ? (
									<RepositoryTable
										repositories={repositoryRatings}
										statsByRepositoryId={repositoryStats}
									/>
								) : (
									<EmptyState title="Нет репозиториев в выбранном периоде" />
								)}
							</CardContent>
						</Card>
					</div>

					{supervisor ? <AnomalyPanel ratings={allUserRatings} /> : null}
				</>
			)}
		</div>
	)
}

function repositoryStatsById(
	ratings: Array<UserRating & { repositoryId?: string }>
) {
	return ratings.reduce<
		Record<
			string,
			{
				participantsCount: number
				eventsTotal: number
				contributors: Set<string>
			}
		>
	>((acc, rating) => {
		if (!rating.repositoryId) return acc

		const stats = acc[rating.repositoryId] ?? {
			participantsCount: 0,
			eventsTotal: 0,
			contributors: new Set<string>()
		}
		const contributorKey = rating.contributorId || rating.contributorLogin

		stats.eventsTotal += toFiniteNumber(rating.eventsTotal)

		if (contributorKey && !stats.contributors.has(contributorKey)) {
			stats.contributors.add(contributorKey)
			stats.participantsCount += 1
		}

		acc[rating.repositoryId] = stats

		return acc
	}, {})
}

function isCurrentUserRating(
	rating: UserRating,
	user: { id: string; username: string } | null
) {
	if (!user) return false

	return (
		rating.contributorId === user.id ||
		rating.contributorLogin?.toLowerCase() === user.username.toLowerCase()
	)
}
