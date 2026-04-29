import {
	Activity,
	GitPullRequest,
	HeartPulse,
	MessageSquareText,
	ShieldCheck,
	TimerReset,
	Trophy
} from "lucide-react"

import type {
	RepositoryRating,
	UserRating
} from "@/entities/rating/model/types"
import { categoryLabels } from "@/entities/rating/lib/metric-labels"
import { formatNumber } from "@/shared/lib/utils"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { Progress } from "@/shared/ui/progress"

const categoryCards = [
	{ key: "activityScore", label: categoryLabels.activity, icon: Activity },
	{
		key: "productivityScore",
		label: categoryLabels.productivity,
		icon: GitPullRequest
	},
	{
		key: "communicationScore",
		label: categoryLabels.communication,
		icon: MessageSquareText
	},
	{ key: "qualityScore", label: categoryLabels.quality, icon: ShieldCheck },
	{ key: "flowScore", label: categoryLabels.flow, icon: TimerReset },
	{
		key: "repositoryHealthScore",
		label: categoryLabels.repository_health,
		icon: HeartPulse
	}
] as const

export function ScoreSummary({
	rating,
	mode
}: {
	rating?: UserRating | RepositoryRating
	mode: "student" | "teacher"
}) {
	if (!rating) return null

	return (
		<div className="grid gap-4 metric-grid">
			<Card className="overflow-hidden border-primary/20 bg-primary text-primary-foreground shadow-[0_18px_80px_-40px_oklch(0.18_0.04_245.2)]">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Trophy className="size-5" />
						Итоговый score
					</CardTitle>
				</CardHeader>
				<CardContent>
					<div className="flex items-end justify-between gap-4">
						<div>
							<p className="text-5xl font-semibold tracking-tighter">
								{formatNumber(rating.score)}
							</p>
							<p className="mt-1 text-sm text-primary-foreground/75">
								Ранг #{rating.rank || "n/a"}
							</p>
						</div>
						<div className="rounded-2xl bg-white/12 px-3 py-2 text-right text-sm">
							{mode === "teacher" ? "С декомпозицией" : "Без детализации"}
						</div>
					</div>
				</CardContent>
			</Card>

			{mode === "teacher"
				? categoryCards.map((item) => {
						const Icon = item.icon
						const value = Number(rating[item.key] ?? 0)

						return (
							<Card key={item.key} className="surface">
								<CardHeader className="pb-2">
									<CardTitle className="flex items-center justify-between text-sm">
										<span>{item.label}</span>
										<Icon className="size-4 text-muted-foreground" />
									</CardTitle>
								</CardHeader>
								<CardContent>
									<p className="text-2xl font-semibold">
										{formatNumber(value)}
									</p>
									<Progress
										value={Math.min(100, Math.max(0, value))}
										className="mt-3"
									/>
								</CardContent>
							</Card>
						)
					})
				: null}
		</div>
	)
}
