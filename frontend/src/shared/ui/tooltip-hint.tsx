import { Info } from "lucide-react"
import {
	useCallback,
	useEffect,
	useId,
	useLayoutEffect,
	useRef,
	useState,
	type CSSProperties,
	type ReactNode
} from "react"
import { createPortal } from "react-dom"

import { cn } from "@/shared/lib/utils"

const tooltipWidth = 288
const viewportPadding = 8
const tooltipGap = 10

export function TooltipHint({
	label,
	description,
	className,
	align = "left",
	focusable = true
}: {
	label: ReactNode
	description: string
	className?: string
	align?: "left" | "right"
	focusable?: boolean
}) {
	const id = useId()
	const anchorRef = useRef<HTMLSpanElement>(null)
	const tooltipRef = useRef<HTMLSpanElement>(null)
	const [open, setOpen] = useState(false)
	const [position, setPosition] = useState<CSSProperties>({
		left: 0,
		top: 0,
		width: tooltipWidth,
		visibility: "hidden"
	})
	const updatePosition = useCallback(() => {
		const anchor = anchorRef.current

		if (!anchor) return

		const rect = anchor.getBoundingClientRect()
		const availableWidth = Math.max(180, window.innerWidth - viewportPadding * 2)
		const width = Math.min(tooltipWidth, availableWidth)
		const height = tooltipRef.current?.offsetHeight ?? 80
		const maxLeft = Math.max(
			viewportPadding,
			window.innerWidth - width - viewportPadding
		)
		const rawLeft =
			align === "right"
				? rect.right - width
				: rect.left + rect.width / 2 - width / 2
		const left = Math.min(Math.max(viewportPadding, rawLeft), maxLeft)
		const top = Math.max(viewportPadding, rect.top - height - tooltipGap)

		setPosition({
			left,
			top,
			width,
			visibility: "visible"
		})
	}, [align])
	const show = useCallback(() => {
		setPosition((current) => ({ ...current, visibility: "hidden" }))
		setOpen(true)
	}, [])
	const hide = useCallback(() => setOpen(false), [])

	useLayoutEffect(() => {
		if (!open) return

		updatePosition()
	}, [open, updatePosition, description])

	useEffect(() => {
		if (!open) return

		window.addEventListener("resize", updatePosition)
		window.addEventListener("scroll", updatePosition, true)

		return () => {
			window.removeEventListener("resize", updatePosition)
			window.removeEventListener("scroll", updatePosition, true)
		}
	}, [open, updatePosition])

	const tooltip =
		open && typeof document !== "undefined"
			? createPortal(
					<span
						id={id}
						ref={tooltipRef}
						role="tooltip"
						style={position}
						className="pointer-events-none fixed z-[1000] rounded-xl border bg-popover px-3 py-2 text-xs font-normal leading-relaxed text-popover-foreground shadow-xl"
					>
						{description}
					</span>,
					document.body
				)
			: null

	return (
		<span
			ref={anchorRef}
			className={cn("inline-flex items-center gap-1", className)}
			tabIndex={focusable ? 0 : undefined}
			aria-describedby={open ? id : undefined}
			onBlur={hide}
			onFocus={show}
			onMouseEnter={show}
			onMouseLeave={hide}
		>
			<span>{label}</span>
			<Info className="size-3.5 text-muted-foreground" aria-hidden="true" />
			{tooltip}
		</span>
	)
}
