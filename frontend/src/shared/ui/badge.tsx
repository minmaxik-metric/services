import { cva, type VariantProps } from "class-variance-authority"
import * as React from "react"

import { cn } from "@/shared/lib/utils"

const badgeVariants = cva(
	"inline-flex items-center justify-center rounded-md border px-2 py-0.5 text-xs font-semibold whitespace-nowrap shrink-0 gap-1 transition-colors overflow-hidden",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground",
				secondary:
					"border-transparent bg-secondary text-secondary-foreground",
				destructive:
					"border-transparent bg-destructive text-white",
				outline: "text-foreground",
				soft: "border-primary/15 bg-primary/10 text-primary"
			}
		},
		defaultVariants: {
			variant: "default"
		}
	}
)

function Badge({
	className,
	variant,
	...props
}: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
	return (
		<span
			data-slot="badge"
			className={cn(badgeVariants({ variant, className }))}
			{...props}
		/>
	)
}

export { Badge, badgeVariants }
