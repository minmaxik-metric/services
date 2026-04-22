import { useNavigate } from "@tanstack/react-router"
import { useEffect } from "react"

import { useSessionStore } from "@/features/auth/model/session-store"
import { Card, CardContent, CardHeader, CardTitle } from "@/shared/ui/card"
import { LoadingState } from "@/shared/ui/loading"

export function AuthCallbackPage() {
	const navigate = useNavigate()
	const completeGithubCallback = useSessionStore(
		state => state.completeGithubCallback
	)

	useEffect(() => {
		const token = readTokenFromUrl()

		if (!token) {
			navigate({ to: "/login", replace: true })
			return
		}

		completeGithubCallback(token).then(() => {
			navigate({ to: "/", replace: true })
		})
	}, [completeGithubCallback, navigate])

	return (
		<main className="grid min-h-screen place-items-center p-4">
			<Card className="surface w-full max-w-md">
				<CardHeader>
					<CardTitle>Завершаем вход</CardTitle>
				</CardHeader>
				<CardContent>
					<LoadingState
						label="Получаем профиль пользователя"
						variant="compact"
					/>
				</CardContent>
			</Card>
		</main>
	)
}

function readTokenFromUrl() {
	const search = new URLSearchParams(window.location.search)
	const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""))

	return (
		search.get("accessToken") ??
		search.get("access_token") ??
		hash.get("accessToken") ??
		hash.get("access_token")
	)
}
