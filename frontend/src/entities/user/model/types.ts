export type UserRole =
	| "ROLE_UNSPECIFIED"
	| "ROLE_USER"
	| "ROLE_SUPERVISOR"
	| "ROLE_ADMIN"

export type User = {
	id: string
	username: string
	profileUrl?: string
	avatarUrl?: string
	role: UserRole
}

export function isSupervisor(role?: UserRole) {
	return role === "ROLE_SUPERVISOR" || role === "ROLE_ADMIN"
}

export function roleLabel(role?: UserRole) {
	if (role === "ROLE_SUPERVISOR") return "Преподаватель"
	if (role === "ROLE_ADMIN") return "Администратор"
	return "Студент"
}
