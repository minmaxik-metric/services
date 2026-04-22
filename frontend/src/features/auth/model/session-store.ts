import { create } from "zustand"

import type { User } from "@/entities/user/model/types"
import { getAccessToken, setAccessToken } from "@/shared/api/token"

import { getMe, logoutRequest, refreshToken } from "../api/auth-api"

type SessionStatus = "idle" | "loading" | "authenticated" | "anonymous"

type SessionState = {
	status: SessionStatus
	user: User | null
	accessToken: string | null
	error: string | null
	bootstrap: () => Promise<void>
	completeGithubCallback: (token: string) => Promise<void>
	logout: () => Promise<void>
}

export const useSessionStore = create<SessionState>((set, get) => ({
	status: "idle",
	user: null,
	accessToken: getAccessToken(),
	error: null,

	bootstrap: async () => {
		const state = get()

		if (state.status === "loading") return

		set({ status: "loading", error: null })

		try {
			let token = getAccessToken()

			if (!token) {
				const refreshed = await refreshToken()
				token = refreshed.accessToken
				setAccessToken(token)
			}

			const user = await getMe()

			set({
				status: "authenticated",
				user,
				accessToken: token,
				error: null
			})
		} catch (error) {
			setAccessToken(null)
			set({
				status: "anonymous",
				user: null,
				accessToken: null,
				error: error instanceof Error ? error.message : "Не удалось войти"
			})
		}
	},

	completeGithubCallback: async token => {
		set({ status: "loading", error: null })
		setAccessToken(token)

		try {
			const user = await getMe()

			set({
				status: "authenticated",
				user,
				accessToken: token,
				error: null
			})
		} catch (error) {
			setAccessToken(null)
			set({
				status: "anonymous",
				user: null,
				accessToken: null,
				error: error instanceof Error ? error.message : "Не удалось завершить вход"
			})
		}
	},

	logout: async () => {
		try {
			await logoutRequest()
		} finally {
			setAccessToken(null)
			set({
				status: "anonymous",
				user: null,
				accessToken: null,
				error: null
			})
		}
	}
}))
