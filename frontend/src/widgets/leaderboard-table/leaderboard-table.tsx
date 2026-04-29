import { ExternalLink } from "lucide-react"

import type {
	RepositoryRating,
	RepositoryUserRating,
	UserRating
} from "@/entities/rating/model/types"
import { formatNumber } from "@/shared/lib/utils"
import { Badge } from "@/shared/ui/badge"
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow
} from "@/shared/ui/table"
import { TooltipHint } from "@/shared/ui/tooltip-hint"

type LeaderboardTableProps =
	| {
			type: "users"
			items: UserRating[]
			showDetails: boolean
	  }
	| {
			type: "repositoryUsers"
			items: RepositoryUserRating[]
			showDetails: boolean
			audience: "student" | "teacher"
	  }
	| {
			type: "repositories"
			items: RepositoryRating[]
			showDetails: boolean
	  }

export function LeaderboardTable(props: LeaderboardTableProps) {
	const showRepositoryColumn =
		props.type === "repositoryUsers" && props.audience === "teacher"

	return (
		<Table>
			<TableHeader>
				<TableRow>
					<TableHead className="w-20">Ранг</TableHead>
					<TableHead>{primaryHeader(props)}</TableHead>
					{showRepositoryColumn ? (
						<TableHead className="hidden md:table-cell">Репозиторий</TableHead>
					) : null}
					<TableHead>
						<TooltipHint
							label="Score"
							description="Итоговая оценка 0-100: средневзвешенный результат категорий с учетом confidence."
						/>
					</TableHead>
					<TableHead className="hidden lg:table-cell">
						<TooltipHint
							label="События"
							description="Суммарное число событий GitHub, попавших в расчет выбранного семестра или периода."
						/>
					</TableHead>
					{props.showDetails ? (
						<TableHead className="hidden xl:table-cell">
							<TooltipHint
								label="GitHub"
								description="Ссылка на GitHub-профиль студента или репозиторий."
								align="right"
							/>
						</TableHead>
					) : null}
				</TableRow>
			</TableHeader>
			<TableBody>
				{props.items.map(item => {
					const repositoryUser =
						props.type === "repositoryUsers"
							? (item as RepositoryUserRating)
							: null
					const primaryGithubUrl = props.showDetails
						? ""
						: readGithubUrl(props, item)

					return (
						<TableRow key={readId(props.type, item)}>
							<TableCell>
								<Badge variant={item.rank <= 3 ? "soft" : "secondary"}>
									#{item.rank}
								</Badge>
							</TableCell>
							<TableCell>
								<div className="min-w-40 font-medium">{readTitle(props, item)}</div>
								{primaryGithubUrl ? (
									<GithubLink
										href={primaryGithubUrl}
										label={readGithubLabel(props)}
									/>
								) : null}
							</TableCell>
							{showRepositoryColumn ? (
								<TableCell className="hidden md:table-cell">
									<div className="min-w-40">{repositoryUser?.repositoryName}</div>
									{repositoryUser?.repositoryUrl ? (
										<a
											href={repositoryUser.repositoryUrl}
											target="_blank"
											rel="noreferrer"
											className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
										>
											GitHub
											<ExternalLink className="size-3" />
										</a>
									) : null}
								</TableCell>
							) : null}
							<TableCell className="text-lg font-semibold">
								{formatNumber(item.score)}
							</TableCell>
							<TableCell className="hidden lg:table-cell">
								{formatNumber(item.eventsTotal)}
							</TableCell>
							{props.showDetails ? (
								<TableCell className="hidden xl:table-cell">
									<GithubLink
										href={readGithubUrl(props, item)}
										label={readGithubLabel(props)}
									/>
								</TableCell>
							) : null}
						</TableRow>
					)
				})}
			</TableBody>
		</Table>
	)
}

function readId(
	type: LeaderboardTableProps["type"],
	item: UserRating | RepositoryRating | RepositoryUserRating
) {
	if (type === "users") return (item as UserRating).contributorId

	if (type === "repositoryUsers") {
		const rating = item as RepositoryUserRating

		return `${rating.repositoryId}:${rating.contributorId}`
	}

	return (item as RepositoryRating).repositoryId
}

function readTitle(
	props: LeaderboardTableProps,
	item: UserRating | RepositoryRating | RepositoryUserRating
) {
	if (props.type === "users") return (item as UserRating).contributorLogin

	if (props.type === "repositoryUsers") {
		const rating = item as RepositoryUserRating

		return props.audience === "teacher"
			? rating.contributorLogin
			: rating.repositoryName
	}

	return (item as RepositoryRating).repositoryName
}

function readGithubUrl(
	props: LeaderboardTableProps,
	item: UserRating | RepositoryRating | RepositoryUserRating
) {
	if (props.type === "users") {
		return contributorGithubUrl((item as UserRating).contributorLogin)
	}

	if (props.type === "repositoryUsers") {
		const rating = item as RepositoryUserRating

		return props.audience === "teacher"
			? contributorGithubUrl(rating.contributorLogin)
			: (rating.repositoryUrl ?? "")
	}

	return (item as RepositoryRating).repositoryUrl ?? ""
}

function readGithubLabel(props: LeaderboardTableProps) {
	if (props.type === "repositories") return "Репозиторий"
	if (props.type === "repositoryUsers" && props.audience === "student") {
		return "Репозиторий"
	}

	return "Профиль"
}

function contributorGithubUrl(login: string | undefined) {
	const normalized = login?.trim().replace(/^@/, "")

	return normalized ? `https://github.com/${encodeURIComponent(normalized)}` : ""
}

function primaryHeader(props: LeaderboardTableProps) {
	if (props.type === "users") return "Студент"
	if (props.type === "repositories") return "Репозиторий"

	return props.audience === "teacher" ? "Студент" : "Репозиторий"
}

function GithubLink({ href, label }: { href: string; label: string }) {
	if (!href) return <span className="text-muted-foreground">-</span>

	return (
		<a
			href={href}
			target="_blank"
			rel="noreferrer"
			className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
		>
			{label}
			<ExternalLink className="size-3" />
		</a>
	)
}
