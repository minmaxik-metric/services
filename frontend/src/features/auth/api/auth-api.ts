import { apiRequest } from "@/shared/api/client"
import { env } from "@/shared/config/env"

import type { User, UserRole } from "@/entities/user/model/types"

type GatewayUser = {
	id: string
	username?: string
	profileUrl?: string
	profile_url?: string
	avatarUrl?: string
	avatar_url?: string
	role?: UserRole | number | string
}

const roles = new Set<UserRole>([
	"ROLE_UNSPECIFIED",
	"ROLE_USER",
	"ROLE_SUPERVISOR",
	"ROLE_ADMIN"
])

export function loginWithGithub() {
	window.location.assign(`${env.gatewayUrl}/auth/github`)
}

export function getMe() {
	return apiRequest<GatewayUser>("/users/@me").then(normalizeUser)
}

export function refreshToken() {
	return apiRequest<{ accessToken: string }>("/auth/refresh", {
		method: "POST",
		auth: false,
		retryOnUnauthorized: false
	})
}

export function logoutRequest() {
	return apiRequest<{ ok: boolean }>("/auth/logout", {
		method: "POST",
		auth: false,
		retryOnUnauthorized: false
	})
}

function normalizeUser(user: GatewayUser): User {
	return {
		id: user.id,
		username: user.username ?? "unknown",
		profileUrl: user.profileUrl ?? user.profile_url,
		avatarUrl: user.avatarUrl ?? user.avatar_url,
		role: normalizeRole(user.role)
	}
}

function normalizeRole(role: GatewayUser["role"]): UserRole {
	if (typeof role === "string" && roles.has(role as UserRole)) {
		return role as UserRole
	}

	if (role === "SUPERVISOR") return "ROLE_SUPERVISOR"
	if (role === "ADMIN") return "ROLE_ADMIN"
	if (role === "USER") return "ROLE_USER"

	if (typeof role === "number") {
		if (role === 2) return "ROLE_SUPERVISOR"
		if (role === 3) return "ROLE_ADMIN"
		if (role === 0) return "ROLE_UNSPECIFIED"
	}

	return "ROLE_USER"
}
