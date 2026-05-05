import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { ChevronDown, Save, SlidersHorizontal } from "lucide-react"
import { useEffect, useMemo, useState } from "react"
import { toast } from "sonner"

import { categoryLabels } from "@/entities/rating/lib/metric-labels"
import type { ScoreWeight } from "@/entities/rating/model/types"
import {
	defaultCategoryWeights,
	userMetricDefinitions
} from "@/entities/scoring/model/definitions"
import type { ScoringProfile } from "@/entities/scoring/model/types"
import { getMetricMetadata } from "@/features/ratings/api/ratings-api"
import {
	getDefaultScoringProfile,
	upsertScoringProfile
} from "@/features/scoring/api/scoring-api"
import { formatNumber } from "@/shared/lib/utils"
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
import { Input } from "@/shared/ui/input"
import { Label } from "@/shared/ui/label"
import { LoadingState } from "@/shared/ui/loading"
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger
} from "@/shared/ui/tabs"

export function WeightsEditor() {
	const queryClient = useQueryClient()
	const [metricWeights, setMetricWeights] = useState<Record<string, number>>({})
	const [categoryWeights, setCategoryWeights] = useState<Record<string, number>>({})

	const profileQuery = useQuery({
		queryKey: ["scoring-profile", "USER"],
		queryFn: () => getDefaultScoringProfile("USER")
	})
	const metadataQuery = useQuery({
		queryKey: ["metric-metadata"],
		queryFn: getMetricMetadata
	})

	const profile = profileQuery.data?.profile
	const metricMetadata = useMemo(
		() =>
			new Map(
				(metadataQuery.data?.metrics ?? []).map(metadata => [
					metadata.metric,
					metadata
				])
			),
		[metadataQuery.data?.metrics]
	)

	useEffect(() => {
		if (!profile) return

		setMetricWeights(toWeightMap(profile.metricWeights))
		setCategoryWeights({
			...defaultCategoryWeights,
			...toWeightMap(profile.categoryWeights)
		})
	}, [profile])

	const mutation = useMutation({
		mutationFn: (nextProfile: ScoringProfile) => upsertScoringProfile(nextProfile),
		onSuccess: () => {
			queryClient.invalidateQueries({ queryKey: ["scoring-profile"] })
			toast.success("Веса сохранены")
		},
		onError: error => {
			toast.error(error instanceof Error ? error.message : "Не удалось сохранить веса")
		}
	})

	const totalCategoryWeight = useMemo(
		() =>
			Object.values(categoryWeights).reduce(
				(acc, value) => acc + Number(value || 0),
				0
			),
		[categoryWeights]
	)
	const metricsByCategory = useMemo(
		() =>
			userMetricDefinitions.reduce<
				Record<string, typeof userMetricDefinitions>
			>((acc, definition) => {
				acc[definition.category] = [
					...(acc[definition.category] ?? []),
					definition
				]

				return acc
			}, {}),
		[]
	)

	if (profileQuery.isLoading || metadataQuery.isLoading) return <LoadingState />

	if (profileQuery.isError || metadataQuery.isError || !profile) {
		return (
			<EmptyState
				title="Профиль весов недоступен"
				description="Проверьте REST-фасад analytics и metadata endpoint в gateway-service."
			/>
		)
	}

	const saveProfile = () => {
		mutation.mutate({
			...profile,
			categoryWeights: Object.entries(categoryWeights).map(([metric, weight]) => ({
				metric,
				weight: Number(weight)
			})),
			metricWeights: Object.entries(metricWeights)
				.filter(([, weight]) => Number.isFinite(Number(weight)))
				.map(([metric, weight]) => ({
					metric,
					weight: Number(weight)
				}))
		})
	}

	return (
		<Card className="surface">
			<CardHeader className="gap-3 md:flex md:flex-row md:items-start md:justify-between">
				<div>
					<CardTitle className="flex items-center gap-2">
						<SlidersHorizontal className="size-5" />
						Веса метрик
					</CardTitle>
					<CardDescription>
						Редактирование default user scoring profile. Сумма категорий сейчас{" "}
						{formatNumber(totalCategoryWeight)}.
					</CardDescription>
				</div>
				<Button onClick={saveProfile} disabled={mutation.isPending}>
					<Save className="size-4" />
					Сохранить
				</Button>
			</CardHeader>
			<CardContent>
				<Tabs defaultValue="categories">
					<TabsList>
						<TabsTrigger value="categories">Категории</TabsTrigger>
						<TabsTrigger value="metrics">Метрики</TabsTrigger>
					</TabsList>
					<TabsContent value="categories" className="mt-4">
						<div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
							{Object.entries(defaultCategoryWeights).map(([category]) => (
								<div key={category} className="rounded-2xl border bg-background/60 p-4">
									<Label htmlFor={`category-${category}`}>
										{categoryLabels[category as keyof typeof categoryLabels]}
									</Label>
									<Input
										id={`category-${category}`}
										type="number"
										min={0}
										step={0.01}
										value={categoryWeights[category] ?? 0}
										className="mt-2"
										onChange={event =>
											setCategoryWeights(current => ({
												...current,
												[category]: Number(event.target.value)
											}))
										}
									/>
								</div>
							))}
						</div>
					</TabsContent>
					<TabsContent value="metrics" className="mt-4">
						<div className="grid gap-3">
							{Object.entries(metricsByCategory).map(
								([category, definitions], index) => (
								<details
									key={category}
									className="group rounded-2xl border bg-background/60 p-4"
									open={index === 0}
								>
									<summary className="flex cursor-pointer list-none items-center justify-between gap-3">
										<div>
											<p className="font-semibold">
												{categoryLabels[category as keyof typeof categoryLabels]}
											</p>
											<p className="text-xs text-muted-foreground">
												{definitions.length} метрик
											</p>
										</div>
										<ChevronDown className="size-4 transition-transform group-open:rotate-180" />
									</summary>
									<div className="mt-4 grid gap-3">
										{definitions.map(definition => (
											<div
												key={definition.metric}
												className="grid gap-3 rounded-xl border bg-background/70 p-3 md:grid-cols-[1fr_9rem]"
											>
												<div>
													<div className="flex flex-wrap items-center gap-2">
														<p className="font-medium">
															{metricMetadata.get(definition.metric)?.label ??
																definition.metric}
														</p>
														<Badge variant="secondary">
															{definition.direction}
														</Badge>
													</div>
													<p className="mt-1 text-xs text-muted-foreground">
														{metricMetadata.get(definition.metric)?.description ??
															"Метрика участвует в расчете score."}
													</p>
													<p className="mt-1 text-xs text-muted-foreground">
														Ключ: {definition.metric}. Базовый вес:{" "}
														{definition.defaultWeight}
													</p>
												</div>
												<div>
													<Label htmlFor={`metric-${definition.metric}`}>
														Вес
													</Label>
													<Input
														id={`metric-${definition.metric}`}
														type="number"
														min={0}
														step={0.1}
														value={
															metricWeights[definition.metric] ??
															definition.defaultWeight
														}
														className="mt-2"
														onChange={event =>
															setMetricWeights(current => ({
																...current,
																[definition.metric]: Number(event.target.value)
															}))
														}
													/>
												</div>
											</div>
										))}
									</div>
								</details>
								)
							)}
						</div>
						<p className="text-sm text-muted-foreground">
							Нулевой вес исключает вклад метрики из итогового weighted average.
						</p>
					</TabsContent>
				</Tabs>
			</CardContent>
		</Card>
	)
}

function toWeightMap(weights: ScoreWeight[] = []) {
	return weights.reduce<Record<string, number>>((acc, weight) => {
		acc[weight.metric] = Number(weight.weight)
		return acc
	}, {})
}
