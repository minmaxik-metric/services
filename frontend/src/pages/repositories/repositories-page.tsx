import { Link } from "@tanstack/react-router"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { ExternalLink, GitBranch } from "lucide-react"

import type {
	RepositoryRating,
	RepositoryUserRating,
	UserRating
} from "@/entities/rating/model/types"
import { isSupervisor } from "@/entities/user/model/types"
import { useSessionStore } from "@/features/auth/model/session-store"
import {
	getRepositoryRatingsByFilters,
	getRepositoryUserRatingsByFilters,
	getUserRatings
} from "@/features/ratings/api/ratings-api"
import { useRatingsFilterStore } from "@/features/ratings/model/ratings-filter-store"
import { LeaderboardTable } from "@/widgets/leaderboard-table/leaderboard-table"
import { ScoreSummary } from "@/widgets/metric-cards/score-summary"
import { MetricsDetail } from "@/widgets/metrics-detail/metrics-detail"
import { StudentMetricsDecomposition } from "@/widgets/student-metrics-decomposition/student-metrics-decomposition"
import { formatNumber, toFiniteNumber } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/shared/ui/card"
import { EmptyState } from "@/shared/ui/empty-state"
import { LoadingState } from "@/shared/ui/loading"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/shared/ui/table"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/shared/ui/tabs"

export function RepositoriesPage() {
	const filters = useRepositoryFilters()
	const repositoryRatingsQuery = useQuery({
		queryKey: ["repositories-page", "repositories", filters],
		queryFn: () => getRepositoryRatingsByFilters(filters),
		placeholderData: keepPreviousData
	})
	const repositories = repositoryRatingsQuery.data?.ratings ?? []
	const repositoryUserRatingsQuery = useQuery({
		queryKey: [
			"repositories-page",
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
	const repositoryStats = repositoryStatsById(
		repositoryUserRatingsQuery.data ?? []
	)

	return (
		<div className="space-y-4">
			{repositoryRatingsQuery.isLoading ||
			repositoryUserRatingsQuery.isLoading ? (
				<LoadingState className="surface rounded-3xl p-6" />
			) : repositoryRatingsQuery.isError ||
			  repositoryUserRatingsQuery.isError ? (
				<EmptyState
					title="Не удалось загрузить репозитории"
					description="Проверьте analytics endpoint'ы и выбранный семестр."
				/>
			) : (
				<Card className="surface">
					<CardHeader>
						<CardTitle>Репозитории</CardTitle>
						<CardDescription>
							Откройте репозиторий, чтобы увидеть локальный leaderboard и
							детализацию участников.
						</CardDescription>
					</CardHeader>
					<CardContent>
						{repositories.length ? (
							<RepositoryTable
								repositories={repositories}
								statsByRepositoryId={repositoryStats}
							/>
						) : (
							<EmptyState title="Нет репозиториев в выбранном семестре" />
						)}
					</CardContent>
				</Card>
			)}
		</div>
	)
}

export function RepositoryDetailPage({
	repositoryId
}: {
	repositoryId: string
}) {
	const filters = useRepositoryFilters()
	const user = useSessionStore((state) => state.user)
	const supervisor = isSupervisor(user?.role)
	const repositoryRatingsQuery = useQuery({
		queryKey: ["repository-detail", "repositories", filters],
		queryFn: () => getRepositoryRatingsByFilters(filters),
		placeholderData: keepPreviousData
	})
	const repository = repositoryRatingsQuery.data?.ratings.find(
		(item) => item.repositoryId === repositoryId
	)
	const usersQuery = useQuery({
		queryKey: ["repository-detail", "users", filters, repositoryId],
		queryFn: () =>
			getUserRatings({
				...filters,
				repositoryId,
				limit: 100
			}),
		placeholderData: keepPreviousData
	})
	const participants = usersQuery.data?.ratings ?? []
	const participantEvents = participants.reduce(
		(sum, rating) => sum + toFiniteNumber(rating.eventsTotal),
		0
	)
	const participantsCount = participants.length
	const eventsPerParticipant =
		participantsCount > 0 ? participantEvents / participantsCount : 0

	if (repositoryRatingsQuery.isLoading || usersQuery.isLoading) {
		return <LoadingState className="surface rounded-3xl p-6" />
	}

	if (repositoryRatingsQuery.isError || usersQuery.isError) {
		return (
			<EmptyState
				title="Не удалось загрузить репозиторий"
				description="Проверьте выбранный семестр и доступность analytics-service."
			/>
		)
	}

	if (!repository) {
		return <EmptyState title="Репозиторий не найден в выбранном семестре" />
	}

	return (
		<div className="space-y-4">
			<Card className="surface">
				<CardHeader className="gap-4 md:flex md:flex-row md:items-start md:justify-between">
					<div className="min-w-0">
						<CardTitle className="flex items-center gap-2">
							<GitBranch className="size-5" />
							<span className="truncate">{repository.repositoryName}</span>
						</CardTitle>
						<CardDescription>
							Детальная информация по репозиторию и участникам за выбранный
							семестр.
						</CardDescription>
					</div>
					<div className="flex flex-wrap gap-2">
						<Badge variant="soft">Ранг #{repository.rank}</Badge>
						{repository.repositoryUrl ? (
							<a
								href={repository.repositoryUrl}
								target="_blank"
								rel="noreferrer"
							>
								<Button variant="outline">
									GitHub
									<ExternalLink className="size-4" />
								</Button>
							</a>
						) : null}
					</div>
				</CardHeader>
				<CardContent className="grid gap-3 md:grid-cols-4">
					<RepositoryStat label="Score" value={repository.score} />
					<RepositoryStat
						label="События участников"
						value={participantEvents}
					/>
					<RepositoryStat label="Участники" value={participantsCount} />
					<RepositoryStat
						label="Events / участник"
						value={eventsPerParticipant}
					/>
				</CardContent>
			</Card>

			<ScoreSummary
				rating={repository}
				mode={supervisor ? "teacher" : "student"}
			/>

			<Card className="surface">
				<CardHeader>
					<CardTitle>Локальный лидерборд</CardTitle>
					<CardDescription>
						Рейтинг студентов только внутри этого репозитория.
					</CardDescription>
				</CardHeader>
				<CardContent>
					{participants.length ? (
						<LeaderboardTable
							type="users"
							items={participants}
							showDetails={supervisor}
						/>
					) : (
						<EmptyState title="Нет участников в выбранном семестре" />
					)}
				</CardContent>
			</Card>

			{supervisor ? (
				<RepositoryMetricsTabs
					repository={repository}
					participants={participants}
				/>
			) : null}
		</div>
	)
}

function RepositoryMetricsTabs({
	repository,
	participants
}: {
	repository: RepositoryRating
	participants: UserRating[]
}) {
	return (
		<Tabs defaultValue="students" className="space-y-0">
			<Card className="surface">
				<CardHeader className="gap-4 lg:flex lg:flex-row lg:items-start lg:justify-between">
					<div>
						<CardTitle>Детализация метрик</CardTitle>
						<CardDescription>
							Переключайте вид между метриками студентов и общими метриками
							репозитория.
						</CardDescription>
					</div>
					<TabsList className="h-auto w-full flex-wrap justify-start sm:w-fit">
						<TabsTrigger value="students">Студенческие метрики</TabsTrigger>
						<TabsTrigger value="repository">Метрики репозитория</TabsTrigger>
					</TabsList>
				</CardHeader>
				<CardContent className="min-w-0 overflow-visible">
					<TabsContent value="students" className="mt-0">
						{participants.length ? (
							<StudentMetricsDecomposition ratings={participants} embedded />
						) : (
							<EmptyState title="Нет студенческих метрик" />
						)}
					</TabsContent>
					<TabsContent value="repository" className="mt-0">
						{repository.scoreComponents?.length ? (
							<MetricsDetail components={repository.scoreComponents} />
						) : (
							<EmptyState title="Нет общих метрик репозитория" />
						)}
					</TabsContent>
				</CardContent>
			</Card>
		</Tabs>
	)
}

export function RepositoryTable({
	repositories,
	statsByRepositoryId
}: {
	repositories: RepositoryRating[]
	statsByRepositoryId?: Record<
		string,
		{ participantsCount: number; eventsTotal: number }
	>
}) {
	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead>Репозиторий</TableHead>
					<TableHead className="text-right">Score</TableHead>
					<TableHead className="hidden md:table-cell">Участники</TableHead>
					<TableHead className="hidden lg:table-cell">События</TableHead>
					<TableHead className="w-28 text-right" />
				</TableRow>
			</TableHeader>
			<TableBody>
				{repositories.map((repository) => {
					const stats = statsByRepositoryId?.[repository.repositoryId]

					return (
						<TableRow key={repository.repositoryId}>
							<TableCell>
								<div className="min-w-48 font-medium">
									{repository.repositoryName}
								</div>
								{repository.repositoryUrl ? (
									<a
										href={repository.repositoryUrl}
										target="_blank"
										rel="noreferrer"
										className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
									>
										GitHub
										<ExternalLink className="size-3" />
									</a>
								) : null}
							</TableCell>
							<TableCell className="text-right font-semibold">
								{formatNumber(repository.score)}
							</TableCell>
							<TableCell className="hidden md:table-cell">
								{formatNumber(
									stats?.participantsCount ?? repository.activeContributorsCount
								)}
							</TableCell>
							<TableCell className="hidden lg:table-cell">
								{formatNumber(stats?.eventsTotal ?? repository.eventsTotal)}
							</TableCell>
							<TableCell className="text-right">
								<Link
									to="/repositories/$repositoryId"
									params={{ repositoryId: repository.repositoryId }}
								>
									<Button variant="outline" size="sm">
										Открыть
									</Button>
								</Link>
							</TableCell>
						</TableRow>
					)
				})}
			</TableBody>
		</Table>
	)
}

function RepositoryStat({ label, value }: { label: string; value: number }) {
	return (
		<div className="rounded-2xl border bg-background/60 p-4">
			<p className="text-xs text-muted-foreground">{label}</p>
			<p className="mt-1 text-2xl font-semibold">{formatNumber(value)}</p>
		</div>
	)
}

function repositoryStatsById(ratings: RepositoryUserRating[]) {
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

function useRepositoryFilters() {
	const organizationId = useRatingsFilterStore((state) => state.organizationId)
	const semester = useRatingsFilterStore((state) => state.semester)
	const year = useRatingsFilterStore((state) => state.year)
	const dateFrom = useRatingsFilterStore((state) => state.dateFrom)
	const dateTo = useRatingsFilterStore((state) => state.dateTo)

	return { organizationId, semester, year, dateFrom, dateTo }
}
