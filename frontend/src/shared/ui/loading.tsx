import { Loader2 } from "lucide-react"

import { cn } from "@/shared/lib/utils"

export function LoadingState({
	className,
	label = "Загрузка данных",
	variant = "data"
}: {
	className?: string
	label?: string
	variant?: "data" | "compact"
}) {
	if (variant === "compact") {
		return (
			<div
				className={cn(
					"flex items-center gap-2 text-sm text-muted-foreground",
					className
				)}
			>
				<Loader2 className="size-4 animate-spin" />
				<span>{label}</span>
			</div>
		)
	}

	return (
		<div className={cn("surface space-y-5 rounded-3xl p-6", className)}>
			<div className="flex items-center gap-3 text-sm text-muted-foreground">
				<Loader2 className="size-4 animate-spin" />
				<span>{label}</span>
			</div>
			<div className="grid gap-3 md:grid-cols-4">
				{Array.from({ length: 4 }).map((_, index) => (
					<div key={index} className="rounded-2xl border bg-background/60 p-4">
						<Skeleton className="h-3 w-24" />
						<Skeleton className="mt-3 h-8 w-28" />
					</div>
				))}
			</div>
			<div className="space-y-2">
				{Array.from({ length: 6 }).map((_, index) => (
					<div
						key={index}
						className="grid gap-3 rounded-xl border bg-background/60 p-3 md:grid-cols-[1.4fr_0.5fr_0.5fr_0.5fr]"
					>
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-full" />
						<Skeleton className="h-5 w-full" />
					</div>
				))}
			</div>
		</div>
	)
}

export function Skeleton({ className }: { className?: string }) {
	return (
		<div
			className={cn(
				"shrink-0 animate-pulse rounded-md bg-muted-foreground/15",
				className
			)}
		/>
	)
}
