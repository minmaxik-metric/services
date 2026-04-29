import { keepPreviousData, useQuery } from "@tanstack/react-query"

import { aggregateRepositoryUserRatings } from "@/entities/rating/lib/aggregate-ratings"
import { isSupervisor } from "@/entities/user/model/types"
import { useSessionStore } from "@/features/auth/model/session-store"
import {
	getRepositoryRatingsByFilters,
	getRepositoryUserRatingsByFilters
} from "@/features/ratings/api/ratings-api"
import { useRatingsFilterStore } from "@/features/ratings/model/ratings-filter-store"
import { LeaderboardTable } from "@/widgets/leaderboard-table/leaderboard-table"
import { StudentMetricsDecomposition } from "@/widgets/student-metrics-decomposition/student-metrics-decomposition"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/shared/ui/card"
import { EmptyState } from "@/shared/ui/empty-state"
import { LoadingState } from "@/shared/ui/loading"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"

export function LeaderboardPage() {
	const user = useSessionStore((state) => state.user)
	const semester = useRatingsFilterStore((state) => state.semester)
	const year = useRatingsFilterStore((state) => state.year)
	const dateFrom = useRatingsFilterStore((state) => state.dateFrom)
	const dateTo = useRatingsFilterStore((state) => state.dateTo)
	const organizationId = useRatingsFilterStore((state) => state.organizationId)
	const filters = { organizationId, semester, year, dateFrom, dateTo }
	const supervisor = isSupervisor(user?.role)

	const repositoryRatingsQuery = useQuery({
		queryKey: ["leaderboard", "repositories", filters],
		queryFn: () => getRepositoryRatingsByFilters(filters),
		placeholderData: keepPreviousData
	})

	const repositories = repositoryRatingsQuery.data?.ratings ?? []
	const repositoryUserRatingsQuery = useQuery({
		queryKey: [
			"leaderboard",
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
	const globalUserRatings = aggregateRepositoryUserRatings(allUserRatings)
	const visibleUserRatings = globalUserRatings

	return (
		<div className="space-y-4">
			{repositoryRatingsQuery.isLoading ||
			repositoryUserRatingsQuery.isLoading ? (
				<LoadingState className="surface rounded-3xl p-6" />
			) : repositoryRatingsQuery.isError ||
			  repositoryUserRatingsQuery.isError ? (
				<EmptyState
					title="Не удалось загрузить лидерборд"
					description="Проверьте доступность analytics endpoint'ов в gateway-service."
				/>
			) : (
				<Card className="surface">
					<CardHeader>
						<CardTitle>Лидерборд</CardTitle>
						<CardDescription>
							Глобальный лидерборд студентов за выбранный семестр.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{supervisor ? (
							<Tabs defaultValue="users">
								<TabsList>
									<TabsTrigger value="users">Студенты</TabsTrigger>
									<TabsTrigger value="repositories">Репозитории</TabsTrigger>
								</TabsList>
								<TabsContent value="users" className="mt-4">
									<div className="space-y-4">
										<LeaderboardTable
											type="users"
											items={visibleUserRatings}
											showDetails={supervisor}
										/>
										<StudentMetricsDecomposition
											ratings={visibleUserRatings}
											title="Глобальная декомпозиция студентов"
											description="Выберите студента, чтобы посмотреть усредненную декомпозицию его score по всем репозиториям семестра."
										/>
									</div>
								</TabsContent>
								<TabsContent value="repositories" className="mt-4">
									<LeaderboardTable
										type="repositories"
										items={repositoryRatingsQuery.data?.ratings ?? []}
										showDetails={supervisor}
									/>
								</TabsContent>
							</Tabs>
						) : visibleUserRatings.length ? (
							<LeaderboardTable
								type="users"
								items={visibleUserRatings}
								showDetails={false}
							/>
						) : (
							<EmptyState title="Нет данных по вашему участию" />
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}
