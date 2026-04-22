import { env } from "@/shared/config/env"

import { getAccessToken, setAccessToken } from "./token"

type RequestOptions = Omit<RequestInit, "body"> & {
	body?: unknown
	auth?: boolean
	retryOnUnauthorized?: boolean
}

export class ApiError extends Error {
	public constructor(
		message: string,
		public readonly status: number,
		public readonly details?: unknown
	) {
		super(message)
		this.name = "ApiError"
	}
}

export async function apiRequest<T>(
	path: string,
	options: RequestOptions = {}
): Promise<T> {
	const {
		body,
		auth = true,
		retryOnUnauthorized = true,
		headers,
		...init
	} = options

	const response = await fetch(`${env.gatewayUrl}${path}`, {
		...init,
		credentials: "include",
		headers: {
			Accept: "application/json",
			...(body ? { "Content-Type": "application/json" } : {}),
			...(auth && getAccessToken()
				? { Authorization: `Bearer ${getAccessToken()}` }
				: {}),
			...headers
		},
		body: body ? JSON.stringify(body) : undefined
	})

	if (response.status === 401 && auth && retryOnUnauthorized) {
		const refreshed = await refreshAccessToken()

		if (refreshed) {
			return apiRequest<T>(path, {
				...options,
				retryOnUnauthorized: false
			})
		}
	}

	if (!response.ok) {
		const details = await safeJson(response)
		throw new ApiError(
			readErrorMessage(details) ?? response.statusText,
			response.status,
			details
		)
	}

	if (response.status === 204) return undefined as T

	return (await safeJson(response)) as T
}

async function refreshAccessToken() {
	const response = await fetch(`${env.gatewayUrl}/auth/refresh`, {
		method: "POST",
		credentials: "include",
		headers: {
			Accept: "application/json"
		}
	})

	if (!response.ok) {
		setAccessToken(null)
		return false
	}

	const data = (await safeJson(response)) as { accessToken?: string }

	if (!data.accessToken) return false

	setAccessToken(data.accessToken)
	return true
}

async function safeJson(response: Response) {
	const text = await response.text()

	if (!text) return null

	try {
		return JSON.parse(text) as unknown
	} catch {
		return text
	}
}

function readErrorMessage(details: unknown) {
	if (details && typeof details === "object" && "message" in details) {
		const message = (details as { message: unknown }).message

		if (typeof message === "string") return message
		if (Array.isArray(message)) return message.join(", ")
	}

	return null
}
