import { AlertCircle } from "lucide-react"

import { cn } from "@/shared/lib/utils"

export function EmptyState({
	title,
	description,
	className
}: {
	title: string
	description?: string
	className?: string
}) {
	return (
		<div
			className={cn(
				"flex min-h-48 flex-col items-center justify-center rounded-xl border border-dashed bg-card/55 p-8 text-center",
				className
			)}
		>
			<AlertCircle className="mb-3 size-8 text-muted-foreground" />
			<h3 className="text-base font-semibold">{title}</h3>
			{description ? (
				<p className="mt-1 max-w-xl text-sm text-muted-foreground">{description}</p>
			) : null}
		</div>
	)
}
