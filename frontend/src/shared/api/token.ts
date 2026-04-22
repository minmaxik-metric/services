const ACCESS_TOKEN_KEY = "metric-service.access-token"

let accessToken =
	typeof window === "undefined"
		? null
		: window.localStorage.getItem(ACCESS_TOKEN_KEY)

export function getAccessToken() {
	return accessToken
}

export function setAccessToken(token: string | null) {
	accessToken = token

	if (typeof window === "undefined") return

	if (token) {
		window.localStorage.setItem(ACCESS_TOKEN_KEY, token)
	} else {
		window.localStorage.removeItem(ACCESS_TOKEN_KEY)
	}
}
