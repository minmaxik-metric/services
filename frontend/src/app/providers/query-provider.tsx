import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import type { PropsWithChildren } from "react"
import { useState } from "react"

export function QueryProvider({ children }: PropsWithChildren) {
	const [queryClient] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						refetchOnWindowFocus: false,
						retry: 1,
						staleTime: 30_000
					}
				}
			})
	)

	return (
		<QueryClientProvider client={queryClient}>
			{children}
			{import.meta.env.DEV ? <ReactQueryDevtools initialIsOpen={false} /> : null}
		</QueryClientProvider>
	)
}
