import type { Semester } from "../../types/semester.type"

export type SemesterOptionResponseDto = {
	semester: Semester
	year: number
	label: string
	dateFrom: string
	dateTo: string
}
