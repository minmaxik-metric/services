export const env = {
	gatewayUrl:
		import.meta.env.VITE_GATEWAY_URL?.replace(/\/$/, "") ??
		"http://localhost:4000"
} as const
