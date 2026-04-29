import { Link } from "@tanstack/react-router"
import { ExternalLink } from "lucide-react"

import type {
	RepositoryUserRating,
	ScoreComponent
} from "@/entities/rating/model/types"
import { categoryLabels } from "@/entities/rating/lib/metric-labels"
import { formatMetricValue, formatNumber } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/badge"
import { Button } from "@/shared/ui/button"
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle
} from "@/shared/ui/card"

const bottleneckMetrics = new Set([
	"review_queue_pressure",
	"median_review_response_time_sec",
	"backlog_growth_ratio",
	"work_balance_delta",
	"issue_backlog_delta",
	"pull_request_backlog_delta",
	"stale_open_work_ratio",
	"reopen_pressure_index"
])

type Anomaly = {
	repositoryId: string
	repositoryName: string
	contributorLogin: string
	component: ScoreComponent
	severity: "critical" | "warning"
}

type StudentAnomalyGroup = {
	contributorLogin: string
	anomalies: Anomaly[]
	criticalCount: number
}

export function AnomalyPanel({ ratings }: { ratings: RepositoryUserRating[] }) {
	const groups = groupByStudent(findAnomalies(ratings))

	if (groups.length === 0) return null

	return (
		<Card className="surface border-destructive/30">
			<CardHeader>
				<CardTitle>Аномалии и заторы</CardTitle>
				<CardDescription>
					Метрики с низким percentile-score в flow, quality и communication.
				</CardDescription>
			</CardHeader>
			<CardContent>
				<div className="grid gap-3 xl:grid-cols-2">
					{groups.slice(0, 8).map((group) => (
						<div
							key={group.contributorLogin}
							className="rounded-2xl border bg-background/70 p-4"
						>
							<div className="flex flex-wrap items-center justify-between gap-2">
								<div>
									<p className="font-semibold">{group.contributorLogin}</p>
									<p className="text-xs text-muted-foreground">
										{group.anomalies.length} метрик с риском
									</p>
								</div>
								<Badge
									variant={
										group.criticalCount > 0 ? "destructive" : "secondary"
									}
								>
									{group.criticalCount > 0
										? `${group.criticalCount} критично`
										: "Риск"}
								</Badge>
							</div>

							<div className="mt-3 space-y-2">
								{group.anomalies.slice(0, 4).map((anomaly) => (
									<div
										key={`${anomaly.repositoryId}-${anomaly.component.metric}`}
										className="rounded-xl border bg-background/70 p-3"
									>
										<div className="flex flex-wrap items-start justify-between gap-2">
											<div className="min-w-0">
												<p className="font-medium">
													{anomaly.component.label ?? anomaly.component.metric}
												</p>
												<p className="text-xs text-muted-foreground">
													{categoryLabels[anomaly.component.category]} ·{" "}
													{anomaly.repositoryName}
												</p>
											</div>
											<Badge
												variant={
													anomaly.severity === "critical"
														? "destructive"
														: "secondary"
												}
											>
												{formatNumber(anomaly.component.normalizedValue)}
											</Badge>
										</div>
										<div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
											<span>
												Raw{" "}
												{formatMetricValue(
													anomaly.component.metric,
													anomaly.component.rawValue
												)}
											</span>
											<Link
												to="/repositories/$repositoryId"
												params={{ repositoryId: anomaly.repositoryId }}
											>
												<Button variant="ghost" size="sm" className="h-7 px-2">
													Репозиторий
													<ExternalLink className="size-3" />
												</Button>
											</Link>
										</div>
									</div>
								))}
								{group.anomalies.length > 4 ? (
									<p className="text-xs text-muted-foreground">
										Еще {group.anomalies.length - 4} аномалий
									</p>
								) : null}
							</div>
						</div>
					))}
				</div>
			</CardContent>
		</Card>
	)
}

function findAnomalies(ratings: RepositoryUserRating[]): Anomaly[] {
	return ratings
		.flatMap((rating) =>
			rating.scoreComponents
				.filter((component) => isAnomaly(component))
				.map(
					(component) =>
						({
							repositoryId: rating.repositoryId,
							repositoryName: rating.repositoryName,
							contributorLogin: rating.contributorLogin,
							component,
							severity: component.normalizedValue < 20 ? "critical" : "warning"
						}) satisfies Anomaly
				)
		)
		.sort(
			(a, b) =>
				a.component.normalizedValue - b.component.normalizedValue ||
				b.component.weightedScore - a.component.weightedScore
		)
}

function groupByStudent(anomalies: Anomaly[]): StudentAnomalyGroup[] {
	const grouped = anomalies.reduce<Map<string, Anomaly[]>>((acc, anomaly) => {
		const group = acc.get(anomaly.contributorLogin) ?? []

		group.push(anomaly)
		acc.set(anomaly.contributorLogin, group)

		return acc
	}, new Map())

	return [...grouped.entries()]
		.map(([contributorLogin, studentAnomalies]) => ({
			contributorLogin,
			anomalies: studentAnomalies,
			criticalCount: studentAnomalies.filter(
				(anomaly) => anomaly.severity === "critical"
			).length
		}))
		.sort(
			(a, b) =>
				b.criticalCount - a.criticalCount ||
				b.anomalies.length - a.anomalies.length ||
				a.contributorLogin.localeCompare(b.contributorLogin)
		)
}

function isAnomaly(component: ScoreComponent) {
	if (component.normalizedValue >= 35) return false

	return (
		bottleneckMetrics.has(component.metric) ||
		component.category === "flow" ||
		component.category === "quality"
	)
}
