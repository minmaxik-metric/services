import { RouterProvider } from "@tanstack/react-router"

import { router } from "@/app/router/router"
import { Toaster } from "@/shared/ui/sonner"

import { QueryProvider } from "./query-provider"

export function AppProvider() {
	return (
		<QueryProvider>
			<RouterProvider router={router} />
			<Toaster />
		</QueryProvider>
	)
}
