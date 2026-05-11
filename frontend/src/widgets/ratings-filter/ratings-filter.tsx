import {
	keepPreviousData,
	useIsFetching,
	useQuery
} from "@tanstack/react-query"
import { Search } from "lucide-react"
import { type FormEvent, useEffect, useMemo, useState } from "react"

import {
	type AvailableSemester,
	getAvailableSemesters,
	getSupervisorOrganizations
} from "@/features/ratings/api/ratings-api"
import {
	type Semester,
	useRatingsFilterStore
} from "@/features/ratings/model/ratings-filter-store"
import { isSupervisor } from "@/entities/user/model/types"
import { useSessionStore } from "@/features/auth/model/session-store"
import { Button } from "@/shared/ui/button"
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { Skeleton } from "@/shared/ui/loading"
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue
} from "@/shared/ui/select"

export function RatingsFilter() {
	const user = useSessionStore((state) => state.user)
	const supervisor = isSupervisor(user?.role)
	const organizationId = useRatingsFilterStore((state) => state.organizationId)
	const semester = useRatingsFilterStore((state) => state.semester)
	const year = useRatingsFilterStore((state) => state.year)
	const dateFrom = useRatingsFilterStore((state) => state.dateFrom)
	const dateTo = useRatingsFilterStore((state) => state.dateTo)
	const setFilters = useRatingsFilterStore((state) => state.setFilters)
	const [draftOrganizationId, setDraftOrganizationId] = useState(organizationId)
	const [draftSemester, setDraftSemester] = useState<Semester>(semester)
	const [draftYear, setDraftYear] = useState(year)
	const [draftDateFrom, setDraftDateFrom] = useState(dateFrom)
	const [draftDateTo, setDraftDateTo] = useState(dateTo)
	const ratingsFetching = useIsFetching({
		predicate: (query) => {
			const rootKey = query.queryKey[0]

			return (
				rootKey === "ratings" ||
				rootKey === "leaderboard" ||
				rootKey === "repositories-page" ||
				rootKey === "repository-detail"
			)
		}
	})
	const semestersQuery = useQuery({
		queryKey: ["analytics", "semesters", draftOrganizationId],
		queryFn: () => getAvailableSemesters(draftOrganizationId),
		placeholderData: keepPreviousData
	})
	const organizationsQuery = useQuery({
		queryKey: ["analytics", "supervisor-organizations"],
		queryFn: getSupervisorOrganizations,
		enabled: supervisor,
		placeholderData: keepPreviousData
	})
	const organizations = organizationsQuery.data?.organizations ?? []
	const options = useMemo(
		() =>
			semestersQuery.data?.semesters.length
				? semestersQuery.data.semesters
				: [fallbackSemester(semester, year)],
		[semestersQuery.data?.semesters, semester, year]
	)
	const selectedOption =
		options.find(
			(option) => option.semester === draftSemester && option.year === draftYear
		) ?? options[0]
	const selectedSemesterValue = `${selectedOption.semester}:${selectedOption.year}`
	const validationError = validateDates(
		selectedOption,
		draftDateFrom,
		draftDateTo
	)
	const optionsUpdating =
		(semestersQuery.isFetching && !semestersQuery.isPending) ||
		(supervisor &&
			organizationsQuery.isFetching &&
			!organizationsQuery.isPending)
	const ratingsUpdating = ratingsFetching > 0

	useEffect(() => {
		setDraftOrganizationId(organizationId)
		setDraftSemester(semester)
		setDraftYear(year)
		setDraftDateFrom(dateFrom)
		setDraftDateTo(dateTo)
	}, [dateFrom, dateTo, organizationId, semester, year])

	useEffect(() => {
		if (!semestersQuery.data?.semesters.length) return
		if (
			options.some(
				(option) =>
					option.semester === draftSemester && option.year === draftYear
			)
		) {
			return
		}

		const next = options[0]
		setDraftSemester(next.semester)
		setDraftYear(next.year)
		setDraftDateFrom("")
		setDraftDateTo("")
	}, [draftSemester, draftYear, options, semestersQuery.data?.semesters.length])

	if (
		semestersQuery.isPending ||
		(supervisor && organizationsQuery.isPending)
	) {
		return <RatingsFilterSkeleton supervisor={supervisor} />
	}

	function applyFilters(event: FormEvent<HTMLFormElement>) {
		event.preventDefault()
		if (validationError) return

		setFilters({
			semester: selectedOption.semester,
			year: selectedOption.year,
			organizationId: draftOrganizationId,
			dateFrom: draftDateFrom,
			dateTo: draftDateTo
		})
	}

	function selectSemester(value: string) {
		const [nextSemester, nextYear] = value.split(":") as [Semester, string]
		const nextOption = options.find(
			(option) =>
				option.semester === nextSemester && option.year === Number(nextYear)
		)

		setDraftSemester(nextSemester)
		setDraftYear(Number(nextYear))

		if (!nextOption) return

		if (draftDateFrom && !dateInside(draftDateFrom, nextOption)) {
			setDraftDateFrom("")
		}

		if (draftDateTo && !dateInside(draftDateTo, nextOption)) {
			setDraftDateTo("")
		}
	}

	return (
		<form
			className="rounded-2xl border bg-background/60 p-3"
			onSubmit={applyFilters}
		>
			<div className="mb-3">
				<p className="text-sm font-semibold">Период анализа</p>
				<p className="mt-1 text-xs text-muted-foreground">
					Семестр и даты для всех рейтингов.
				</p>
			</div>
			<div className="grid gap-3">
				{supervisor ? (
					<div className="grid gap-2">
						<Label>Организация</Label>
						<Select
							value={draftOrganizationId || "__all__"}
							onValueChange={(value) =>
								setDraftOrganizationId(value === "__all__" ? "" : value)
							}
						>
							<SelectTrigger className="h-10">
								<SelectValue placeholder="Все организации" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="__all__">Все организации</SelectItem>
								{organizations.map((organization) => (
									<SelectItem key={organization.key} value={organization.key}>
										{organization.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				) : null}
				<div className="grid gap-2">
					<Label>Семестр</Label>
					<Select value={selectedSemesterValue} onValueChange={selectSemester}>
						<SelectTrigger className="h-10">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							{options.map((option) => (
								<SelectItem
									key={`${option.semester}:${option.year}`}
									value={`${option.semester}:${option.year}`}
								>
									{option.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="dateFrom">Начало</Label>
					<Input
						id="dateFrom"
						type="date"
						className="h-10"
						min={selectedOption.dateFrom}
						max={selectedOption.dateTo}
						value={draftDateFrom}
						onChange={(event) => setDraftDateFrom(event.target.value)}
					/>
				</div>
				<div className="grid gap-2">
					<Label htmlFor="dateTo">Конец</Label>
					<Input
						id="dateTo"
						type="date"
						className="h-10"
						min={selectedOption.dateFrom}
						max={selectedOption.dateTo}
						value={draftDateTo}
						onChange={(event) => setDraftDateTo(event.target.value)}
					/>
				</div>
				<Button
					type="submit"
					className="h-10 w-full rounded-xl"
					disabled={
						Boolean(validationError) || optionsUpdating || ratingsUpdating
					}
				>
					<Search className="size-4" />
					{ratingsUpdating
						? "Обновляем данные"
						: optionsUpdating
							? "Обновляем периоды"
							: "Обновить"}
				</Button>
				<p className="min-h-10 text-xs leading-5 text-muted-foreground">
					{ratingsUpdating
						? "Данные по выбранному периоду загружаются."
						: optionsUpdating
						? "Загружаем доступные семестры для выбранной организации."
						: (validationError ??
							`Без дат: весь семестр ${selectedOption.dateFrom} - ${selectedOption.dateTo}.`)}
				</p>
			</div>
		</form>
	)
}

function RatingsFilterSkeleton({ supervisor }: { supervisor: boolean }) {
	const fieldsCount = supervisor ? 4 : 3

	return (
		<div className="rounded-2xl border bg-background/60 p-3">
			<div className="mb-3">
				<Skeleton className="h-5 w-32 rounded-md" />
				<Skeleton className="mt-2 h-4 w-full rounded-md" />
			</div>
			<div className="mt-3 grid gap-3">
				{Array.from({ length: fieldsCount }).map((_, index) => (
					<div key={index} className="grid gap-2">
						<Skeleton className="h-4 w-24 rounded-md" />
						<Skeleton className="h-10 w-full rounded-md" />
					</div>
				))}
				<Skeleton className="h-10 w-full rounded-xl" />
				<Skeleton className="h-10 w-full rounded-md" />
			</div>
		</div>
	)
}

function fallbackSemester(semester: Semester, year: number): AvailableSemester {
	const autumn = semester === "autumn"
	const from = new Date(Date.UTC(year, autumn ? 8 : 1, 1))
	const toExclusive = new Date(
		Date.UTC(autumn ? year + 1 : year, autumn ? 1 : 8, 1)
	)
	const to = new Date(toExclusive)

	to.setUTCDate(to.getUTCDate() - 1)

	return {
		semester,
		year,
		label: `${autumn ? "Осенний" : "Весенний"} ${year}`,
		dateFrom: dateInputValue(from),
		dateTo: dateInputValue(to)
	}
}

function validateDates(
	semester: AvailableSemester,
	dateFrom: string,
	dateTo: string
) {
	if (dateFrom && !dateInside(dateFrom, semester)) {
		return "Дата начала должна попадать в выбранный семестр."
	}

	if (dateTo && !dateInside(dateTo, semester)) {
		return "Дата конца должна попадать в выбранный семестр."
	}

	if (dateFrom && dateTo && dateFrom > dateTo) {
		return "Дата начала должна быть раньше даты конца."
	}

	return null
}

function dateInside(date: string, semester: AvailableSemester) {
	return date >= semester.dateFrom && date <= semester.dateTo
}

function dateInputValue(date: Date) {
	return date.toISOString().slice(0, 10)
}
