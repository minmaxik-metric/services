export type RatingSubjectType = "USER" | "REPOSITORY"
export type RatingPeriodName = "DAILY" | "WEEKLY"
export type SemesterName = "autumn" | "spring"

export interface SemesterOption {
	semester: SemesterName
	year: number
	label: string
	dateFrom: string
	dateTo: string
}

export interface ListSemestersRequest {
	organizationId: string
	repositoryId?: string
	limit?: number
}

export interface ListSemestersResponse {
	semesters: SemesterOption[]
}
